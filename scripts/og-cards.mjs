// Preview cards (pure), shared by scripts/og/card.js, which draws them in the browser, and by
// scripts/og-fingerprint.mjs, which tells when one is out of date: which shirts a card shows, and
// every catalog value that changes how it looks.

import { defaultColorFor } from '../src/store/products.js';

export const STORE_CARD = 'store';
export const LOGO = 'designs/characters/mostro.png';
const FONT_FILE = /\.(ttf|otf|woff2?)$/i;
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

const shirtInputs = (catalog, product, colorId) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  layout: product.layout,
  image: product.image,
  text: product.text,
  style: product.style,
  colorId,
  hex: catalog.colors.find((color) => color.id === colorId).hex,
});

/** Every catalog value that changes how card `name` (STORE_CARD or a product id) looks. */
export function cardInputs(name, { products, catalog, config }) {
  const common = { base: catalog.base, currency: config.currency };
  if (name === STORE_CARD) {
    return { ...common, shirts: storeShirts(products, config).map(({ slot, product, colorId }) => ({ slot, ...shirtInputs(catalog, product, colorId) })) };
  }
  const product = products.find((p) => p.id === name);
  if (!product) throw new Error(`no product on sale with id "${name}"`);
  return { ...common, shirts: [shirtInputs(catalog, product, defaultColorFor(product, config))] };
}

/** The files a card reads: the base shirt, the logo, and the design and font file of each of its shirts. */
export function cardFiles(inputs) {
  const fonts = inputs.shirts.map((shirt) => shirt.style?.font).filter((font) => FONT_FILE.test(font ?? ''));
  return [...new Set([inputs.base.image, LOGO, ...inputs.shirts.map((shirt) => shirt.image), ...fonts])].sort();
}
