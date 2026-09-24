export type BakeryItem = {
  id: string;
  category: string;
  name: string;
  portion: string;
  price: number | null;
};

export const bakeryMenu: BakeryItem[] = [
  { id: 'cupcakes-dozen', category: 'Cupcakes', name: 'A Dozen Cupcakes', portion: '12 cupcakes · Serves 12', price: 36 },
  { id: 'cookies-chocolate-chip', category: 'Cookies', name: 'Chocolate Chip', portion: '4 cookies', price: 12 },
  { id: 'cookies-chocolate-chip-oatmeal', category: 'Cookies', name: 'Chocolate Chip Oatmeal', portion: '4 cookies', price: 12 },
  { id: 'cookies-peanut-butter', category: 'Cookies', name: 'Peanut Butter', portion: '4 cookies', price: 12 },
  { id: 'cookies-snickerdoodle', category: 'Cookies', name: 'Snickerdoodle', portion: '4 cookies', price: 12 },
  { id: 'cookies-sugar', category: 'Cookies', name: 'Sugar', portion: '4 cookies', price: 12 },
  { id: 'cookies-bakers-choice', category: 'Cookies', name: 'Baker’s Choice', portion: 'Baker-selected cookies', price: null },
  { id: 'banana-bread-half', category: 'Breads', name: 'Banana Bread', portion: '½ loaf', price: 6 },
  { id: 'banana-bread-full', category: 'Breads', name: 'Banana Bread', portion: 'Full loaf', price: 12 },
  { id: 'pumpkin-bread-half', category: 'Breads', name: 'Pumpkin Bread', portion: '½ loaf', price: 7.5 },
  { id: 'pumpkin-bread-full', category: 'Breads', name: 'Pumpkin Bread', portion: 'Full loaf', price: 15 },
  { id: 'focaccia-half', category: 'Breads', name: 'Focaccia', portion: '½ loaf', price: 9 },
  { id: 'focaccia-full', category: 'Breads', name: 'Focaccia', portion: 'Full loaf', price: 18 },
  { id: 'brownie-single', category: 'Pastries', name: 'Brownie', portion: '1 brownie', price: 3 },
  { id: 'brownies-nine', category: 'Pastries', name: 'Brownies', portion: '9 brownies', price: 27 },
  { id: 'blueberry-muffins-six', category: 'Pastries', name: 'Blueberry Muffins', portion: '6 muffins', price: 18 },
  { id: 'chocolate-chip-muffin', category: 'Pastries', name: 'Chocolate Chip Muffin', portion: '1 muffin', price: 3.25 },
  { id: 'lemon-loaf', category: 'Pastries', name: 'Lemon Loaf', portion: 'Each', price: 3.5 },
];

// Both the form and server use this menu; submitted prices are never trusted.
export function readBakeryOrder(formData: FormData) {
  const items = bakeryMenu.flatMap((item) => {
    const values = formData.getAll(`quantity-${item.id}`);
    const raw = values[0] ?? '0';
    if (values.length > 1 || typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      throw new Error(`Enter a whole-number quantity for ${item.name}.`);
    }
    const quantity = Number(raw);
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99) {
      throw new Error(`Choose a quantity from 0 to 99 for ${item.name}.`);
    }
    return quantity ? [{
      productId: item.id,
      name: item.name,
      portion: item.portion,
      quantity,
      unitPrice: item.price,
      lineTotal: item.price === null ? null : Math.round(item.price * quantity * 100) / 100,
    }] : [];
  });
  const hasCupcakes = items.some((item) => item.productId === 'cupcakes-dozen');
  const cupcakeFlavor = String(formData.get('cupcakeFlavor') ?? '').trim();
  const cupcakeVisualSuggestions = String(formData.get('cupcakeVisualSuggestions') ?? '').trim();
  if (hasCupcakes && !['vanilla', 'chocolate'].includes(cupcakeFlavor)) {
    throw new Error('Choose vanilla or chocolate for your cupcakes.');
  }
  if (!hasCupcakes && (cupcakeFlavor || cupcakeVisualSuggestions)) {
    throw new Error('Cupcake preferences require a cupcake order.');
  }
  if (cupcakeVisualSuggestions.length > 2000) {
    throw new Error('Keep cupcake visual suggestions to 2,000 characters or fewer.');
  }
  return {
    items,
    cupcakeFlavor: hasCupcakes ? cupcakeFlavor : undefined,
    cupcakeVisualSuggestions: cupcakeVisualSuggestions || undefined,
    subtotal: Math.round(items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0) * 100) / 100,
    pricingPending: items.some((item) => item.unitPrice === null),
  };
}
