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
 * The shirts of the store card, [{ slot, product, colorId }]: each listed shirt while it is on sale; the slot of
 * one that is not goes to the next product on sale that is not listed, in its default color, so no shirt shows
 * twice. A catalog with fewer products fills fewer slots.
 */
export function storeShirts(products, config) {
  const listedIds = STORE_SHIRTS.map(([id]) => id);
  const standIns = products.filter((product) => !listedIds.includes(product.id));
  const slots = STORE_SHIRTS.map(([id, colorId], slot) => ({ slot, colorId, listed: products.find((product) => product.id === id) }));
  const empty = slots.filter(({ listed }) => !listed).map(({ slot }) => slot);
  return slots.flatMap(({ slot, colorId, listed }) => {
    if (listed) return [{ slot, product: listed, colorId: listed.colors.includes(colorId) ? colorId : defaultColorFor(listed, config) }];
    const stand = standIns[empty.indexOf(slot)];
    return stand ? [{ slot, product: stand, colorId: defaultColorFor(stand, config) }] : [];
  });
}
