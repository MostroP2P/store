// Viewer entry point: loads catalog, fonts and images, then keeps the UI in sync with the URL state.

import { normalizeCatalog, DESIGNS_GROUP_ID } from '../catalog.js';
import { parseHash, toHash, resolveColor, DEFAULT_FILTER } from './state.js';
import { loadImage, prepareShirt } from '../shirt.js';
import { renderProduct, WARNING_TEXT_TOO_LONG } from '../render.js';
import { fetchCatalog, loadFonts, loadProductImages } from '../loader.js';
import { STRINGS } from './strings.js';
import * as ui from './ui.js';

const THUMB_SCALE = 0.45;
const DEBUG = new URLSearchParams(window.location.search).has('debug');

const $ = (selector) => document.querySelector(selector);

function filterList(catalog) {
  const hasDesigns = catalog.products.some((p) => p.groupId === DESIGNS_GROUP_ID);
  return [
    { id: DEFAULT_FILTER, label: STRINGS.filterAll },
    ...(hasDesigns ? [{ id: DESIGNS_GROUP_ID, label: STRINGS.filterDesigns }] : []),
    ...catalog.groups.map((group) => ({ id: group.id, label: group.name })),
  ];
}

function productBadges(product, color, image, warnings) {
  const notRecommended = !color.isCustom && product.colors !== null && !product.colors.includes(color.key);
  return [
    ...(image ? [] : [{ text: STRINGS.imageNotFound(product.image), level: 'error' }]),
    ...(notRecommended ? [{ text: STRINGS.notRecommended, level: 'warning' }] : []),
    ...(product.status === 'published' ? [] : [{ text: STRINGS.draft, level: 'info' }]),
    ...(warnings.includes(WARNING_TEXT_TOO_LONG) ? [{ text: STRINGS.textTooLong, level: 'warning' }] : []),
  ];
}

function renderCanvas(view, canvas, product, color, scale) {
  const image = view.images.get(product.id);
  const { warnings } = renderProduct(canvas, {
    shirt: view.shirt,
    product,
    image,
    hex: color.hex,
    printArea: view.catalog.base.printArea,
    scale,
    debug: DEBUG,
  });
  return productBadges(product, color, image, warnings);
}

function syncDetail(view, color) {
  const product = view.catalog.products.find((p) => p.id === view.state.shirt);
  if (!product) {
    if (view.dialog.open) view.dialog.close();
    return;
  }
  $('#detail-title').textContent = product.name;
  ui.setBadges($('#detail-badges'), renderCanvas(view, view.detailCanvas, product, color, 1));
  if (!view.dialog.open) view.dialog.showModal();
}

/** Applies a new state: URL, selectors, card visibility, thumbnails (only when the color changes) and detail. */
function applyState(view, next, { force = false } = {}) {
  const colorChanged = force || next.color !== view.state.color;
  view.state = next;
  const hash = toHash(next);
  if (window.location.hash.slice(1) !== hash) window.history.replaceState(null, '', `#${hash}`);

  const color = resolveColor(next.color, view.catalog.colors);
  view.swatchGroups.forEach((group) => ui.syncSwatches(group, next.color));
  ui.syncFilters(view.filtersBox, next.filter);
  view.catalog.products.forEach((product) => {
    const { card, canvas, badges } = view.cards.get(product.id);
    card.hidden = next.filter !== DEFAULT_FILTER && product.groupId !== next.filter;
    if (colorChanged) ui.setBadges(badges, renderCanvas(view, canvas, product, color, THUMB_SCALE));
  });
  syncDetail(view, color);
}

function bindEvents(view, known, setState) {
  view.dialog.addEventListener('close', () => {
    if (view.state.shirt) setState({ shirt: null });
  });
  $('#detail-download').addEventListener('click', async () => {
    const color = resolveColor(view.state.color, view.catalog.colors);
    try {
      await ui.downloadCanvas(view.detailCanvas, `${view.state.shirt}-${color.key}.png`);
    } catch (err) {
      ui.setBadges($('#detail-badges'), [{ text: STRINGS.downloadFailed(err.message), level: 'error' }]);
    }
  });
  window.addEventListener('hashchange', () => applyState(view, parseHash(window.location.hash, known)));
}

function startViewer({ catalog, shirt, images }) {
  const filters = filterList(catalog);
  const known = {
    colorIds: catalog.colors.map((c) => c.id),
    productIds: catalog.products.map((p) => p.id),
    filterIds: filters.map((f) => f.id),
  };
  // `view` is the viewer's single mutable holder; `view.state` is always replaced, never mutated
  const view = {
    catalog,
    shirt,
    images,
    state: parseHash(window.location.hash, known),
    swatchGroups: [$('#swatches'), $('#detail-swatches')],
    filtersBox: $('#filters'),
    dialog: $('#detail'),
    detailCanvas: $('#detail-canvas'),
  };
  const setState = (patch) => applyState(view, { ...view.state, ...patch });

  view.swatchGroups.forEach((group) => ui.createSwatches(group, catalog.colors, (color) => setState({ color })));
  ui.createFilters(view.filtersBox, filters, (filter) => setState({ filter }));
  view.cards = ui.createCards($('#grid'), catalog.products, (id) => setState({ shirt: id }));
  bindEvents(view, known, setState);
  applyState(view, view.state, { force: true });
}

async function boot(problemsBox) {
  let raw;
  try {
    raw = await fetchCatalog();
  } catch (err) {
    ui.showProblems(problemsBox, [{ level: 'error', message: STRINGS.catalogNotLoaded(err.message) }]);
    return;
  }

  const { catalog, problems } = normalizeCatalog(raw);
  if (!catalog) {
    ui.showProblems(problemsBox, problems);
    return;
  }

  const [baseImage, failedFonts, images] = await Promise.all([
    loadImage(catalog.base.image).catch(() => null),
    loadFonts(catalog.fonts),
    loadProductImages(catalog.products),
  ]);
  const fontProblems = failedFonts.map((file) => ({ level: 'warning', message: STRINGS.fontNotLoaded(file) }));
  if (!baseImage) {
    ui.showProblems(problemsBox, [...problems, { level: 'error', message: STRINGS.baseNotLoaded(catalog.base.image) }]);
    return;
  }

  ui.showProblems(problemsBox, [...problems, ...fontProblems]);
  startViewer({ catalog, shirt: prepareShirt(baseImage, catalog.base.shading), images });
}

async function main() {
  const problemsBox = $('#problems');
  try {
    await boot(problemsBox);
  } catch (err) {
    // e.g. a cross-origin base image (tainted canvas) or a corrupt image
    ui.showProblems(problemsBox, [{ level: 'error', message: STRINGS.unexpectedError(err.message) }]);
  }
}

main();
