import { defineField, defineType } from 'sanity';
import { isActiveField, priceField, sortOrderField } from './shared.js';

export const cakeFilling = defineType({
  name: 'cakeFilling',
  title: 'Cake Filling',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
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
