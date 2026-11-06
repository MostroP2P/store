// Store bootstrap shared by the three pages: language, catalog, store settings, fonts, images, shirt and cart.

import { el } from '../dom.js';
import { normalizeCatalog } from '../catalog.js';
import { localizeJson } from '../i18n.js';
import { loadImage, prepareShirt } from '../shirt.js';
import { renderProduct } from '../render.js';
import { fetchCatalog, loadFonts, loadProductImages } from '../loader.js';
import { normalizeStoreConfig } from './config.js';
import { storeProducts } from './products.js';
import { createCartStore, CART_STORAGE_KEY } from './cart-store.js';
import { moneyFormat } from './money.js';
import { browserStorage } from './persist.js';
import { icon } from './icons.js';
import { LANG, T, translatePage, mountLanguageSwitch } from './lang.js';

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
  // catalog.json texts come as { "en": …, "es": … }: keep the page language
  const raw = localizeJson(await fetchCatalog(), LANG);
  const { catalog } = normalizeCatalog(raw);
  if (!catalog) throw new Error(T.catalogInvalid);
  const { config } = normalizeStoreConfig(raw.store, catalog.colors.map((c) => c.id));
  if (!config) throw new Error(T.storeNotConfigured);

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
    money: moneyFormat(LANG, config.currency),
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
  translatePage(document);
  // The notice is for scripts that never started. Without the stylesheet it would stay on screen, and
  // its reload link with it, through a checkout that locks reloads away while an invoice is in flight.
  document.querySelector('.boot-notice')?.remove();
  mountLanguageSwitch(document.getElementById('lang-switch'));
  const main = document.querySelector('main');
  try {
    run(await loadStore());
  } catch (err) {
    main.replaceChildren(el('section', { className: 'store-message' }, [
      el('h1', { textContent: T.storeUnavailable }),
      el('p', { className: 'muted', textContent: err.message }),
    ]));
  }
}
