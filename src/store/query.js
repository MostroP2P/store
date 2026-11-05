// Product page URL (pure): product.html?id=…&color=…&size=…

import { defaultColorFor } from './products.js';

const PRODUCT_PAGE = 'product.html';
// Links shared before the page was renamed carry the size as ?talle=
const LEGACY_SIZE_PARAM = 'talle';

/** Reads the product, color and size from location.search; unknown color or size fall back to the defaults. */
export function parseProductQuery(search, products, config) {
  const params = new URLSearchParams(search);
  const product = products.find((p) => p.id === params.get('id')) ?? null;
  if (!product) return { product: null, colorId: null, size: null };
  const color = params.get('color');
  const size = params.get('size') ?? params.get(LEGACY_SIZE_PARAM);
  return {
    product,
    colorId: product.colors.includes(color) ? color : defaultColorFor(product, config),
    size: config.sizes.some((s) => s.id === size) ? size : config.defaultSize,
  };
}

export function productHref({ id, color, size }) {
  const params = new URLSearchParams({ id });
  if (color) params.set('color', color);
  if (size) params.set('size', size);
  return `${PRODUCT_PAGE}?${params}`;
}
