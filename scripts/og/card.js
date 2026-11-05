// Link preview cards (1200×630): one per product on sale, in its default color, and one for the store.
// scripts/og-images.mjs opens card.html in Chromium and saves window.drawCard(name) as assets/og/<name>.jpg
// in the site the deploy publishes.
// The shirt is drawn by the store's own renderer, so the preview matches the page.

import { normalizeCatalog } from '../../src/catalog.js';
import { localizeJson, DEFAULT_LANG } from '../../src/i18n.js';
import { fetchCatalog, loadFonts, loadProductImages } from '../../src/loader.js';
import { loadImage, prepareShirt } from '../../src/shirt.js';
import { renderProduct } from '../../src/render.js';
import { normalizeStoreConfig } from '../../src/store/config.js';
import { storeProducts, defaultColorFor } from '../../src/store/products.js';
import { storeShirts, STORE_CARD, LOGO } from '../og-cards.mjs';
import { moneyFormat } from '../../src/store/money.js';

const WIDTH = 1200;
const HEIGHT = 630;
const JPEG_QUALITY = 0.86;
const GREEN = '#8cc63f';
const TEXT = '#f2f5ee';
const MUTED = '#a9b3a2';
const SANS = 'system-ui, "Noto Sans", "DejaVu Sans", Arial, sans-serif';
const DOMAIN = 'store.mostro.network';

const ready = (async () => {
  const raw = localizeJson(await fetchCatalog('catalog.json'), DEFAULT_LANG);
  const { catalog } = normalizeCatalog(raw);
  const { config } = normalizeStoreConfig(raw.store, catalog.colors.map((color) => color.id));
  const products = storeProducts(catalog, config);
  const [base, , images, logo] = await Promise.all([
    loadImage(catalog.base.image), loadFonts(catalog.fonts), loadProductImages(products), loadImage(LOGO),
  ]);
  const shirt = prepareShirt(base, catalog.base.shading);
  return { catalog, config, products, shirt, images, logo, money: moneyFormat(DEFAULT_LANG, config.currency) };
})();

function shirtCanvas(state, product, colorId, height) {
  const canvas = document.createElement('canvas');
  renderProduct(canvas, {
    shirt: state.shirt,
    product,
    image: state.images.get(product.id) ?? null,
    hex: state.catalog.colors.find((color) => color.id === colorId).hex,
    printArea: state.catalog.base.printArea,
    scale: height / state.shirt.height,
  });
  return canvas;
}

function background(context) {
  context.fillStyle = '#0e130c';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = context.createRadialGradient(330, 315, 40, 330, 315, 430);
  glow.addColorStop(0, 'rgba(140, 198, 63, 0.28)');
  glow.addColorStop(1, 'rgba(140, 198, 63, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

/** Greedy word wrap of `text` at the current font. */
function wrap(context, text, maxWidth) {
  return text.split(/\s+/).reduce((lines, word) => {
    const last = lines.at(-1);
    if (last !== undefined && context.measureText(`${last} ${word}`).width <= maxWidth) return [...lines.slice(0, -1), `${last} ${word}`];
    return [...lines, word];
  }, []);
}

const LINE_HEIGHT = 1.08;
const font = ({ size, family, weight = 'normal' }) => `${weight} ${size}px ${family}`;

/** The largest size (from `start` down to `min`) at which `text` fits in `maxLines` lines and `maxHeight` pixels. */
function fit(context, text, { family, weight, maxWidth, maxLines, maxHeight, start, min }) {
  for (let size = start; size > min; size -= 2) {
    context.font = font({ size, family, weight });
    const lines = wrap(context, text, maxWidth);
    if (lines.length <= maxLines && lines.length * size * LINE_HEIGHT <= maxHeight) return { size, lines };
  }
  context.font = font({ size: min, family, weight });
  return { size: min, lines: wrap(context, text, maxWidth).slice(0, maxLines) };
}

/** The largest size (from `start` down to `min`) at which every one of `lines` fits in `maxWidth`. */
function fitWidth(context, lines, { family, weight, maxWidth, start, min }) {
  for (let size = start; size > min; size -= 1) {
    context.font = font({ size, family, weight });
    if (lines.every((line) => context.measureText(line).width <= maxWidth)) return size;
  }
  return min;
}

function footer(context, state, x) {
  const height = 56;
  const width = (state.logo.naturalWidth / state.logo.naturalHeight) * height;
  const top = HEIGHT - 50 - height;
  context.drawImage(state.logo, x, top, width, height);
  context.fillStyle = MUTED;
  context.font = font({ size: 26, family: SANS, weight: 600 });
  context.textBaseline = 'middle';
  context.fillText(DOMAIN, x + width + 16, top + height / 2);
}

function text(context, lines, { x, y, size, family, weight, color, lineHeight = LINE_HEIGHT }) {
  context.fillStyle = color;
  context.font = font({ size, family, weight });
  context.textBaseline = 'top';
  lines.forEach((line, i) => context.fillText(line, x, y + i * size * lineHeight));
  return y + lines.length * size * lineHeight;
}

const label = (context, x, y) => text(context, ['MOSTRO STORE'], { x, y, size: 24, family: SANS, weight: 800, color: GREEN });

function productCard(context, state, product) {
  const colorId = defaultColorFor(product, state.config);
  context.drawImage(shirtCanvas(state, product, colorId, 560), 70, 35);
  const x = 640;
  // Series shirts carry their quote in the series font; full designs use the bold sans
  const nameFont = product.style?.fontFamily
    ? { family: `"${product.style.fontFamily}", ${SANS}`, weight: 'normal' }
    : { family: SANS, weight: 800 };
  const name = fit(context, product.name, { ...nameFont, maxWidth: 500, maxLines: 3, maxHeight: 240, start: 76, min: 36 });
  label(context, x, 72);
  text(context, name.lines, { x, y: 116, size: name.size, ...nameFont, color: TEXT });
  text(context, [state.money.price(product.price)], { x, y: 384, size: 44, family: SANS, weight: 700, color: TEXT });
  text(context, ['Pay with Lightning'], { x, y: 440, size: 28, family: SANS, weight: 600, color: GREEN });
  footer(context, state, x);
}

// The two side shirts first, so the middle one (bigger) lies on top
const STORE_LAYOUT = Object.freeze([{ slot: 0, x: 20, y: 130, height: 400 }, { slot: 2, x: 330, y: 130, height: 400 }, { slot: 1, x: 165, y: 80, height: 470 }]);

function storeCard(context, state) {
  // A catalog with fewer than three shirts on sale leaves slots empty
  const shirts = storeShirts(state.products, state.config);
  STORE_LAYOUT.forEach(({ slot, x, y, height }) => {
    const shirt = shirts.find((entry) => entry.slot === slot);
    if (shirt) context.drawImage(shirtCanvas(state, shirt.product, shirt.colorId, height), x, y);
  });
  const x = 700;
  const maxWidth = 440;
  const family = `"LuckiestGuy-Regular", ${SANS}`;
  const title = fit(context, 'Mostro T-shirts', { family, maxWidth, maxLines: 2, maxHeight: 200, start: 84, min: 40 });
  label(context, x, 92);
  const after = text(context, title.lines, { x, y: 136, size: title.size, family, color: TEXT });
  // The sans is whatever the machine has (Noto Sans here, the wider DejaVu Sans on the CI runner)
  const tagline = ['Pay with Lightning.', 'Orders encrypted over Nostr.'];
  const size = fitWidth(context, tagline, { family: SANS, weight: 600, maxWidth, start: 30, min: 20 });
  text(context, tagline, { x, y: after + 24, size, family: SANS, weight: 600, color: MUTED, lineHeight: 1.3 });
  footer(context, state, x);
}

/** JPEG data URL of the card `name`: "store" or a product id. */
window.drawCard = async (name) => {
  const state = await ready;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  background(context);
  if (name === STORE_CARD) storeCard(context, state);
  else productCard(context, state, state.products.find((product) => product.id === name));
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};
