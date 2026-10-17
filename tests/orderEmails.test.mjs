import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customerEmailTemplate } from '../src/lib/orderEmails.ts';

const sample = {
  customerName: 'Jamie', eventDate: '2026-10-30', calculatedTotal: 35, pricingPending: false,
  details: [
    ['Customer', 'Jamie'], ['Event date', '2026-10-30'], ['Pickup confirmation', 'Confirmed'],
    ['Pickup location', 'Fenway'], ['Size', '4 inch, 2 layers (Round)'],
    ['Cake flavor', 'Offered as-is'], ['Frosting flavor', 'Offered as-is'],
    ['Flowers', 'None'], ['Starting estimate', '$35.00'],
  ],
};

test('customer email keeps selected details and clearly distinguishes a request from confirmation', () => {
  const html = customerEmailTemplate(sample);
  assert.match(html, /Your Request Is In!/);
  assert.match(html, /within 24 hours/);
  assert.match(html, /Your order is confirmed after we agree by text/);
  assert.match(html, /October 30, 2026/);
  assert.match(html, /Fenway/);
  assert.match(html, /4 inch, 2 layers/);
  assert.match(html, /This size is offered as-is/);
  assert.equal((html.match(/\$35\.00/g) || []).length, 1);
  assert.doesNotMatch(html, />None<|>Flowers<|>Pickup confirmation<|2026-10-30/);
});

test('customer email safely renders personal details, customization notes, and filenames', () => {
  const html = customerEmailTemplate({
    ...sample, customerName: '<img src=x onerror=alert(1)>',
    details: [['Flowers', '<pink> & white'], ['Reference photos', 'cake<script>.jpg'], ['Cake inspiration comments', 'None']],
  });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;pink&gt; &amp; white/);
  assert.match(html, /cake&lt;script&gt;\.jpg/);
  assert.match(html, /Cake inspiration comments/);
  assert.doesNotMatch(html, /<img src=x|<script>/);
});

test('pending item prices stay explicit for zero and nonzero subtotals', () => {
  for (const calculatedTotal of [0, 35]) {
    const html = customerEmailTemplate({ ...sample, pricingPending: true, calculatedTotal });
    assert.match(html, /Priced subtotal/);
    assert.match(html, /[Pp]rice TBD/);
    assert.match(html, /excluded from this subtotal/);
    assert.match(html, /confirm the final price/);
  }
});
