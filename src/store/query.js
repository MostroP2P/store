// Product page URL (pure): producto.html?id=…&color=…&talle=…

import { defaultColorFor } from './products.js';

const PRODUCT_PAGE = 'producto.html';

/** Reads the product, color and size from location.search; unknown color or size fall back to the defaults. */
export function parseProductQuery(search, products, config) {
  const params = new URLSearchParams(search);
  const product = products.find((p) => p.id === params.get('id')) ?? null;
  if (!product) return { product: null, colorId: null, size: null };
  const color = params.get('color');
  const size = params.get('talle');
  return {
    product,
    colorId: product.colors.includes(color) ? color : defaultColorFor(product, config),
    size: config.sizes.some((s) => s.id === size) ? size : config.defaultSize,
  };
}

export function productHref({ id, color, size }) {
  const params = new URLSearchParams({ id });
  if (color) params.set('color', color);
  if (size) params.set('talle', size);
  return `${PRODUCT_PAGE}?${params}`;
}
