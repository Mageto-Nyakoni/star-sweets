import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';
import { readBakeryOrder } from '../../data/bakeryMenu';
import { cakeSizeHasNoCustomizations } from '../../lib/orderRules';
import { adminEmailTemplate, customerEmailTemplate, dollars, orderRows, type OrderEmailRow } from '../../lib/orderEmails';

export const prerender = false;

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_INSPIRATION_SELECTIONS = 3;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_EVENT_LEAD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CUSTOMIZATION_PRICE = 10;
const MAX_SUBMISSIONS_PER_HOUR = 5;
const SUBMISSION_LEASE_MS = 2 * 60 * 1000;
const IDEMPOTENCY_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAKE_FLAVOR_LABELS = {
  vanilla: 'Vanilla',
  chocolate: 'Chocolate',
  'red-velvet': 'Red Velvet',
  custom: 'Custom Cake Flavor',
} as const;
const FROSTING_FLAVOR_LABELS = {
  'vanilla-swiss-meringue': 'Vanilla Swiss meringue buttercream',
  'chocolate-swiss-meringue': 'Chocolate Swiss meringue buttercream',
} as const;
const PICKUP_LOCATION_LABELS = {
  quincy: 'Quincy Center',
  fenway: 'Fenway',
} as const;
const PRODUCTION_ORDER_ORIGINS = new Set([
  'https://starsweets.co',
  'https://www.starsweets.co',
]);

type CakeSizeOption = {
  _id: string;
  name?: string;
  basePrice?: number;
};

type InspirationOption = {
  _id: string;
  caption?: string;
  inspirationFor?: 'cake' | 'cupcake';
};

type BrevoMessage = {
  sender: { name: string; email: string };
  to: Array<{ email: string; name?: string }>;
  replyTo?: { email: string };
  subject: string;
  htmlContent: string;
};

class FormError extends Error {}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

async function fingerprintSubmission(formData: FormData, secret: string) {
  const entries: Array<string[]> = [];
  for (const [name, value] of formData) {
    if (typeof value === 'string') {
      entries.push([name, value]);
    } else {
      const digest = hex(await crypto.subtle.digest('SHA-256', await value.arrayBuffer()));
      entries.push([name, value.name, value.type, String(value.size), digest]);
    }
  }
  return hmac(JSON.stringify(entries), secret);
}

async function reserveSubmission(client: ReturnType<typeof createClient>, request: Request, secret: string) {
  // Vercel replaces this header with the visitor's IP before the function runs.
  const visitor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const digest = await hmac(visitor, secret);
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const id = `orderRate.${digest}`;
  let counter = await client.createIfNotExists({ _id: id, _type: 'orderSubmissionRate', hour, count: 0 });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (counter.hour === hour && counter.count >= MAX_SUBMISSIONS_PER_HOUR) return false;
    try {
      const patch = client.patch(id).ifRevisionId(counter._rev);
      await (counter.hour === hour
        ? patch.inc({ count: 1 })
        : patch.set({ hour, count: 1 })).commit();
      return true;
    } catch (error) {
      if (!isConflict(error)) throw error;
      const latest = await client.getDocument<typeof counter>(id);
      if (!latest) throw new Error('Order submission counter disappeared.');
      counter = latest;
    }
  }
  throw new Error('Order submission counter was too busy.');
}

async function acquireSubmissionLease(
  client: ReturnType<typeof createClient>,
  requestId: string,
  fingerprint: string
): Promise<'acquired' | 'processing' | 'different'> {
  const id = `orderAttempt.${requestId}`;
  const claim = crypto.randomUUID();
  let attempt = await client.createIfNotExists({
    _id: id,
    _type: 'orderSubmissionAttempt',
    fingerprint,
    claim,
    leaseExpiresAt: Date.now() + SUBMISSION_LEASE_MS,
  });

  for (let retry = 0; retry < 20; retry += 1) {
    if (attempt.claim === claim) return 'acquired';
    if (attempt.fingerprint !== fingerprint) return 'different';
    if (attempt.leaseExpiresAt > Date.now()) return 'processing';
    try {
      await client.patch(id).ifRevisionId(attempt._rev).set({
        claim,
        leaseExpiresAt: Date.now() + SUBMISSION_LEASE_MS,
      }).commit();
      return 'acquired';
    } catch (error) {
      if (!isConflict(error)) throw error;
      const latest = await client.getDocument<typeof attempt>(id);
      if (!latest) throw new Error('Order submission lease disappeared.');
      attempt = latest;
    }
  }
  throw new Error('Order submission lease was too busy.');
}

function isConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = 'statusCode' in error ? error.statusCode : 'status' in error ? error.status : undefined;
  return status === 409;
}

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
  return [...new Set(formData.getAll(name).filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function checkboxValue(formData: FormData, name: string) {
  const value = formData.get(name);
  if (value === null) return false;
  if (value !== 'yes') throw new FormError('One or more customization selections are invalid.');
  return true;
}

function asReference(id: string) {
  return { _type: 'reference', _ref: id };
}

function sanityArrayKey() {
  return crypto.randomUUID().replaceAll('-', '');
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
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return new Date(today + MIN_EVENT_LEAD_DAYS * MS_PER_DAY);
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

async function getOrderSelections(
  client: ReturnType<typeof createClient>,
  sizeId: string,
  inspirationIds: string[],
  cupcakeInspirationIds: string[]
) {
  const [size, inspiration] = await Promise.all([
    sizeId ? client.fetch<CakeSizeOption | null>(
      `*[_type == "cakeSize" && _id == $id && isActive != false][0]{_id, name, basePrice}`,
      { id: sizeId }
    ) : Promise.resolve(null),
    client.fetch<InspirationOption[]>(
      `*[_type == "inspirationGallery" && _id in $ids && isActive != false]{_id, caption, "inspirationFor": coalesce(inspirationFor, "cake")}`,
      { ids: [...new Set([...inspirationIds, ...cupcakeInspirationIds])] }
    ),
  ]);
  if (sizeId && !size) throw new FormError('Choose a currently available cake size.');
  const byId = new Map(inspiration.map((item) => [item._id, item]));
  const cakeInspiration = inspirationIds.map((id) => byId.get(id));
  const cupcakeInspiration = cupcakeInspirationIds.map((id) => byId.get(id));
  if (cakeInspiration.some((item) => item?.inspirationFor !== 'cake')
    || cupcakeInspiration.some((item) => item?.inspirationFor !== 'cupcake')) {
    throw new FormError('One or more inspiration selections are no longer available.');
  }
  return {
    size,
    inspiration: cakeInspiration as InspirationOption[],
    cupcakeInspiration: cupcakeInspiration as InspirationOption[],
  };
}

function imageFilesFrom(formData: FormData, name: string) {
  const files = formData.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_IMAGES) throw new FormError(`Please attach no more than ${MAX_IMAGES} images for each item.`);
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new FormError(`${file.name} must be a PNG, JPG, or WebP image.`);
    if (file.size > MAX_IMAGE_BYTES) throw new FormError(`${file.name} must be 2 MB or smaller.`);
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_IMAGE_BYTES) {
    throw new FormError('Reference images must be 4 MB or smaller in total for each item.');
  }
  return files;
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
    return json({ error: 'The form is temporarily unavailable. Please contact Emily directly.' }, 503);
  }

  try {
    const formData = await request.formData();
    if (textValue(formData, 'website')) return json({ message: 'Thanks!' });
    const requestId = request.headers.get('idempotency-key')?.toLowerCase();
    if (!requestId || !IDEMPOTENCY_KEY_RE.test(requestId)) {
      throw new FormError('Please refresh the order form and try again.');
    }

    const customerName = textValue(formData, 'customerName', 120);
    const eventDate = textValue(formData, 'eventDate', 10);
    const email = textValue(formData, 'email', 254).toLowerCase();
    const phone = textValue(formData, 'phone', 80);
    const bostonMetroConfirmed = formData.getAll('bostonMetroConfirmed').length === 1
      && formData.get('bostonMetroConfirmed') === 'yes';
    const pickupLocation = textValue(formData, 'pickupLocation', 20);
    const cakeFlavor = textValue(formData, 'cakeFlavor', 20);
    const frostingFlavor = textValue(formData, 'frostingFlavor', 40);
    const customFlavorRequest = textValue(formData, 'customFlavorRequest');
    const cakeInspirationComments = textValue(formData, 'cakeInspirationComments');
    const cupcakeInspirationComments = textValue(formData, 'cupcakeInspirationComments');
    const flowers = checkboxValue(formData, 'flowers');
    const flowersRequest = textValue(formData, 'flowersRequest');
    const specializedDesign = checkboxValue(formData, 'specializedDesign');
    const specializedDesignRequest = textValue(formData, 'specializedDesignRequest');
    const customFilling = checkboxValue(formData, 'customFilling');
    const customFillingRequest = textValue(formData, 'customFillingRequest');
    const customButtercream = checkboxValue(formData, 'customButtercream');
    const customButtercreamRequest = textValue(formData, 'customButtercreamRequest');
    const sizeId = textValue(formData, 'cakeSize', 100);
    const inspirationIds = uniqueValues(formData, 'inspirationSelections');
    const cupcakeInspirationIds = uniqueValues(formData, 'cupcakeInspirationSelections');

    let bakeryOrder: ReturnType<typeof readBakeryOrder>;
    try {
      bakeryOrder = readBakeryOrder(formData);
    } catch (error) {
      throw new FormError(error instanceof Error ? error.message : 'Invalid bakery selections.');
    }
    if (!customerName || !eventDate) throw new FormError('Please complete your name and event date.');
    if (!bostonMetroConfirmed) throw new FormError('Confirm you can pick up in the location selected.');
    if (!Object.hasOwn(PICKUP_LOCATION_LABELS, pickupLocation)) {
      throw new FormError('Choose Quincy Center or Fenway for pickup.');
    }
    if (!sizeId && !bakeryOrder.items.length) throw new FormError('Choose at least one item to order.');
    if (inspirationIds.length > MAX_INSPIRATION_SELECTIONS) {
      throw new FormError(`Please choose no more than ${MAX_INSPIRATION_SELECTIONS} inspiration cakes.`);
    }
    if (cupcakeInspirationIds.length > MAX_INSPIRATION_SELECTIONS) {
      throw new FormError(`Please choose no more than ${MAX_INSPIRATION_SELECTIONS} inspiration cupcakes.`);
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new FormError('Please provide a mobile number with 10 to 15 digits for order updates by text.');
    }
    if (email && !EMAIL_RE.test(email)) throw new FormError('Please enter a valid email address.');
    const parsedEventDate = dateOnlyToUtc(eventDate);
    if (!parsedEventDate) throw new FormError('Please choose a valid event date.');
    const firstAvailableEventDate = minimumEventDate();
    if (parsedEventDate < firstAvailableEventDate) {
      throw new FormError(`Please choose an event date at least one week away (${formatDateOnly(firstAvailableEventDate)} or later).`);
    }

    const imageFiles = imageFilesFrom(formData, 'referenceImages');
    const cupcakeImageFiles = imageFilesFrom(formData, 'cupcakeReferenceImages');
    if ([...imageFiles, ...cupcakeImageFiles].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_IMAGE_BYTES) {
      throw new FormError('Reference images must be 4 MB or smaller in total for your order.');
    }
    const hasCupcakes = bakeryOrder.items.some((item) => item.productId === 'cupcakes-dozen');
    if (!hasCupcakes && (cupcakeInspirationIds.length || cupcakeImageFiles.length || cupcakeInspirationComments)) {
      throw new FormError('Cupcake inspiration requires a cupcake order.');
    }

    const client = createClient({
      projectId,
      dataset,
      apiVersion,
      token: writeToken,
      useCdn: false,
    });
    const orderId = `cakeOrder.${requestId}`;
    const submissionFingerprint = await fingerprintSubmission(formData, writeToken);
    const existingOrder = await client.getDocument(orderId);
    if (existingOrder) {
      if (existingOrder.submissionFingerprint !== submissionFingerprint) {
        return json({ error: 'This request was already used for a different order. Please refresh the form and try again.' }, 409);
      }
      return json({ message: "Your request is in. Emily will text you within 24 hours to discuss the details, final price, and payment." }, 201);
    }
    if (!await reserveSubmission(client, request, writeToken)) {
      return json({ error: 'Too many order requests right now. Please try again later or contact Emily directly.' }, 429);
    }
    const { size, inspiration, cupcakeInspiration } = await getOrderSelections(client, sizeId, inspirationIds, cupcakeInspirationIds);
    const customizationsRestricted = !size || cakeSizeHasNoCustomizations(size.name);

    if (customizationsRestricted) {
      const hasCustomizations = Boolean(
        cakeFlavor
        || frostingFlavor
        || customFlavorRequest
        || cakeInspirationComments
        || flowers
        || flowersRequest
        || specializedDesign
        || specializedDesignRequest
        || customFilling
        || customFillingRequest
        || customButtercream
        || customButtercreamRequest
        || inspirationIds.length
        || imageFiles.length
      );
      if (hasCustomizations) {
        throw new FormError(size
          ? 'The 4 inch, 2 layer cake does not support additional customizations.'
          : 'Cake customizations require a cake order.');
      }
    } else {
      if (!Object.hasOwn(CAKE_FLAVOR_LABELS, cakeFlavor)) throw new FormError('Please choose a cake flavor.');
      if (!Object.hasOwn(FROSTING_FLAVOR_LABELS, frostingFlavor)) throw new FormError('Please choose a frosting flavor.');
      if (cakeFlavor === 'custom' && !customFlavorRequest) throw new FormError('Please describe your custom cake flavor.');
      if (cakeFlavor !== 'custom' && customFlavorRequest) throw new FormError('Custom flavor details require the custom cake flavor option.');
      if (flowers && !flowersRequest) throw new FormError('Please add details for flowers.');
      if (!flowers && flowersRequest) throw new FormError('Flower details require the flowers option.');
      if (specializedDesign && !specializedDesignRequest) throw new FormError('Please add specialized design details.');
      if (!specializedDesign && specializedDesignRequest) throw new FormError('Design details require the specialized design option.');
      if (customFilling && !customFillingRequest) throw new FormError('Please describe your custom filling.');
      if (!customFilling && customFillingRequest) throw new FormError('Filling details require the custom filling option.');
      if (customButtercream && !customButtercreamRequest) throw new FormError('Please describe your custom buttercream.');
      if (!customButtercream && customButtercreamRequest) throw new FormError('Buttercream details require the custom buttercream option.');
    }

    const selectedCustomizationCount = customizationsRestricted
      ? 0
      : [cakeFlavor === 'custom', flowers, specializedDesign, customFilling, customButtercream]
        .filter(Boolean).length;
    const calculatedTotal = Math.round((
      Number(size?.basePrice || 0) + selectedCustomizationCount * CUSTOMIZATION_PRICE + bakeryOrder.subtotal
    ) * 100) / 100;

    const lease = await acquireSubmissionLease(client, requestId, submissionFingerprint);
    if (lease === 'different') {
      return json({ error: 'This request was already used for a different order. Please refresh the form and try again.' }, 409);
    }
    if (lease === 'processing') {
      return json({ error: 'Your request is still being saved. Please try again in two minutes.' }, 409);
    }

    const referenceImages = await Promise.all(imageFiles.map(async (file) => {
      const asset = await client.assets.upload('image', new Blob([await file.arrayBuffer()], { type: file.type }), {
        filename: file.name,
        contentType: file.type,
      });
      return { _key: sanityArrayKey(), _type: 'image', asset: asReference(asset._id) };
    }));
    const cupcakeReferenceImages = await Promise.all(cupcakeImageFiles.map(async (file) => {
      const asset = await client.assets.upload('image', new Blob([await file.arrayBuffer()], { type: file.type }), {
        filename: file.name,
        contentType: file.type,
      });
      return { _key: sanityArrayKey(), _type: 'image', asset: asReference(asset._id) };
    }));

    const submissionClaim = crypto.randomUUID();
    const order = await client.createIfNotExists({
      _id: orderId,
      _type: 'cakeOrder',
      submissionFingerprint,
      submissionClaim,
      customerName,
      email: email || undefined,
      phone: phone || undefined,
      eventDate,
      bostonMetroConfirmed,
      pickupLocation,
      cakeSize: size ? asReference(size._id) : undefined,
      bakeryItems: bakeryOrder.items.map((item) => ({ _type: 'bakeryOrderItem', _key: sanityArrayKey(), ...item })),
      cupcakeFlavor: bakeryOrder.cupcakeFlavor,
      cupcakeVisualSuggestions: bakeryOrder.cupcakeVisualSuggestions,
      cupcakeInspirationComments: cupcakeInspirationComments || undefined,
      cupcakeInspirationSelections: cupcakeInspiration.map((item) => ({
        _key: sanityArrayKey(),
        ...asReference(item._id),
      })),
      cupcakeReferenceImages,
      pricingPending: bakeryOrder.pricingPending,
      cakeFlavor: customizationsRestricted ? undefined : cakeFlavor,
      frostingFlavor: customizationsRestricted ? undefined : frostingFlavor,
      customFlavorRequest: cakeFlavor === 'custom' ? customFlavorRequest : undefined,
      flowers,
      flowersRequest: flowers ? flowersRequest : undefined,
      specializedDesign,
      specializedDesignRequest: specializedDesign ? specializedDesignRequest : undefined,
      customFilling,
      customFillingRequest: customFilling ? customFillingRequest : undefined,
      customButtercream,
      customButtercreamRequest: customButtercream ? customButtercreamRequest : undefined,
      inspirationSelections: inspiration.map((item) => ({
        _key: sanityArrayKey(),
        ...asReference(item._id),
      })),
      cakeInspirationComments: cakeInspirationComments || undefined,
      referenceImages,
      calculatedTotal,
      status: 'new',
      createdAt: new Date().toISOString(),
      notificationStatus: 'pending',
    });
    if (order.submissionClaim !== submissionClaim) {
      if (order.submissionFingerprint !== submissionFingerprint) {
        return json({ error: 'This request was already used for a different order. Please refresh the form and try again.' }, 409);
      }
      return json({ message: "Your request is in. Emily will text you within 24 hours to discuss the details, final price, and payment." }, 201);
    }

    const details: OrderEmailRow[] = [
      ['Customer', customerName],
      ['Event date', eventDate],
      ['Pickup confirmation', 'The customer confirmed pickup at the selected location'],
      ['Pickup location', PICKUP_LOCATION_LABELS[pickupLocation as keyof typeof PICKUP_LOCATION_LABELS]],
      ['Email', email],
      ['Phone', phone],
      ...bakeryOrder.items.map((item): [string, string] => [
        `${item.quantity} × ${item.name} (${item.portion})`,
        item.lineTotal === null ? 'Price TBD' : `${dollars(item.unitPrice!)} each · ${dollars(item.lineTotal)}`,
      ]),
      ['Cupcake flavor', bakeryOrder.cupcakeFlavor],
      ['Cupcake visual suggestions', bakeryOrder.cupcakeVisualSuggestions],
      ...(hasCupcakes ? [
        ['Cupcake inspiration', cupcakeInspiration.map((item) => item.caption).filter(Boolean).join(', ') || 'None'],
        ['Cupcake inspiration comments', cupcakeInspirationComments],
        ['Cupcake reference photos', cupcakeImageFiles.map((file) => file.name).join(', ') || 'None'],
      ] as Array<[string, string | undefined]> : []),
      ...(size ? [
        ['Size', size.name],
        ['Cake flavor', customizationsRestricted ? 'Offered as-is' : CAKE_FLAVOR_LABELS[cakeFlavor as keyof typeof CAKE_FLAVOR_LABELS]],
        ['Frosting flavor', customizationsRestricted ? 'Offered as-is' : FROSTING_FLAVOR_LABELS[frostingFlavor as keyof typeof FROSTING_FLAVOR_LABELS]],
        ['Custom flavor', cakeFlavor === 'custom' ? customFlavorRequest : undefined],
        ['Flowers', flowers ? flowersRequest : 'None'],
        ['Specialized designs', specializedDesign ? specializedDesignRequest : 'None'],
        ['Custom filling', customFilling ? customFillingRequest : 'None'],
        ['Custom buttercream', customButtercream ? customButtercreamRequest : 'None'],
        ['Inspiration', inspiration.map((item) => item.caption).filter(Boolean).join(', ') || 'None'],
        ['Cake inspiration comments', cakeInspirationComments],
        ['Reference photos', imageFiles.map((file) => file.name).join(', ') || 'None'],
      ] as Array<[string, string | undefined]> : []),
      [bakeryOrder.pricingPending ? 'Priced subtotal' : 'Starting estimate',
        bakeryOrder.pricingPending
          ? `${dollars(calculatedTotal)} · Baker’s Choice price TBD, excluded from subtotal`
          : dollars(calculatedTotal)],
    ];
    const rows = orderRows(details);
    const studioUrl = import.meta.env.SANITY_STUDIO_URL?.replace(/\/$/, '');
    const orderLink = studioUrl ? `${studioUrl}/structure/cakeOrder;${order._id}` : '';

    try {
      await sendBrevoEmail(brevoApiKey, {
        sender: { name: 'Star Sweets', email: fromEmail },
        to: String(notificationEmail).split(',').map((address) => address.trim()).filter(Boolean).map((address) => ({ email: address })),
        replyTo: email ? { email } : undefined,
        subject: `New order request from ${customerName} for ${eventDate}`,
        htmlContent: adminEmailTemplate({ customerName, eventDate, rows, orderLink }),
      });

      if (email) {
        try {
          await sendBrevoEmail(brevoApiKey, {
            sender: { name: 'Star Sweets', email: fromEmail },
            to: [{ email, name: customerName }],
            subject: 'Your Request Is In! | Star Sweets',
            htmlContent: customerEmailTemplate({ customerName, eventDate, calculatedTotal, pricingPending: bakeryOrder.pricingPending, details }),
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

    return json({ message: "Your request is in. Emily will text you within 24 hours to discuss the details, final price, and payment." }, 201);
  } catch (error) {
    if (error instanceof FormError) return json({ error: error.message }, 400);
    console.error('Order submission failed:', error);
    return json({ error: 'Unable to send your request right now. Please try again shortly.' }, 500);
  }
};
