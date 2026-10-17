export type OrderEmailRow = [label: string, value: string | undefined];

export function dollars(amount = 0) {
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
  }[character] || character));
}

export function orderRows(rows: OrderEmailRow[]) {
  return rows
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<tr><td class="detail-label" style="width:34%;padding:12px 14px;border-bottom:1px solid #f0e4e2;color:#6b2535;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;vertical-align:top"><strong style="font-weight:normal">${escapeHtml(label)}</strong></td><td style="padding:12px 14px;border-bottom:1px solid #f0e4e2;color:#3a1520;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;vertical-align:top;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value || '')}</td></tr>`)
    .join('');
}

function displayEventDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);

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
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)} | Star Sweets</title>
    <style>
      @media only screen and (max-width:480px) {
        .email-outer { padding:16px 8px!important; }
        .email-padding { padding-left:20px!important;padding-right:20px!important; }
        .email-heading { font-size:30px!important; }
        .detail-label { width:38%!important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#faf5ee;color:#3a1520">
    <span style="display:none!important;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#faf5ee">
      <tr>
        <td class="email-outer" align="center" style="padding:32px 16px">
          <!--[if mso]><table role="presentation" width="620" align="center"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #ead8d7;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:0">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                  ${Array.from({ length: 12 }, (_, index) => `<td width="8.33%" style="height:9px;background:${index % 2 ? '#faf5ee' : '#f5bfd0'};font-size:0;line-height:0">&nbsp;</td>`).join('')}
                </tr></table>
              </td>
            </tr>
            <tr>
              <td class="email-padding" align="center" style="padding:26px 32px;background:#fdf0f3;border-bottom:1px solid #f0dce2">
                <p aria-hidden="true" style="margin:0 0 7px;color:#b59356;font-family:Georgia,serif;font-size:15px;letter-spacing:8px">&#10022; &#10023; &#10022;</p>
                <p style="margin:0;color:#8c1a1a;font-family:Georgia,'Times New Roman',serif;font-size:31px;font-style:italic;line-height:1.2">Star Sweets</p>
                <p style="margin:9px 0 0;color:#6b2535;font-family:Arial,sans-serif;font-size:10px;letter-spacing:1.6px;text-transform:uppercase">Baked in Boston</p>
              </td>
            </tr>
            <tr>
              <td class="email-padding" style="padding:30px 32px 24px">
                <p style="margin:0 0 8px;color:#c4536a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.7px;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
                <h1 class="email-heading" style="margin:0 0 16px;color:#3a1520;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.15;font-weight:normal">${escapeHtml(title)}</h1>
                <p style="margin:0;color:#6b2535;font-family:Arial,sans-serif;font-size:15px;line-height:1.65">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td class="email-padding" style="padding:0 32px 32px">${content}</td>
            </tr>
            <tr>
              <td class="email-padding" style="padding:20px 32px;background:#faf5ee;border-top:1px solid #ead8d7;color:#6b2535;font-family:Arial,sans-serif;font-size:12px;line-height:1.7;text-align:center"><a href="https://starsweets.co" style="color:#8c1a1a;text-decoration:none">Star Sweets</a> &middot; Boston, MA<br><a href="https://www.instagram.com/star.sweets25/" style="color:#8c1a1a;text-decoration:underline;text-underline-offset:3px">Follow the latest bakes</a></td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function adminEmailTemplate({
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
    preheader: `New order request from ${customerName} for ${formattedDate}.`,
    eyebrow: 'New order request',
    title: 'A new celebration is taking shape.',
    intro: `${customerName} sent an order request for ${formattedDate}. Review the details below, then text the customer within 24 hours to confirm availability, final pricing, and payment arrangements.`,
    content: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #ead8d7;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;background:#fffaf7">${rows}</table>${studioButton}`,
  });
}

export function customerEmailTemplate({
  customerName,
  eventDate,
  calculatedTotal,
  pricingPending,
  details,
}: {
  customerName: string;
  eventDate: string;
  calculatedTotal: number;
  pricingPending: boolean;
  details: OrderEmailRow[];
}) {
  const formattedDate = displayEventDate(eventDate);
  const estimate = pricingPending
    ? calculatedTotal > 0 ? `${dollars(calculatedTotal)} + Baker's Choice price TBD` : 'Price TBD'
    : dollars(calculatedTotal);
  const optionalSelections = ['Flowers', 'Specialized designs', 'Custom filling', 'Custom buttercream', 'Inspiration', 'Reference photos', 'Cupcake inspiration', 'Cupcake reference photos'];
  const summaryRows = orderRows(details
    .filter(([label, value]) => !['Customer', 'Event date', 'Pickup confirmation', 'Starting estimate', 'Priced subtotal'].includes(label)
      && Boolean(value) && !(optionalSelections.includes(label) && value === 'None')
      && !(label === 'Frosting flavor' && value === 'Offered as-is'))
    .map(([label, value]): OrderEmailRow => label === 'Cake flavor' && value === 'Offered as-is'
      ? ['Cake details', 'This size is offered as-is'] : [label, value]));

  return emailShell({
    preheader: "Thanks for your request! I'll text you within 24 hours to talk details.",
    eyebrow: 'A sweet start',
    title: 'Your Request Is In!',
    intro: `Thanks, ${customerName}! Your request has landed in my inbox. I'll review the details and text you within 24 hours.`,
    content: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #ead8d7;border-radius:12px;border-collapse:separate;border-spacing:0;background:#fffaf7">
      <tr><td style="padding:20px;border-bottom:1px solid #ead8d7">
        <p style="margin:0 0 7px;color:#6b2535;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.2px;text-transform:uppercase">Event date</p>
        <p style="margin:0;color:#3a1520;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3">${escapeHtml(formattedDate)}</p>
      </td></tr>
      <tr><td style="padding:20px">
        <p style="margin:0 0 7px;color:#6b2535;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.2px;text-transform:uppercase">${pricingPending ? 'Priced subtotal' : 'Starting estimate'}</p>
        <p style="margin:0;color:#8c1a1a;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.3">${escapeHtml(estimate)}</p>
        <p style="margin:10px 0 0;color:#6b2535;font-family:Arial,sans-serif;font-size:12px;line-height:1.6">${pricingPending ? "Baker's Choice pricing is TBD and excluded from this subtotal. " : ''}This is an estimate. I'll confirm the final price after reviewing your request.</p>
      </td></tr>
    </table>
    <h2 style="margin:28px 0 14px;color:#3a1520;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:normal">What happens next</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%">
      <tr><td width="32" valign="top" style="padding:0 10px 18px 0;color:#c4536a;font-family:Georgia,serif;font-size:23px">01</td><td style="padding:0 0 18px;color:#6b2535;font-family:Arial,sans-serif;font-size:14px;line-height:1.65"><strong style="color:#3a1520;font-weight:600">Let's talk details.</strong><br>We'll go over availability, your order details, the final price, and payment arrangements.</td></tr>
      <tr><td width="32" valign="top" style="padding:0 10px 0 0;color:#c4536a;font-family:Georgia,serif;font-size:23px">02</td><td style="color:#6b2535;font-family:Arial,sans-serif;font-size:14px;line-height:1.65"><strong style="color:#3a1520;font-weight:600">Then we'll make it official.</strong><br>Your order is confirmed after we agree by text. I'll coordinate the exact pickup address and time with you.</td></tr>
    </table>
    <h2 style="margin:28px 0 12px;color:#3a1520;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:normal">Your request details</h2>
    <table width="100%" cellspacing="0" cellpadding="0" border="0" aria-label="Your request details" style="width:100%;border:1px solid #ead8d7;border-radius:10px;border-collapse:separate;border-spacing:0">${summaryRows}</table>
    <p style="margin:24px 0 0;color:#6b2535;font-family:Arial,sans-serif;font-size:14px;line-height:1.7">I can't wait to hear what you're celebrating!<br><span style="color:#8c1a1a;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-style:italic">Emily</span></p>`,
  });
}

