import { defineField, defineType } from 'sanity';
import { isActiveField, priceField, sortOrderField } from './shared.js';

export const addOn = defineType({
  name: 'addOn',
  title: 'Add-On',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Example: Fresh flowers, edible topper, extra piping',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField(priceField()),
    defineField(isActiveField),
    defineField(sortOrderField),
  ],
  preview: {
    select: {
      title: 'name',
      price: 'priceModifier',
    },
    prepare({ title, price }) {
      return {
        title,
        subtitle: typeof price === 'number' ? `+$${price}` : undefined,
      };
    },
  },
});
