import { defineField, defineType } from 'sanity';
import { isActiveField, sortOrderField } from './shared.js';

export const cakeSize = defineType({
  name: 'cakeSize',
  title: 'Cake Size',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Example: 6 inch, 3 layers',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'servings',
      title: 'Servings',
      type: 'string',
      description: 'Example: Serves 8-12',
    }),
    defineField({
      name: 'basePrice',
      title: 'Base Price',
      type: 'number',
      description: 'Starting price before flavors, fillings, tiers, and add-ons.',
      validation: (Rule) => Rule.required().min(0).precision(2),
    }),
    defineField(isActiveField),
    defineField(sortOrderField),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'servings',
      price: 'basePrice',
    },
    prepare({ title, subtitle, price }) {
      return {
        title,
        subtitle: [subtitle, typeof price === 'number' ? `$${price}` : null].filter(Boolean).join(' - '),
      };
    },
  },
});
