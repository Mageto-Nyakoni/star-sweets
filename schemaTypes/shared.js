export const priceField = (name = 'priceModifier', title = 'Price Modifier') => ({
  name,
  title,
  type: 'number',
  initialValue: 0,
  validation: (Rule) => Rule.required().min(0).precision(2),
});

export const isActiveField = {
  name: 'isActive',
  title: 'Active',
  type: 'boolean',
  description: 'Show this option on the public order form.',
  initialValue: true,
};

export const sortOrderField = {
  name: 'sortOrder',
  title: 'Sort Order',
  type: 'number',
  description: 'Lower numbers appear first.',
  initialValue: 100,
  validation: (Rule) => Rule.min(0).integer(),
};
