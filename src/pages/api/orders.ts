import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';

export const prerender = false;

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCTION_ORDER_ORIGINS = new Set([
  'https://star-sweets.co',
  'https://www.star-sweets.co',
]);

type MenuOption = {
  _id: string;
  name?: string;
  label?: string;
  caption?: string;
  basePrice?: number;
  priceModifier?: number;
};

type BrevoMessage = {
  sender: { name: string; email: string };
  to: Array<{ email: string; name?: string }>;
  replyTo?: { email: string };
  subject: string;
  htmlContent: string;
};

class FormError extends Error {}

function json(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function isAllowedOrderOrigin(origin: string | null) {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    if (PRODUCTION_ORDER_ORIGINS.has(url.origin)) return true;

    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return isLocalhost && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

function textValue(formData: FormData, name: string, maxLength = 2000) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function uniqueValues(formData: FormData, name: string) {
  return [...new Set(formData.getAll(name).filter((value): value is string => typeof value === 'string' && value))];
}

function asReference(id: string) {
  return { _type: 'reference', _ref: id };
}

function dollars(amount = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}

function orderRows(rows: Array<[string, string | undefined]>) {
  return rows
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b554f"><strong>${escapeHtml(label)}</strong></td><td style="padding:6px 0">${escapeHtml(value || '')}</td></tr>`)
    .join('');
}

async function sendBrevoEmail(apiKey: string, message: BrevoMessage) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(message),
  });
  const result = await response.json().catch(() => null) as { message?: string } | null;

  if (!response.ok) {
    throw new Error(result?.message || `Brevo returned HTTP ${response.status}.`);
  }
}

async function getMenuSelections(client: ReturnType<typeof createClient>, values: {
  sizeId: string;
  tierId: string;
  frostingId: string;
  addOnIds: string[];
  inspirationIds: string[];
}) {
  const [size, tier, frosting, addOns, inspiration] = await Promise.all([
    client.fetch<MenuOption | null>(
      `*[_type == "cakeSize" && _id == $id && isActive != false][0]{_id, name, basePrice}`,
      { id: values.sizeId }
    ),
    values.tierId
      ? client.fetch<MenuOption | null>(
        `*[_type == "tierOption" && _id == $id && isActive != false][0]{_id, label, priceModifier}`,
        { id: values.tierId }
      )
      : Promise.resolve(null),
    values.frostingId
      ? client.fetch<MenuOption | null>(
        `*[_type == "cakeFrosting" && _id == $id && isActive != false][0]{_id, name, priceModifier}`,
        { id: values.frostingId }
      )
      : Promise.resolve(null),
    client.fetch<MenuOption[]>(
      `*[_type == "addOn" && _id in $ids && isActive != false]{_id, name, priceModifier}`,
      { ids: values.addOnIds }
    ),
    client.fetch<MenuOption[]>(
      `*[_type == "inspirationGallery" && _id in $ids]{_id, caption}`,
      { ids: values.inspirationIds }
    ),
  ]);

  if (!size) throw new FormError('Choose a currently available cake size.');
  if (values.tierId && !tier) throw new FormError('Choose a currently available tier option.');
  if (values.frostingId && !frosting) throw new FormError('Choose a currently available frosting.');
  if (addOns.length !== values.addOnIds.length) throw new FormError('One or more selected add-ons are no longer available.');
  if (inspiration.length !== values.inspirationIds.length) throw new FormError('One or more inspiration selections are no longer available.');

  return { size, tier, frosting, addOns, inspiration };
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrderOrigin(request.headers.get('origin'))) {
    return json({ error: 'Request origin is not allowed.' }, 403);
  }

  const projectId = import.meta.env.SANITY_PROJECT_ID;
  const dataset = import.meta.env.SANITY_DATASET || 'production';
  const apiVersion = import.meta.env.SANITY_API_VERSION || '2024-01-01';
  const writeToken = import.meta.env.SANITY_WRITE_TOKEN;
  const brevoApiKey = import.meta.env.BREVO_API_KEY;
  const fromEmail = import.meta.env.BREVO_FROM_EMAIL;
  const notificationEmail = import.meta.env.ORDER_NOTIFICATION_EMAIL;

  if (!projectId || !writeToken || !brevoApiKey || !fromEmail || !notificationEmail) {
    return json({ error: 'Cake ordering is not configured yet. Please contact Star Sweets directly.' }, 503);
  }

  try {
    const formData = await request.formData();
    if (textValue(formData, 'website')) return json({ message: 'Thanks!' });

    const customerName = textValue(formData, 'customerName', 120);
    const eventDate = textValue(formData, 'eventDate', 10);
    const email = textValue(formData, 'email', 254).toLowerCase();
    const phone = textValue(formData, 'phone', 80);
    const flavorPath = textValue(formData, 'flavorPath', 20);
    const fillingPath = textValue(formData, 'fillingPath', 20);
    const customFlavorRequest = textValue(formData, 'customFlavorRequest');
    const customFillingRequest = textValue(formData, 'customFillingRequest');
    const notes = textValue(formData, 'notes', 4000);
    const sizeId = textValue(formData, 'cakeSize', 100);
    const tierId = textValue(formData, 'tierOption', 100);
    const frostingId = textValue(formData, 'cakeFrosting', 100);
    const addOnIds = uniqueValues(formData, 'addOns');
    const inspirationIds = uniqueValues(formData, 'inspirationSelections');

    if (!customerName || !eventDate || !sizeId) throw new FormError('Please complete your name, event date, and cake size.');
    if (!email && !phone) throw new FormError('Please provide an email address or phone number.');
    if (email && !EMAIL_RE.test(email)) throw new FormError('Please enter a valid email address.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new FormError('Please choose a valid event date.');
    if (flavorPath !== 'custom' && flavorPath !== 'surprise') throw new FormError('Please choose a flavor path.');
    if (fillingPath !== 'custom' && fillingPath !== 'surprise') throw new FormError('Please choose a filling path.');
    if (flavorPath === 'custom' && !customFlavorRequest) throw new FormError('Please describe your flavor request.');
    if (fillingPath === 'custom' && !customFillingRequest) throw new FormError('Please describe your filling request.');

    const imageFiles = formData.getAll('referenceImages').filter((value): value is File => value instanceof File && value.size > 0);
    if (imageFiles.length > MAX_IMAGES) throw new FormError(`Please attach no more than ${MAX_IMAGES} images.`);
    for (const file of imageFiles) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new FormError(`${file.name} must be a PNG, JPG, or WebP image.`);
      if (file.size > MAX_IMAGE_BYTES) throw new FormError(`${file.name} must be 2 MB or smaller.`);
    }
    const totalImageBytes = imageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) throw new FormError('Reference images must be 4 MB or smaller in total.');

    const client = createClient({
      projectId,
      dataset,
      apiVersion,
      token: writeToken,
      useCdn: false,
    });
    const selections = await getMenuSelections(client, { sizeId, tierId, frostingId, addOnIds, inspirationIds });
    const calculatedTotal = Math.round((
      Number(selections.size.basePrice || 0)
      + Number(selections.tier?.priceModifier || 0)
      + Number(selections.frosting?.priceModifier || 0)
      + selections.addOns.reduce((sum, addOn) => sum + Number(addOn.priceModifier || 0), 0)
    ) * 100) / 100;

    const referenceImages = await Promise.all(imageFiles.map(async (file) => {
      const asset = await client.assets.upload('image', Buffer.from(await file.arrayBuffer()), {
        filename: file.name,
        contentType: file.type,
      });
      return { _type: 'image', asset: asReference(asset._id) };
    }));

    const order = await client.create({
      _type: 'cakeOrder',
      customerName,
      email: email || undefined,
      phone: phone || undefined,
      eventDate,
      cakeSize: asReference(selections.size._id),
      tierOption: selections.tier ? asReference(selections.tier._id) : undefined,
      cakeFrosting: selections.frosting ? asReference(selections.frosting._id) : undefined,
      addOns: selections.addOns.map((addOn) => asReference(addOn._id)),
      inspirationSelections: selections.inspiration.map((item) => asReference(item._id)),
      customFlavorRequest: flavorPath === 'custom' ? customFlavorRequest : undefined,
      letBakerChooseFlavor: flavorPath === 'surprise',
      customFillingRequest: fillingPath === 'custom' ? customFillingRequest : undefined,
      letBakerChooseFilling: fillingPath === 'surprise',
      referenceImages,
      notes: notes || undefined,
      calculatedTotal,
      status: 'new',
      createdAt: new Date().toISOString(),
      notificationStatus: 'pending',
    });

    const rows = orderRows([
      ['Customer', customerName],
      ['Event date', eventDate],
      ['Email', email],
      ['Phone', phone],
      ['Size', selections.size.name],
      ['Tiers', selections.tier?.label],
      ['Flavor', flavorPath === 'surprise' ? "Baker's choice" : customFlavorRequest],
      ['Filling', fillingPath === 'surprise' ? "Baker's choice" : customFillingRequest],
      ['Frosting', selections.frosting?.name],
      ['Add-ons', selections.addOns.map((addOn) => addOn.name).filter(Boolean).join(', ') || 'None'],
      ['Inspiration', selections.inspiration.map((item) => item.caption).filter(Boolean).join(', ') || 'None'],
      ['Reference images', imageFiles.map((file) => file.name).join(', ') || 'None'],
      ['Notes', notes],
      ['Starting estimate', dollars(calculatedTotal)],
    ]);
    const studioUrl = import.meta.env.SANITY_STUDIO_URL?.replace(/\/$/, '');
    const orderLink = studioUrl ? `${studioUrl}/structure/cakeOrder;${order._id}` : '';

    try {
      await sendBrevoEmail(brevoApiKey, {
        sender: { name: 'Star Sweets', email: fromEmail },
        to: notificationEmail.split(',').map((address) => address.trim()).filter(Boolean).map((address) => ({ email: address })),
        replyTo: email ? { email } : undefined,
        subject: `New cake request from ${customerName} for ${eventDate}`,
        htmlContent: `<h1 style="color:#8c1a1a">New Star Sweets cake request</h1><table>${rows}</table>${orderLink ? `<p><a href="${escapeHtml(orderLink)}">Open this order in Sanity Studio</a></p>` : ''}`,
      });

      if (email) {
        try {
          await sendBrevoEmail(brevoApiKey, {
            sender: { name: 'Star Sweets', email: fromEmail },
            to: [{ email, name: customerName }],
            subject: 'Star Sweets received your cake request',
            htmlContent: `<h1 style="color:#8c1a1a">Your cake request is in!</h1><p>Thanks for reaching out to Star Sweets. I received your request for ${escapeHtml(eventDate)} and will follow up soon to confirm the details and final price.</p><p>Your current starting estimate is <strong>${escapeHtml(dollars(calculatedTotal))}</strong>.</p>`,
          });
        } catch (error) {
          console.error('Customer confirmation email failed:', error instanceof Error ? error.message : error);
        }
      }

      await client.patch(order._id).set({ notificationStatus: 'sent' }).unset(['notificationError']).commit();
    } catch (error) {
      const notificationError = error instanceof Error ? error.message.slice(0, 500) : 'Unknown email delivery error.';
      console.error('Order notification failed:', notificationError);
      await client.patch(order._id).set({ notificationStatus: 'failed', notificationError }).commit();
    }

    return json({ message: 'Your cake request is in. Star Sweets will be in touch soon.' }, 201);
  } catch (error) {
    if (error instanceof FormError) return json({ error: error.message }, 400);
    console.error('Cake order submission failed:', error);
    return json({ error: 'Unable to send your request right now. Please try again shortly.' }, 500);
  }
};
