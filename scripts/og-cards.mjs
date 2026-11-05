// Preview cards (pure): which shirts the store card shows. scripts/og/card.js draws the cards in the
// browser; this part has unit tests.

import { defaultColorFor } from '../src/store/products.js';

export const STORE_CARD = 'store';
export const LOGO = 'designs/characters/mostro.png';
// The store card shows these three, in these colors, while they are on sale
const STORE_SHIRTS = Object.freeze([
  ['mostro-quotes-love-at-first-sat', 'white'],
  ['mostro-invaders', 'black'],
  ['mostro-quotes-hold-my-invoice', 'orange'],
]);

/**
 * The shirts of the store card, [{ slot, product, colorId }]: each listed shirt while it is on sale, else the
 * product on sale at that position, in its default color. A catalog with fewer products fills fewer slots.
 */
export function storeShirts(products, config) {
  return STORE_SHIRTS.flatMap(([id, colorId], slot) => {
    const listed = products.find((product) => product.id === id);
    if (listed) return [{ slot, product: listed, colorId: listed.colors.includes(colorId) ? colorId : defaultColorFor(listed, config) }];
    const stand = products[slot];
    return stand ? [{ slot, product: stand, colorId: defaultColorFor(stand, config) }] : [];
  });
}
