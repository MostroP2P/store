// What is on sale (pure): published products with their final price and the colors they come in.

import { DESIGNS_GROUP_ID } from '../catalog.js';

const PUBLISHED = 'published';

/** Published products; price falls back to the store price and colors to every catalog color. */
export function storeProducts(catalog, config) {
  const allColors = catalog.colors.map((color) => color.id);
  return catalog.products
    .filter((product) => product.status === PUBLISHED)
    .map((product) => ({
      ...product,
      price: product.price ?? config.price,
      colors: product.colors?.length ? product.colors : allColors,
    }));
}

export function defaultColorFor(product, config) {
  return product.colors.includes(config.defaultColor) ? config.defaultColor : product.colors[0];
}

/** "Te puede interesar": products of the same group first, never the product itself. */
export function relatedProducts(products, product, count) {
  const others = products.filter((p) => p.id !== product.id);
  return [
    ...others.filter((p) => p.groupId === product.groupId),
    ...others.filter((p) => p.groupId !== product.groupId),
  ].slice(0, count);
}

/** Home page sections: designs first, then each series, skipping empty ones. */
export function groupSections(products, groups, designsLabel) {
  return [{ id: DESIGNS_GROUP_ID, name: designsLabel }, ...groups]
    .map((group) => ({ ...group, products: products.filter((p) => p.groupId === group.id) }))
    .filter((section) => section.products.length > 0);
}
