// Browser loading shared by the viewer and the store: catalog.json, fonts and product images.

import { loadImage } from './shirt.js';

export const CATALOG_URL = 'catalog.json';

/** catalog.json, revalidated so an edited catalog shows up on a normal reload. */
export async function fetchCatalog(url = CATALOG_URL) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Loads every font file; resolves to the files that failed (text then uses the fallback font). */
export async function loadFonts(fonts) {
  const results = await Promise.allSettled(fonts.map(async ({ family, file }) => {
    const face = await new FontFace(family, `url("${encodeURI(file)}")`).load();
    document.fonts.add(face);
  }));
  return fonts.filter((_, i) => results[i].status === 'rejected').map((font) => font.file);
}

/** Map<productId, HTMLImageElement | null>; a missing image becomes null. */
export async function loadProductImages(products) {
  const entries = await Promise.all(products.map((product) => loadImage(product.image)
    .then((image) => [product.id, image], () => [product.id, null])));
  return new Map(entries);
}
