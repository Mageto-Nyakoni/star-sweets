/** Local order-builder data used when SANITY_PROJECT_ID is not set. */

export const cakeOrderOptions = {
  sizes: [
    {
      _id: 'cakeSize-6-inch-3-layer',
      name: '6 inch, 3 layers',
      servings: 'Serves 8-12',
      basePrice: 75,
    },
    {
      _id: 'cakeSize-9-inch-3-layer',
      name: '9 inch, 3 layers',
      servings: 'Serves 18-24',
      basePrice: 100,
    },
  ],
  frostings: [
    {
      _id: 'frosting-american-buttercream',
      name: 'American Buttercream',
      description: 'Sweet, stable, and great for decorated cakes.',
      priceModifier: 0,
    },
    {
      _id: 'frosting-cream-cheese',
      name: 'Cream Cheese',
      description: 'Tangy and soft, best for classic flavors.',
      priceModifier: 6,
    },
    {
      _id: 'frosting-swiss-meringue',
      name: 'Swiss Meringue Buttercream',
      description: 'Silky finish with a lighter sweetness.',
      priceModifier: 10,
    },
  ],
  tiers: [
    {
      _id: 'tier-single',
      tiers: 1,
      label: 'Single tier',
      priceModifier: 0,
    },
    {
      _id: 'tier-two',
      tiers: 2,
      label: 'Two tier statement cake',
      priceModifier: 45,
    },
  ],
  addOns: [
    {
      _id: 'addon-extra-piping',
      name: 'Extra piping',
      description: 'More detailed borders, shells, or vintage piping.',
      priceModifier: 12,
    },
    {
      _id: 'addon-fresh-flowers',
      name: 'Fresh flowers',
      description: 'A simple fresh floral finish.',
      priceModifier: 18,
    },
    {
      _id: 'addon-edible-topper',
      name: 'Edible topper',
      description: 'Printed or handmade topper detail.',
      priceModifier: 15,
    },
  ],
  gallery: [
    {
      _id: 'gallery-vintage-pink',
      caption: '[Add past order photo and caption #1]',
      tags: [],
      cakeDetails: '[Add the cake flavor, filling, finish, and design details in Sanity.]',
      addOns: [],
    },
    {
      _id: 'gallery-floral-white',
      caption: '[Add past order photo and caption #2]',
      tags: [],
      cakeDetails: '[Add the cake flavor, filling, finish, and design details in Sanity.]',
      addOns: [],
    },
    {
      _id: 'gallery-chocolate-drip',
      caption: '[Add past order photo and caption #3]',
      tags: [],
      cakeDetails: '[Add the cake flavor, filling, finish, and design details in Sanity.]',
      addOns: [],
    },
  ],
};
