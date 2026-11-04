// Store bootstrap shared by the three pages: catalog, store settings, fonts, images, shirt and cart.

import { el } from '../dom.js';
import { normalizeCatalog } from '../catalog.js';
import { loadImage, prepareShirt } from '../shirt.js';
import { renderProduct } from '../render.js';
import { fetchCatalog, loadFonts, loadProductImages } from '../loader.js';
import { normalizeStoreConfig } from './config.js';
import { storeProducts } from './products.js';
import { createCartStore, CART_STORAGE_KEY } from './cart-store.js';
import { icon } from './icons.js';
import { STRINGS } from './strings.js';

/** window.localStorage / window.sessionStorage, or null when the browser blocks it (privacy settings). */
function browserStorage(name) {
  try {
    return window[name];
  } catch {
    return null;
  }
}

const FETCH_TIMEOUT_MS = 10_000;

/** GET a JSON API (prices, invoices, payment status): no cache, no cookies, no referrer, 10 s at most. */
export async function fetchJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function variantChecker(products, config) {
  return ({ productId, colorId, size }) => {
    const product = products.find((p) => p.id === productId);
    return Boolean(product && product.colors.includes(colorId) && config.sizes.some((s) => s.id === size));
  };
}

/** Everything a store page needs. Throws with a readable message when the store cannot open. */
export async function loadStore() {
  const raw = await fetchCatalog();
  const { catalog } = normalizeCatalog(raw);
  if (!catalog) throw new Error(STRINGS.catalogInvalid);
  const { config } = normalizeStoreConfig(raw.store, catalog.colors.map((c) => c.id));
  if (!config) throw new Error(STRINGS.storeNotConfigured);

  const products = storeProducts(catalog, config);
  const [baseImage, , images] = await Promise.all([
    loadImage(catalog.base.image),
    loadFonts(catalog.fonts),
    loadProductImages(products),
  ]);
  const storage = browserStorage('localStorage');
  const cart = createCartStore({ storage, isValidVariant: variantChecker(products, config) });
  // Another tab changed the cart (or cleared storage)
  window.addEventListener('storage', (event) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) cart.reload();
  });
  // session: delivery data lives only in this tab (cleared when it closes)
  return {
    catalog, config, products, shirt: prepareShirt(baseImage, catalog.base.shading), images, cart, storage,
    session: browserStorage('sessionStorage'),
  };
}

export const colorById = (store, colorId) => store.catalog.colors.find((c) => c.id === colorId);

/** Draws `product` in `colorId` on `canvas` at `scale` (1 = base image size). */
export function drawProduct(store, canvas, product, colorId, scale) {
  renderProduct(canvas, {
    shirt: store.shirt,
    product,
    image: store.images.get(product.id) ?? null,
    hex: colorById(store, colorId).hex,
    printArea: store.catalog.base.printArea,
    scale,
  });
}

/** <span data-icon="cart"></span> in the static HTML → the SVG icon. */
function hydrateIcons(root) {
  root.querySelectorAll('[data-icon]').forEach((node) => node.replaceWith(icon(node.dataset.icon)));
}

/** Loads the store and runs the page; a store that cannot open shows a message instead. */
export async function startPage(run) {
  hydrateIcons(document);
  const main = document.querySelector('main');
  try {
    run(await loadStore());
  } catch (err) {
    main.replaceChildren(el('section', { className: 'store-message' }, [
      el('h1', { textContent: STRINGS.storeUnavailable }),
      el('p', { className: 'muted', textContent: err.message }),
    ]));
  }
}
