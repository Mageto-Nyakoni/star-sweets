import { defineField, defineType } from 'sanity';
import { isActiveField, priceField, sortOrderField } from './shared.js';

export const tierOption = defineType({
  name: 'tierOption',
  title: 'Tier Option',
  type: 'document',
  fields: [
    defineField({
      name: 'tiers',
      title: 'Number of Tiers',
      type: 'number',
      validation: (Rule) => Rule.required().min(1).integer(),
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Example: Single tier, Two tier statement cake',
      validation: (Rule) => Rule.required(),
    }),
    defineField(priceField()),
    defineField(isActiveField),
    defineField(sortOrderField),
  ],
  preview: {
    select: {
      title: 'label',
      tiers: 'tiers',
      price: 'priceModifier',
    },
    prepare({ title, tiers, price }) {
      return {
        title,
        subtitle: [
          tiers ? `${tiers} tier${tiers === 1 ? '' : 's'}` : null,
          typeof price === 'number' ? `+$${price}` : null,
        ].filter(Boolean).join(' - '),
      };
    },
  },
});
