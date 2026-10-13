import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { bakeryMenu, readBakeryOrder } from '../src/data/bakeryMenu.ts';

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
  .replaceAll('import.meta.env', JSON.stringify({
    SANITY_PROJECT_ID: 'test', SANITY_WRITE_TOKEN: 'test', BREVO_API_KEY: 'test',
    BREVO_FROM_EMAIL: 'test@example.com', ORDER_NOTIFICATION_EMAIL: 'test@example.com',
  }));
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(routeSource)).toString('base64')}`);

async function submit(fields, origin = 'http://localhost:4321') {
  const saved = [];
  const emails = [];
  const uploads = [];
  globalThis.__starSweetsTestClient = {
    fetch: async (query, params) => query.includes('cakeSize')
      ? params.id === 'missing' ? null : { _id: params.id, name: params.id === 'restricted' ? '4 inch, 2 layers' : '6 inch, 3 layers', basePrice: 75 }
      : params.ids.flatMap((id) => ({
        'cake-style': [{ _id: id, caption: 'Pink cake', inspirationFor: 'cake' }],
        'cake-legacy': [{ _id: id, caption: 'Legacy cake', inspirationFor: 'cake' }],
        'cupcake-style': [{ _id: id, caption: 'Pink cupcakes', inspirationFor: 'cupcake' }],
      })[id] || []),
    assets: { upload: async (_kind, _body, options) => {
      uploads.push(options.filename);
      return { _id: `image-${uploads.length}` };
    } },
    create: async (doc) => { saved.push(doc); return { ...doc, _id: 'test-order' }; },
    patch: () => ({ set() { return this; }, unset() { return this; }, async commit() {} }),
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    emails.push(JSON.parse(options.body));
    return new Response('{}', { status: 201 });
  };
  try {
    const response = await POST({ request: new Request('http://localhost:4321/api/orders', {
      method: 'POST', headers: { origin }, body: form({
        customerName: 'Test Customer', eventDate: '2099-12-31', email: 'customer@example.com',
        bostonMetroConfirmed: 'yes', pickupLocation: 'quincy', ...fields,
      }),
    }) });
    return { status: response.status, result: await response.json(), saved, emails, uploads };
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

test('Boston metro confirmation and pickup choice are saved and sent in both emails', async () => {
  for (const [location, label] of [['quincy', 'Quincy'], ['fenway', 'Fenway']]) {
    const result = await submit({ 'quantity-brownie-single': 1, pickupLocation: location });
    assert.equal(result.status, 201, JSON.stringify(result.result));
    assert.equal(result.saved[0].bostonMetroConfirmed, true);
    assert.equal(result.saved[0].pickupLocation, location);
    for (const email of result.emails) {
      assert.match(email.htmlContent, /Boston metropolitan area \(confirmed\)/);
      assert.match(email.htmlContent, new RegExp(`Pickup location<\\/strong><\\/td><td[^>]*>${label}`));
    }
  }
});

test('orders require Boston metro confirmation and a valid pickup location', async () => {
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
  });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.equal(result.saved[0].cupcakeInspirationSelections[0]._ref, 'cupcake-style');
  assert.equal(result.saved[0].cupcakeReferenceImages[0].asset._ref, 'image-1');
  assert.deepEqual(result.uploads, ['cupcakes.png']);
  for (const email of result.emails) {
    assert.match(email.htmlContent, /Pink cupcakes/);
    assert.match(email.htmlContent, /cupcakes\.png/);
  }
});

test('cake and cupcake inspiration stay with the matching order items', async () => {
  const result = await submit({
    cakeSize: 'regular', cakeFlavor: 'vanilla',
    'quantity-cupcakes-dozen': 1, cupcakeFlavor: 'chocolate',
    inspirationSelections: 'cake-style',
    cupcakeInspirationSelections: 'cupcake-style',
  });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.equal(result.saved[0].inspirationSelections[0]._ref, 'cake-style');
  assert.equal(result.saved[0].cupcakeInspirationSelections[0]._ref, 'cupcake-style');
  const legacy = await submit({ cakeSize: 'regular', cakeFlavor: 'vanilla', inspirationSelections: 'cake-legacy' });
  assert.equal(legacy.status, 201);
});

test('cupcake inspiration is rejected without cupcakes or with a cake photo', async () => {
  for (const fields of [
    { 'quantity-brownie-single': 1, cupcakeInspirationSelections: 'cupcake-style' },
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
