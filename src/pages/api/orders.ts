import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';

export const prerender = false;

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_EVENT_LEAD_DAYS = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PRODUCTION_ORDER_ORIGINS = new Set([
  'https://starsweets.co',
  'https://www.starsweets.co',
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

function sanityArrayKey() {
  return crypto.randomUUID().replaceAll('-', '');
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
    .map(([label, value]) => `<tr><td style="width:34%;padding:11px 14px;border-bottom:1px solid #ead8d7;color:#6b2535;font-family:Arial,sans-serif;font-size:13px;line-height:1.45;vertical-align:top"><strong>${escapeHtml(label)}</strong></td><td style="padding:11px 14px;border-bottom:1px solid #ead8d7;color:#3a1520;font-family:Arial,sans-serif;font-size:14px;line-height:1.45;vertical-align:top">${escapeHtml(value || '')}</td></tr>`)
    .join('');
}

function dateOnlyToUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== monthIndex
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function minimumEventDate() {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayUtc + MIN_EVENT_LEAD_DAYS * MS_PER_DAY);
}

function displayEventDate(value: string) {
  const date = dateOnlyToUtc(value);
  if (!date) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function emailShell({
  preheader,
  eyebrow,
  title,
  intro,
  content,
}: {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  content: string;
}) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#faf5ee;color:#3a1520">
    <span style="display:none!important;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#faf5ee">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #ead8d7;border-radius:18px;overflow:hidden">
            <tr>
              <td style="height:7px;background:#8c1a1a;font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 32px 18px">
                <p style="margin:0 0 22px;color:#8c1a1a;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:bold;letter-spacing:.2px">Star Sweets</p>
                <p style="margin:0 0 8px;color:#c4536a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.7px;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0 0 12px;color:#3a1520;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:normal">${escapeHtml(title)}</h1>
                <p style="margin:0;color:#6b2535;font-family:Arial,sans-serif;font-size:15px;line-height:1.65">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 32px 32px">${content}</td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f5eae8;color:#9b7b85;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;text-align:center">Star Sweets &middot; Made thoughtfully for every celebration</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function adminEmailTemplate({
  customerName,
  eventDate,
  rows,
  orderLink,
}: {
  customerName: string;
  eventDate: string;
  rows: string;
  orderLink: string;
}) {
  const formattedDate = displayEventDate(eventDate);
  const studioButton = orderLink
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr><td style="border-radius:999px;background:#8c1a1a"><a href="${escapeHtml(orderLink)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none">Open in Sanity Studio</a></td></tr></table>`
    : '';

  return emailShell({
    preheader: `New cake request from ${customerName} for ${formattedDate}.`,
    eyebrow: 'New cake request',
    title: 'A new celebration is taking shape.',
    intro: `${customerName} sent a cake request for ${formattedDate}. Review the details below and follow up to confirm availability and final pricing.`,
    content: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #ead8d7;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;background:#fffaf7">${rows}</table>${studioButton}`,
  });
}

function customerEmailTemplate({
  customerName,
  eventDate,
  calculatedTotal,
}: {
  customerName: string;
  eventDate: string;
  calculatedTotal: number;
}) {
  const formattedDate = displayEventDate(eventDate);
  const estimate = dollars(calculatedTotal);

  return emailShell({
    preheader: `We received your Star Sweets cake request for ${formattedDate}.`,
    eyebrow: 'Request received',
    title: 'Your cake request is in!',
    intro: `Thanks, ${customerName}. Your request has been received, and I will follow up soon to confirm the details and final price.`,
    content: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:4px 0 18px;border:1px solid #ead8d7;border-radius:12px;border-collapse:separate;border-spacing:0;background:#fffaf7"><tr><td style="padding:16px 18px;border-bottom:1px solid #ead8d7"><p style="margin:0 0 5px;color:#c4536a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase">Event date</p><p style="margin:0;color:#3a1520;font-family:Georgia,'Times New Roman',serif;font-size:19px">${escapeHtml(formattedDate)}</p></td></tr><tr><td style="padding:16px 18px"><p style="margin:0 0 5px;color:#c4536a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase">Starting estimate</p><p style="margin:0;color:#8c1a1a;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold">${escapeHtml(estimate)}</p></td></tr></table><div style="padding:14px 16px;border-left:3px solid #e899b4;background:#fde8ef;color:#6b2535;font-family:Arial,sans-serif;font-size:13px;line-height:1.55">Custom flavors, fillings, sourcing, and design details may affect the final quote. Nothing is confirmed until we follow up with you.</div>`,
  });
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
    const parsedEventDate = dateOnlyToUtc(eventDate);
    if (!parsedEventDate) throw new FormError('Please choose a valid event date.');
    const firstAvailableEventDate = minimumEventDate();
    if (parsedEventDate < firstAvailableEventDate) {
      throw new FormError(`Please choose an event date at least 4 days away (${formatDateOnly(firstAvailableEventDate)} or later).`);
    }
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
      return { _key: sanityArrayKey(), _type: 'image', asset: asReference(asset._id) };
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
      addOns: selections.addOns.map((addOn) => ({
        _key: sanityArrayKey(),
        ...asReference(addOn._id),
      })),
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
        subject: `New Cake request From ${customerName} for ${eventDate}`,
        htmlContent: adminEmailTemplate({ customerName, eventDate, rows, orderLink }),
      });

      if (email) {
        try {
          await sendBrevoEmail(brevoApiKey, {
            sender: { name: 'Star Sweets', email: fromEmail },
            to: [{ email, name: customerName }],
            subject: 'Star Sweets received your cake request',
            htmlContent: customerEmailTemplate({ customerName, eventDate, calculatedTotal }),
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
