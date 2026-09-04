import { defineField, defineType } from 'sanity';

export const cakeOrder = defineType({
  name: 'cakeOrder',
  title: 'Cake Order',
  type: 'document',
  fields: [
    defineField({
      name: 'customerName',
      title: 'Customer Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (Rule) => Rule.email(),
    }),
    defineField({
      name: 'phone',
      title: 'Phone',
      type: 'string',
    }),
    defineField({
      name: 'eventDate',
      title: 'Event Date',
      type: 'date',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'cakeSize',
      title: 'Cake Size',
      type: 'reference',
      to: [{ type: 'cakeSize' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'cakeFlavor',
      title: 'Cake Flavor',
      type: 'string',
      options: {
        list: [
          { title: 'Vanilla', value: 'vanilla' },
          { title: 'Chocolate', value: 'chocolate' },
          { title: 'Red Velvet', value: 'red-velvet' },
          { title: 'Custom Cake Flavor (+$10)', value: 'custom' },
        ],
      },
    }),
    defineField({
      name: 'customFlavorRequest',
      title: 'Custom Flavor Request',
      type: 'text',
      rows: 3,
      description: 'A custom cake flavor adds $10.',
      hidden: ({ document }) => (
        document?.letBakerChooseFlavor
        || (Boolean(document?.cakeFlavor) && document?.cakeFlavor !== 'custom')
      ),
    }),
    defineField({
      name: 'letBakerChooseFlavor',
      title: "Let Baker Choose Flavor",
      type: 'boolean',
      initialValue: false,
      hidden: ({ document }) => Boolean(document?.customFlavorRequest),
    }),
    defineField({
      name: 'flowers',
      title: 'Flowers (+$10)',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'flowersRequest',
      title: 'Flower Details',
      type: 'text',
      rows: 3,
      hidden: ({ document }) => !document?.flowers,
    }),
    defineField({
      name: 'specializedDesign',
      title: 'Specialized Designs (+$10)',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'specializedDesignRequest',
      title: 'Specialized Design Details',
      type: 'text',
      rows: 3,
      hidden: ({ document }) => !document?.specializedDesign,
    }),
    defineField({
      name: 'customFilling',
      title: 'Custom Filling (+$10)',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'customFillingRequest',
      title: 'Custom Filling Request',
      type: 'text',
      rows: 3,
      description: 'A custom filling adds $10.',
      hidden: ({ document }) => document?.letBakerChooseFilling || document?.customFilling === false,
    }),
    defineField({
      name: 'letBakerChooseFilling',
      title: 'Let Baker Choose Filling',
      type: 'boolean',
      initialValue: false,
      hidden: ({ document }) => Boolean(document?.customFillingRequest),
    }),
    defineField({
      name: 'customButtercream',
      title: 'Custom Buttercream (+$10)',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'customButtercreamRequest',
      title: 'Custom Buttercream Details',
      type: 'text',
      rows: 3,
      hidden: ({ document }) => !document?.customButtercream,
    }),
    defineField({
      name: 'cakeFrosting',
      title: 'Cake Frosting',
      type: 'reference',
      to: [{ type: 'cakeFrosting' }],
    }),
    defineField({
      name: 'tierOption',
      title: 'Tier Option',
      type: 'reference',
      to: [{ type: 'tierOption' }],
    }),
    defineField({
      name: 'addOns',
      title: 'Add-Ons',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'addOn' }] }],
    }),
    defineField({
      name: 'inspirationSelections',
      title: 'Inspiration Selections',
      type: 'array',
      description: 'Past cake styles the customer marked as inspiration.',
      of: [{ type: 'reference', to: [{ type: 'inspirationGallery' }] }],
    }),
    defineField({
      name: 'referenceImages',
      title: 'Reference Images',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'calculatedTotal',
      title: 'Calculated Total',
      type: 'number',
      readOnly: true,
      validation: (Rule) => Rule.required().min(0).precision(2),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      initialValue: 'new',
      options: {
        layout: 'dropdown',
        list: [
          { title: 'New', value: 'new' },
          { title: 'Reviewing', value: 'reviewing' },
          { title: 'Confirmed', value: 'confirmed' },
          { title: 'Completed', value: 'completed' },
          { title: 'Cancelled', value: 'cancelled' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      readOnly: true,
      initialValue: () => new Date().toISOString(),
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'notificationStatus',
      title: 'Notification Status',
      type: 'string',
      readOnly: true,
      initialValue: 'pending',
      options: {
        list: [
          { title: 'Pending', value: 'pending' },
          { title: 'Sent', value: 'sent' },
          { title: 'Failed', value: 'failed' },
        ],
      },
    }),
    defineField({
      name: 'notificationError',
      title: 'Notification Error',
      type: 'text',
      readOnly: true,
      rows: 3,
      hidden: ({ document }) => !document?.notificationError,
    }),
  ],
  preview: {
    select: {
      customerName: 'customerName',
      eventDate: 'eventDate',
      status: 'status',
      total: 'calculatedTotal',
    },
    prepare({ customerName, eventDate, status, total }) {
      return {
        title: customerName || 'New cake order',
        subtitle: [
          eventDate,
          status,
          typeof total === 'number' ? `$${total}` : null,
        ].filter(Boolean).join(' - '),
      };
    },
  },
});
