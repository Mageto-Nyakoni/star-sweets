import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { bakeryMenu, readBakeryOrder } from '../src/data/bakeryMenu.ts';
import { cakeSizeHasNoCustomizations } from '../src/lib/orderRules.ts';

const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry === null || entry === undefined) continue;
      if (entry instanceof Blob) data.append(key, entry, entry.name || 'reference.png');
      else data.append(key, String(entry));
    }
  }
  return data;
};

test('bakery prices, portions, and cents match the requested menu', () => {
  assert.equal(bakeryMenu.length, 18);
  assert.deepEqual(bakeryMenu.map(({ price }) => price), [36, 12, 12, 12, 12, 12, null, 6, 12, 7.5, 15, 9, 18, 3, 27, 18, 3.25, 3.5]);
  const order = readBakeryOrder(form({
    'quantity-pumpkin-bread-half': 1,
    'quantity-chocolate-chip-muffin': 3,
    'quantity-lemon-loaf': 1,
    calculatedTotal: 0.01,
  }));
  assert.equal(order.subtotal, 20.75);
  assert.equal(order.pricingPending, false);
});

test('the live 4 inch round cake is offered as-is', () => {
  assert.equal(cakeSizeHasNoCustomizations('4 inch, 2 layers (Round)'), true);
});

test('Baker’s Choice remains unpriced, including an order of only Baker’s Choice', () => {
  const order = readBakeryOrder(form({ 'quantity-cookies-bakers-choice': 2 }));
  assert.equal(order.pricingPending, true);
  assert.equal(order.items[0].unitPrice, null);
  assert.equal(order.items[0].lineTotal, null);
});

test('invalid quantities and unsupported cupcake flavors are rejected', () => {
  for (const quantity of ['-1', '1.5', '100', 'NaN', '1e2', '']) {
    assert.throws(() => readBakeryOrder(form({ 'quantity-brownie-single': quantity })));
  }
  for (const flavor of ['', 'red-velvet', 'custom']) {
    assert.throws(() => readBakeryOrder(form({ 'quantity-cupcakes-dozen': 1, cupcakeFlavor: flavor })));
  }
  assert.throws(() => readBakeryOrder(form({ 'quantity-brownie-single': 1, cupcakeVisualSuggestions: 'change flavor' })));
  const duplicate = form({ 'quantity-brownie-single': 1 });
  duplicate.append('quantity-brownie-single', '2');
  assert.throws(() => readBakeryOrder(duplicate));
});

// Load the actual route with isolated storage/email doubles. No external requests occur.
let routeSource = await readFile(new URL('../src/pages/api/orders.ts', import.meta.url), 'utf8');
routeSource = routeSource
  .replace("import { createClient } from '@sanity/client';", 'const createClient = () => globalThis.__starSweetsTestClient;')
  .replace("'../../data/bakeryMenu'", JSON.stringify(new URL('../src/data/bakeryMenu.ts', import.meta.url).href))
  .replace("'../../lib/orderRules'", JSON.stringify(new URL('../src/lib/orderRules.ts', import.meta.url).href))
  .replace("'../../lib/orderEmails'", JSON.stringify(new URL('../src/lib/orderEmails.ts', import.meta.url).href))
  .replaceAll('import.meta.env', JSON.stringify({
    SANITY_PROJECT_ID: 'test', SANITY_WRITE_TOKEN: 'test', BREVO_API_KEY: 'test',
    BREVO_FROM_EMAIL: 'test@example.com', ORDER_NOTIFICATION_EMAIL: 'test@example.com',
  }));
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(routeSource)).toString('base64')}`);

const newState = () => ({ saved: [], emails: [], uploads: [], documents: new Map() });

async function submit(fields, origin = 'http://localhost:4321', options = {}) {
  const state = options.state || newState();
  const { saved, emails, uploads, documents } = state;
  globalThis.__starSweetsTestClient = {
    fetch: async (query, params) => query.includes('cakeSize')
      ? params.id === 'missing' ? null : { _id: params.id, name: params.id === 'restricted' ? '4 inch, 2 layers (Round)' : '6 inch, 3 layers', basePrice: 75 }
      : params.ids.flatMap((id) => ({
        'cake-style': [{ _id: id, caption: 'Pink cake', inspirationFor: 'cake' }],
        'cake-legacy': [{ _id: id, caption: 'Legacy cake', inspirationFor: 'cake' }],
        'cupcake-style': [{ _id: id, caption: 'Pink cupcakes', inspirationFor: 'cupcake' }],
      })[id] || []),
    assets: { upload: async (_kind, _body, options) => {
      uploads.push(options.filename);
      if (state.failNextUpload) {
        state.failNextUpload = false;
        throw new Error('Test upload interrupted');
      }
      return { _id: `image-${uploads.length}` };
    } },
    getDocument: async (id) => documents.get(id) || null,
    createIfNotExists: async (doc) => {
      if (documents.has(doc._id)) return documents.get(doc._id);
      const created = { ...doc, _rev: 'rev-1' };
      documents.set(doc._id, created);
      if (doc._type === 'cakeOrder') saved.push(created);
      return created;
    },
    patch: (id) => {
      let expectedRevision;
      let additions = {};
      let changes = {};
      let removals = [];
      return {
        ifRevisionId(revision) { expectedRevision = revision; return this; },
        inc(values) { additions = values; return this; },
        set(values) { changes = values; return this; },
        unset(values) { removals = values; return this; },
        async commit() {
          const doc = documents.get(id);
          if (expectedRevision && expectedRevision !== doc._rev) throw { statusCode: 409 };
          for (const [key, value] of Object.entries(additions)) doc[key] += value;
          Object.assign(doc, changes);
          for (const key of removals) delete doc[key];
          doc._rev = `rev-${Number(doc._rev.slice(4)) + 1}`;
          return doc;
        },
      };
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    emails.push(JSON.parse(options.body));
    return new Response('{}', { status: 201 });
  };
  try {
    const response = await POST({ request: new Request('http://localhost:4321/api/orders', {
      method: 'POST', headers: {
        origin,
        'x-forwarded-for': options.ip || '203.0.113.42',
        ...(options.key === null ? {} : { 'Idempotency-Key': options.key || randomUUID() }),
      }, body: form({
        customerName: 'Test Customer', eventDate: '2099-12-31', email: 'customer@example.com', phone: '617-555-0100',
        bostonMetroConfirmed: 'yes', pickupLocation: 'quincy',
        frostingFlavor: fields.cakeSize && fields.cakeSize !== 'restricted' ? 'vanilla-swiss-meringue' : undefined,
        ...fields,
      }),
    }) });
    return { status: response.status, result: await response.json(), saved, emails, uploads, state };
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__starSweetsTestClient;
  }
}

test('bakery-only orders save quantities, cents, and details in both emails', async () => {
  const result = await submit({ 'quantity-chocolate-chip-muffin': 3, 'quantity-pumpkin-bread-half': 1 });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.equal(result.saved[0].cakeSize, undefined);
  assert.equal(result.saved[0].calculatedTotal, 17.25);
  assert.equal(result.saved[0].bakeryItems.length, 2);
  assert.equal(result.emails.length, 2);
  for (const email of result.emails) {
    assert.match(email.htmlContent, /3 × Chocolate Chip Muffin/);
    assert.match(email.htmlContent, /\$17\.25/);
  }
});

test('pickup confirmation and choice are saved and sent in both emails', async () => {
  for (const [location, label] of [['quincy', 'Quincy Center'], ['fenway', 'Fenway']]) {
    const result = await submit({ 'quantity-brownie-single': 1, pickupLocation: location });
    assert.equal(result.status, 201, JSON.stringify(result.result));
    assert.equal(result.saved[0].bostonMetroConfirmed, true);
    assert.equal(result.saved[0].pickupLocation, location);
    assert.match(result.emails[0].htmlContent, /The customer confirmed pickup at the selected location/);
    for (const email of result.emails) {
      assert.match(email.htmlContent, new RegExp(`Pickup location<\\/strong><\\/td><td[^>]*>${label}`));
    }
  }
});

test('orders require pickup confirmation and a valid pickup location', async () => {
  for (const fields of [
    { bostonMetroConfirmed: null },
    { bostonMetroConfirmed: 'no' },
    { pickupLocation: null },
    { pickupLocation: 'boston' },
  ]) {
    const result = await submit({ 'quantity-brownie-single': 1, ...fields });
    assert.equal(result.status, 400, JSON.stringify({ fields, result: result.result }));
    assert.equal(result.saved.length, 0);
    assert.equal(result.emails.length, 0);
  }
});

test('orders submit without allergy fields and omit allergy notes from notifications', async () => {
  const result = await submit({ 'quantity-brownie-single': 1 });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.equal(result.saved[0].allergyStatus, undefined);
  assert.equal(result.saved[0].allergyDetails, undefined);
  for (const email of result.emails) {
    assert.doesNotMatch(email.htmlContent, /Allergies and dietary needs/);
    assert.match(email.htmlContent, /within 24 hours/);
  }
  assert.match(result.emails[1].htmlContent, /payment arrangements/);
  assert.match(result.emails[1].htmlContent, /agree by text/);
});

test('a valid text number is required', async () => {
  for (const fields of [
    { phone: null },
    { phone: '555' },
  ]) {
    const result = await submit({ 'quantity-brownie-single': 1, ...fields });
    assert.equal(result.status, 400, JSON.stringify({ fields, result: result.result }));
    assert.equal(result.saved.length, 0);
    assert.equal(result.emails.length, 0);
  }
});

test('cupcake visual suggestions are saved and escaped in notifications', async () => {
  const result = await submit({ 'quantity-cupcakes-dozen': 2, cupcakeFlavor: 'chocolate', cupcakeVisualSuggestions: '<pink> stars' });
  assert.equal(result.status, 201);
  assert.equal(result.saved[0].calculatedTotal, 72);
  assert.equal(result.saved[0].cupcakeFlavor, 'chocolate');
  assert.equal(result.saved[0].cupcakeVisualSuggestions, '<pink> stars');
  assert.match(result.emails[0].htmlContent, /&lt;pink&gt; stars/);
});

test('cupcake inspiration and uploads appear in Sanity and both emails', async () => {
  const image = new File([new Uint8Array([1, 2, 3])], 'cupcakes.png', { type: 'image/png' });
  const result = await submit({
    'quantity-cupcakes-dozen': 1,
    cupcakeFlavor: 'vanilla',
    cupcakeInspirationSelections: 'cupcake-style',
    cupcakeReferenceImages: image,
    cupcakeInspirationComments: '<pink> stars with less piping',
  });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.equal(result.saved[0].cupcakeInspirationSelections[0]._ref, 'cupcake-style');
  assert.equal(result.saved[0].cupcakeReferenceImages[0].asset._ref, 'image-1');
  assert.equal(result.saved[0].cupcakeInspirationComments, '<pink> stars with less piping');
  assert.deepEqual(result.uploads, ['cupcakes.png']);
  for (const email of result.emails) {
    assert.match(email.htmlContent, /Pink cupcakes/);
    assert.match(email.htmlContent, /cupcakes\.png/);
    assert.match(email.htmlContent, /&lt;pink&gt; stars with less piping/);
  }
});

test('cake and cupcake inspiration stay with the matching order items', async () => {
  const result = await submit({
    cakeSize: 'regular', cakeFlavor: 'vanilla',
    'quantity-cupcakes-dozen': 1, cupcakeFlavor: 'chocolate',
    inspirationSelections: 'cake-style',
    cakeInspirationComments: 'Use the shape, but make it blue',
    cupcakeInspirationSelections: 'cupcake-style',
  });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.equal(result.saved[0].inspirationSelections[0]._ref, 'cake-style');
  assert.equal(result.saved[0].cakeInspirationComments, 'Use the shape, but make it blue');
  assert.equal(result.saved[0].cupcakeInspirationSelections[0]._ref, 'cupcake-style');
  for (const email of result.emails) assert.match(email.htmlContent, /Use the shape, but make it blue/);
  const legacy = await submit({ cakeSize: 'regular', cakeFlavor: 'vanilla', inspirationSelections: 'cake-legacy' });
  assert.equal(legacy.status, 201);
});

test('frosting choices are saved and included in both emails', async () => {
  for (const [value, label] of [
    ['vanilla-swiss-meringue', 'Vanilla Swiss meringue buttercream'],
    ['chocolate-swiss-meringue', 'Chocolate Swiss meringue buttercream'],
  ]) {
    const result = await submit({ cakeSize: 'regular', cakeFlavor: 'vanilla', frostingFlavor: value });
    assert.equal(result.status, 201, JSON.stringify(result.result));
    assert.equal(result.saved[0].frostingFlavor, value);
    for (const email of result.emails) assert.match(email.htmlContent, new RegExp(label));
  }
  for (const frostingFlavor of [null, 'strawberry']) {
    const result = await submit({ cakeSize: 'regular', cakeFlavor: 'vanilla', frostingFlavor });
    assert.equal(result.status, 400);
    assert.equal(result.saved.length, 0);
  }
});

test('event date must be at least one week ahead in Boston', async () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const dateAfter = (days) => new Date(today + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const early = await submit({ 'quantity-brownie-single': 1, eventDate: dateAfter(6) });
  assert.equal(early.status, 400);
  assert.match(early.result.error, /at least one week away/);
  const onTime = await submit({ 'quantity-brownie-single': 1, eventDate: dateAfter(7) });
  assert.equal(onTime.status, 201);
});

test('cupcake inspiration is rejected without cupcakes or with a cake photo', async () => {
  for (const fields of [
    { 'quantity-brownie-single': 1, cupcakeInspirationSelections: 'cupcake-style' },
    { 'quantity-brownie-single': 1, cupcakeInspirationComments: 'Make it pink' },
    { 'quantity-cupcakes-dozen': 1, cupcakeFlavor: 'vanilla', cupcakeInspirationSelections: 'cake-style' },
    { cakeSize: 'regular', cakeFlavor: 'vanilla', inspirationSelections: 'cupcake-style' },
    { 'quantity-cupcakes-dozen': 1, cupcakeFlavor: 'vanilla', cupcakeInspirationSelections: ['cupcake-style', 'cake-style'] },
  ]) {
    const result = await submit(fields);
    assert.equal(result.status, 400, JSON.stringify({ fields, result: result.result }));
    assert.equal(result.saved.length, 0);
  }
  const image = new File([new Uint8Array([1])], 'cupcakes.png', { type: 'image/png' });
  const uploadWithoutCupcakes = await submit({ 'quantity-brownie-single': 1, cupcakeReferenceImages: image });
  assert.equal(uploadWithoutCupcakes.status, 400);
  assert.equal(uploadWithoutCupcakes.uploads.length, 0);
});

test('combined cake and cupcake reference images respect the order size limit', async () => {
  const makeImage = (name) => new File([new Uint8Array(1.5 * 1024 * 1024)], name, { type: 'image/png' });
  const result = await submit({
    cakeSize: 'regular', cakeFlavor: 'vanilla',
    'quantity-cupcakes-dozen': 1, cupcakeFlavor: 'vanilla',
    referenceImages: [makeImage('cake-a.png'), makeImage('cake-b.png')],
    cupcakeReferenceImages: makeImage('cupcake.png'),
  });
  assert.equal(result.status, 400);
  assert.equal(result.saved.length, 0);
  assert.equal(result.uploads.length, 0);
});

test('mixed orders retain cake customization pricing', async () => {
  const result = await submit({ cakeSize: 'regular', cakeFlavor: 'vanilla', flowers: 'yes', flowersRequest: 'Pink flowers', 'quantity-brownie-single': 2 });
  assert.equal(result.status, 201);
  assert.equal(result.saved[0].calculatedTotal, 91);
  assert.equal(result.saved[0].cakeSize._ref, 'regular');
});

test('pending prices are clearly identified in saved orders and both emails', async () => {
  const result = await submit({ 'quantity-cookies-bakers-choice': 1 });
  assert.equal(result.status, 201);
  assert.equal(result.saved[0].pricingPending, true);
  for (const email of result.emails) assert.match(email.htmlContent, /price TBD/i);
});

test('empty orders, unavailable sizes, and unauthorized customizations fail before storage', async () => {
  for (const fields of [
    {},
    { cakeSize: 'missing', cakeFlavor: 'vanilla' },
    { 'quantity-brownie-single': 1, flowers: 'yes', flowersRequest: 'Flowers' },
    { 'quantity-cupcakes-dozen': 1, cupcakeFlavor: 'red-velvet' },
    { cakeSize: 'restricted', cakeFlavor: 'vanilla' },
  ]) {
    const result = await submit(fields);
    assert.equal(result.status, 400, JSON.stringify(fields));
    assert.equal(result.saved.length, 0);
    assert.equal(result.emails.length, 0);
  }
  const restricted = await submit({ cakeSize: 'restricted', 'quantity-cupcakes-dozen': 1, cupcakeFlavor: 'vanilla' });
  assert.equal(restricted.status, 201);
  const wrongOrigin = await submit({ 'quantity-brownie-single': 1 }, 'https://untrusted.example');
  assert.equal(wrongOrigin.status, 403);
});

test('a retried request reuses its order without another upload or email', async () => {
  const state = newState();
  const key = randomUUID();
  const image = new File([new Uint8Array([1, 2, 3])], 'cake.png', { type: 'image/png' });
  const fields = { cakeSize: 'regular', cakeFlavor: 'vanilla', referenceImages: image };
  const first = await submit(fields, undefined, { state, key });
  const retry = await submit(fields, undefined, { state, key });
  assert.equal(first.status, 201);
  assert.equal(retry.status, 201);
  assert.equal(state.saved.length, 1);
  assert.equal(state.uploads.length, 1);
  assert.equal(state.emails.length, 2);
  assert.equal(state.saved[0]._id, `cakeOrder.${key}`);
  assert.equal([...state.documents.values()].find((doc) => doc._type === 'orderSubmissionRate').count, 1);

  const changed = await submit({ ...fields, cakeFlavor: 'chocolate' }, undefined, { state, key });
  assert.equal(changed.status, 409);
  assert.equal(state.saved.length, 1);
  assert.equal(state.emails.length, 2);
});

test('a visitor can submit five orders per hour, and another visitor has a separate limit', async () => {
  const state = newState();
  for (let index = 0; index < 5; index += 1) {
    const result = await submit({ 'quantity-brownie-single': 1 }, undefined, { state });
    assert.equal(result.status, 201, JSON.stringify(result.result));
  }
  const limited = await submit({ 'quantity-brownie-single': 1 }, undefined, { state });
  assert.equal(limited.status, 429);
  assert.equal(state.saved.length, 5);
  assert.equal(state.emails.length, 10);
  const differentVisitor = await submit({ 'quantity-brownie-single': 1 }, undefined, { state, ip: '203.0.113.43' });
  assert.equal(differentVisitor.status, 201);
  const firstVisitorCounter = [...state.documents.values()].find((doc) => doc._type === 'orderSubmissionRate' && doc.count === 5);
  firstVisitorCounter.hour -= 1;
  const nextHour = await submit({ 'quantity-brownie-single': 1 }, undefined, { state });
  assert.equal(nextHour.status, 201);
  assert.equal(firstVisitorCounter.count, 1);
});

test('an interrupted upload holds the request briefly, then a retry can finish it', async () => {
  const state = newState();
  state.failNextUpload = true;
  const key = randomUUID();
  const fields = {
    cakeSize: 'regular', cakeFlavor: 'vanilla',
    referenceImages: new File([new Uint8Array([1])], 'cake.png', { type: 'image/png' }),
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  let interrupted;
  try {
    interrupted = await submit(fields, undefined, { state, key });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(interrupted.status, 500);
  const tooSoon = await submit(fields, undefined, { state, key });
  assert.equal(tooSoon.status, 409);
  assert.equal(state.uploads.length, 1);
  assert.equal(state.saved.length, 0);
  const attempt = state.documents.get(`orderAttempt.${key}`);
  attempt.leaseExpiresAt = 0;
  const recovered = await submit(fields, undefined, { state, key });
  assert.equal(recovered.status, 201, JSON.stringify(recovered.result));
  assert.equal(state.saved.length, 1);
  assert.equal(state.emails.length, 2);
});

test('requests without a valid idempotency key are rejected before storage', async () => {
  const missing = await submit({ 'quantity-brownie-single': 1 }, undefined, { key: null });
  assert.equal(missing.status, 400);
  assert.equal(missing.saved.length, 0);
  const invalid = await submit({ 'quantity-brownie-single': 1 }, undefined, { key: 'not-a-uuid' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.saved.length, 0);
});
