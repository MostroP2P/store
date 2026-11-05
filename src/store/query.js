// Product page URL (pure). Every product on sale has a page of its own, <id>.html?color=…&size=… (scripts/seo.mjs
// makes it, so a shared link gets that product's preview); product.html?id=… is the same page for any product.

import { defaultColorFor } from './products.js';

/**
 * Reads the product, color and size from location.search; unknown color or size fall back to the defaults.
 * `pageProductId` is the product of a product's own page (<html data-product>); product.html has none and uses ?id=.
 */
export function parseProductQuery(search, products, config, pageProductId) {
  const params = new URLSearchParams(search);
  const id = pageProductId ?? params.get('id');
  const product = products.find((p) => p.id === id) ?? null;
  if (!product) return { product: null, colorId: null, size: null };
  const color = params.get('color');
  const size = params.get('size');
  return {
    product,
    colorId: product.colors.includes(color) ? color : defaultColorFor(product, config),
    size: config.sizes.some((s) => s.id === size) ? size : config.defaultSize,
  };
}

/** 'love.html?color=red&size=M': the product's own page. */
export function productHref({ id, color, size }) {
  const params = new URLSearchParams();
  if (color) params.set('color', color);
  if (size) params.set('size', size);
  const query = params.toString();
  return `${encodeURIComponent(id)}.html${query ? `?${query}` : ''}`;
}
