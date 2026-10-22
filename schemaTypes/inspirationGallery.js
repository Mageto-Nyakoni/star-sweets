import { defineField, defineType } from 'sanity';
import { isActiveField, sortOrderField } from './shared.js';

export const inspirationGallery = defineType({
  name: 'inspirationGallery',
  title: 'Past Orders Gallery',
  type: 'document',
  fields: [
    defineField({
      name: 'image',
      title: 'Order Photo',
      type: 'image',
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'inspirationFor',
      title: 'Show in order form for',
      type: 'string',
      description: 'Choose Cupcakes to show this photo in the cupcake inspiration picker. Existing photos stay in the cake picker.',
      initialValue: 'cake',
      options: {
        layout: 'radio',
        list: [
          { title: 'Cakes', value: 'cake' },
          { title: 'Cupcakes', value: 'cupcake' },
        ],
      },
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'cakeSize',
      title: 'Cake Size',
      description: 'The size of this past order, for example 6 inch, 3 layers. Shown in Previous Orders details.',
      type: 'string',
    }),
    defineField({
      name: 'cakeDetails',
      title: 'Order Details',
      description: 'Describe the flavor, design, or occasion shown in this order.',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'addOns',
      title: 'Add-ons',
      description: 'List any flowers, specialized designs, toppers, or other extras included in this order.',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    defineField(isActiveField),
    defineField(sortOrderField),
  ],
  preview: {
    select: {
      title: 'caption',
      media: 'image',
      tags: 'tags',
    },
    prepare({ title, media, tags }) {
      return {
        title,
        subtitle: Array.isArray(tags) ? tags.join(', ') : undefined,
        media,
      };
    },
  },
});
