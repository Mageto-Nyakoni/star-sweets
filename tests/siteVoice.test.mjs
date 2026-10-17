import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const pages = [
  'src/pages/index.astro',
  'src/pages/gallery.astro',
  'src/pages/order.astro',
  'src/pages/api/orders.ts',
  'src/components/OrderInspirationPicker.astro',
  'src/lib/orderEmails.ts',
];

for (const path of pages) {
  test(`${path} uses third-person or neutral copy outside the approved exceptions`, async () => {
    let source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    if (path === 'src/pages/order.astro') {
      const priceSection = source.match(/<section class="pricing-explainer"[\s\S]*?<\/section>/);
      assert.ok(priceSection, 'The Behind the price section must remain identifiable');
      source = source.replace(priceSection[0], '');
    }
    const firstPerson = /\b(?:I(?:['’](?:m|ll|ve|d))?|[Mm]e|[Mm]y|[Mm]ine|[Ww]e(?:['’](?:re|ll|ve|d))?|[Oo]ur|[Oo]urs|[Uu]s|[Ll]et['’]s)\b/g;
    const matches = [...source.matchAll(firstPerson)].map((match) => ({
      phrase: match[0], line: source.slice(0, match.index).split('\n').length,
    }));
    assert.deepEqual(matches, [], 'Copy must use third-person or neutral wording');
  });
}
