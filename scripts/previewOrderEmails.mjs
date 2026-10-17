import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adminEmailTemplate, customerEmailTemplate, orderRows } from '../src/lib/orderEmails.ts';

// Render the production templates with sample data. This script never sends mail.
const outputDirectory = resolve(process.argv[2] || '.astro/email-preview');
const details = [
  ['Customer', 'Jamie Rivera'],
  ['Event date', '2026-10-30'],
  ['Pickup confirmation', 'The customer confirmed pickup at the selected location'],
  ['Pickup location', 'Fenway'],
  ['Email', 'jamie@example.com'],
  ['Phone', '617-555-0100'],
  ['Size', '4 inch, 2 layers (Round)'],
  ['Cake flavor', 'Offered as-is'],
  ['Frosting flavor', 'Offered as-is'],
  ['Flowers', 'None'],
  ['Specialized designs', 'None'],
  ['Custom filling', 'None'],
  ['Custom buttercream', 'None'],
  ['Inspiration', 'None'],
  ['Reference photos', 'None'],
  ['Starting estimate', '$35.00'],
];
const sample = { customerName: 'Jamie Rivera', eventDate: '2026-10-30', calculatedTotal: 35, pricingPending: false, details };
const customDetails = details.filter(([label]) => !['Size', 'Cake flavor', 'Frosting flavor', 'Flowers', 'Reference photos', 'Starting estimate'].includes(label)).concat([
  ['Size', '6 inch, 3 layers (Round)'],
  ['Cake flavor', 'Vanilla'],
  ['Frosting flavor', 'Vanilla Swiss Meringue Buttercream'],
  ['Flowers', 'Blush flowers and a gold birthday topper'],
  ['Cake inspiration comments', 'Soft pink with a few tiny stars'],
  ['Reference photos', 'birthday-cake.jpg'],
]);
const previews = [
  ['customer-request.html', customerEmailTemplate(sample)],
  ['customer-custom.html', customerEmailTemplate({ ...sample, calculatedTotal: 95, details: customDetails })],
  ['customer-pending.html', customerEmailTemplate({ ...sample, calculatedTotal: 0, pricingPending: true, details: [['Pickup location', 'Quincy Center'], ["1 × Baker's Choice cookies", 'Price TBD']] })],
  ['admin-request.html', adminEmailTemplate({ ...sample, rows: orderRows(details), orderLink: '' })],
];
await mkdir(outputDirectory, { recursive: true });
for (const [filename, html] of previews) {
  const path = resolve(outputDirectory, filename);
  await writeFile(path, html);
  console.log(path);
}
