# Third-person copy changes

All changes below affect wording only. Copy now uses third-person references to Emily or neutral instructions where a name would sound awkward.

Changed **33 phrases across 35 occurrences in 6 production files**. Shared inspiration text applies to cakes and cupcakes. The success response appears in three submission paths.

The dedicated About Me page, its content and defaults, the legacy founder biography, and the entire Behind the price section are unchanged. The existing home-page biography was already in third person; only its link label changed.

Customer instructions still address the customer as "you." The pickup checkbox retains its customer-confirmation meaning without speaking in the first person.

## src/pages/index.astro

| Before | After | Occurrences |
| --- | --- | ---: |
| More About Me | More About Emily | 1 |

## src/pages/gallery.astro

| Before | After | Occurrences |
| --- | --- | ---: |
| Browse cakes and baked goods previously made by Star Sweets, with photos from our Instagram. | Browse past cakes and baked goods from Star Sweets, with photos from Instagram. | 1 |
| You can still browse my work on Instagram or start planning your own cake. | You can still browse Emily's work on Instagram or start planning your own cake. | 1 |
| In the meantime, you can browse my latest work on Instagram or start planning your own cake. | In the meantime, you can browse Emily's latest work on Instagram or start planning your own cake. | 1 |
| See my Instagram | See Emily's Instagram | 1 |

## src/pages/order.astro

| Before | After | Occurrences |
| --- | --- | ---: |
| A custom flavor adds $10. I'll let you know if I can make it | A custom flavor adds $10. Emily will let you know if she can make it | 1 |
| Choose your flavor and number of dozens. If you have a look in mind, tell me | Choose your flavor and number of dozens, then share any design ideas. | 1 |
| Cupcakes come in vanilla or chocolate. Share the colors or style you have in mind, and I'll confirm the design with you | Cupcakes come in vanilla or chocolate. Share your preferred colors or style. The design will be confirmed by text. | 1 |
| Baker's Choice isn't in the total yet. I'll confirm the price with you | Baker's Choice isn't in the total yet. Emily will confirm the price with you | 1 |
| I'll need your name, event date, and a mobile number for texts. Please order at least one week ahead | Emily will need your name, event date, and a mobile number for texts. Please order at least one week ahead | 1 |
| I'll text you here to confirm your order and payment details | Emily will text you here to confirm your order and payment details | 1 |
| I confirm I can pick up in the location selected | Confirm pickup at the selected location | 1 |
| Baker's Choice isn't included in this subtotal. I'll confirm its price with you | Baker's Choice isn't included in this subtotal. Emily will confirm its price with you | 1 |
| I'll review your date and order details. | Emily will review your date and order details. | 1 |
| I'll text you within 24 hours to discuss the details, final price, and payment. Your order is confirmed once we agree by text. | Emily will text you within 24 hours to discuss the details, final price, and payment. Your order is confirmed once you and Emily agree by text. | 1 |
| I'll send the exact pickup address and time for Quincy Center or Fenway. | Emily will send the exact pickup address and time for Quincy Center or Fenway. | 1 |
| I've saved your request. I'll text you within 24 hours to confirm the order details, final price, and payment arrangements. I'll confirm your order and pickup after we agree by text. | Emily has received your request. She will text you within 24 hours to confirm the order details, final price, and payment arrangements. Emily will confirm your order and pickup after you and she agree by text. | 1 |
| Enter a mobile number with 10 to 15 digits so I can text you | Enter a mobile number with 10 to 15 digits for order updates by text | 1 |

## src/components/OrderInspirationPicker.astro

| Before | After | Occurrences |
| --- | --- | ---: |
| Tell me what you like or what you would change | Describe what you like or what you would change | 1 |

## src/pages/api/orders.ts

| Before | After | Occurrences |
| --- | --- | ---: |
| The form is temporarily unavailable. Please contact me directly. | The form is temporarily unavailable. Please contact Emily directly. | 1 |
| Please provide a mobile number with 10 to 15 digits so I can text you. | Please provide a mobile number with 10 to 15 digits for order updates by text. | 1 |
| Your request is in. I'll text you within 24 hours to discuss the details, final price, and payment. | Your request is in. Emily will text you within 24 hours to discuss the details, final price, and payment. | 3 |
| Too many order requests right now. Please try again later or contact me directly. | Too many order requests right now. Please try again later or contact Emily directly. | 1 |
| I confirm I can pick up in the location selected | The customer confirmed pickup at the selected location | 1 |

## src/lib/orderEmails.ts

| Before | After | Occurrences |
| --- | --- | ---: |
| ${customerName} sent an order request for ${formattedDate}. Review the details below, then text the customer within 24 hours to confirm availability, final pricing, and payment arrangements. | ${customerName} sent an order request for ${formattedDate}. Emily will review the details below and text the customer within 24 hours to confirm availability, final pricing, and payment arrangements. | 1 |
| Thanks for your request! I'll text you within 24 hours to talk details. | Thanks for your request! Emily will text you within 24 hours to talk details. | 1 |
| Thanks, ${customerName}! Your request has landed in my inbox. I'll review the details and text you within 24 hours. | Thanks, ${customerName}! Your request has landed in Emily's inbox. She will review the details and text you within 24 hours. | 1 |
| This is an estimate. I'll confirm the final price after reviewing your request. | This is an estimate. Emily will confirm the final price after reviewing your request. | 1 |
| Let's talk details. | Emily will talk through the details. | 1 |
| We'll go over availability, your order details, the final price, and payment arrangements. | Emily will go over availability, your order details, the final price, and payment arrangements with you. | 1 |
| Then we'll make it official. | Then Emily will make it official. | 1 |
| Your order is confirmed after we agree by text. I'll coordinate the exact pickup address and time with you. | Your order is confirmed after you and Emily agree by text. Emily will coordinate the exact pickup address and time with you. | 1 |
| I can't wait to hear what you're celebrating! | Thanks for thinking of Star Sweets for your celebration! | 1 |

## Supporting updates

- Updated the email-preview sample pickup confirmation to match the new wording.
- Updated email tests for the new confirmation text.
- Added a copy audit to detect first-person language outside the requested exceptions.
