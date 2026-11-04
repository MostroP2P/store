// Product page (producto.html?id=…&color=…&talle=…), like kinoto.com.ar/item/…: color and size,
// size guide, price, "Agregar al carrito" and "Comprar" (adds to the cart and goes to checkout).

import { el } from '../dom.js';
import { startPage, drawProduct, colorById } from './boot.js';
import { mountCart } from './cart-ui.js';
import { productCard } from './product-card.js';
import { createSizeGuide } from './size-guide.js';
import { relatedProducts } from './products.js';
import { parseProductQuery, productHref } from './query.js';
import { variantQuantity } from './cart.js';
import { formatPrice } from './money.js';
import { icon } from './icons.js';
import { STRINGS } from './strings.js';

const PRODUCT_SCALE = 1;
const RELATED_COUNT = 4;
const CHECKOUT_PAGE = 'checkout.html';

const $ = (id) => document.getElementById(id);

function colorOptions(store, product, onPick) {
  return product.colors.map((id) => {
    const color = colorById(store, id);
    const input = el('input', { type: 'radio', name: 'color', value: id, className: 'visually-hidden', onchange: () => onPick(id) });
    const dot = el('span', { className: 'swatch-dot', 'aria-hidden': 'true' });
    dot.style.setProperty('--swatch', color.hex);
    return el('label', { className: 'color-option', title: color.name }, [
      input, dot, el('span', { className: 'visually-hidden', textContent: color.name }),
    ]);
  });
}

function details(store) {
  return store.config.details.map(({ title, text }, i) => el('details', { className: 'accordion', open: i === 0 }, [
    el('summary', { textContent: title }),
    ...text.split(/\n{2,}/).map((paragraph) => el('p', { textContent: paragraph })),
  ]));
}

/** Reflects the selection: canvas (only when the color changes), labels, cart count and URL. */
function sync(view, next) {
  view.selection = next;
  const { product, colorId, size } = next;
  const colorName = colorById(view.store, colorId).name;
  if (colorId !== view.drawnColorId) {
    drawProduct(view.store, $('product-canvas'), product, colorId, PRODUCT_SCALE);
    $('product-canvas').setAttribute('aria-label', STRINGS.productImage(product.name, colorName));
    view.drawnColorId = colorId;
  }
  $('color-name').textContent = colorName;
  document.querySelectorAll('input[name="color"]').forEach((input) => { input.checked = input.value === colorId; });
  $('size-select').value = size;
  const inCart = variantQuantity(view.store.cart.get(), { productId: product.id, colorId, size });
  $('add-label').textContent = inCart > 0 ? STRINGS.addToCartCount(inCart) : STRINGS.addToCart;
  // Compare only the query: GitHub Pages also serves this page as /producto (without .html)
  const href = productHref({ id: product.id, color: colorId, size });
  if (window.location.search !== href.slice(href.indexOf('?'))) window.history.replaceState(null, '', href);
}

function fillProduct(view) {
  const { store, selection: { product } } = view;
  document.title = STRINGS.pageTitle(product.name);
  $('product-name').textContent = product.name;
  $('product-lead').textContent = product.description ?? '';
  $('product-lead').hidden = !product.description;
  $('product-price').textContent = formatPrice(product.price);
  $('color-options').replaceChildren(...colorOptions(store, product, (colorId) => sync(view, { ...view.selection, colorId })));
  $('size-select').replaceChildren(...store.config.sizes.map((s) => el('option', { value: s.id, textContent: s.id })));
  $('product-details').replaceChildren(...details(store));
  $('related').replaceChildren(...relatedProducts(store.products, product, RELATED_COUNT).map((p) => productCard(store, p)));
  $('related-section').hidden = $('related').children.length === 0;
}

function bindActions(view) {
  const variant = () => ({ productId: view.selection.product.id, colorId: view.selection.colorId, size: view.selection.size });
  const guide = createSizeGuide(view.store.config.sizes);
  $('size-guide-button').addEventListener('click', guide.open);
  $('size-select').addEventListener('change', (event) => sync(view, { ...view.selection, size: event.target.value }));
  // The cart reaches the checkout page only through storage: say so instead of opening an empty checkout
  const warnUnsaved = (saved) => {
    $('storage-warning').hidden = saved;
    $('storage-warning').textContent = saved ? '' : STRINGS.storageBlocked;
    return saved;
  };
  $('add-to-cart').addEventListener('click', () => {
    if (warnUnsaved(view.store.cart.add(variant()))) $('cart-status').textContent = STRINGS.addedToCart;
  });
  $('buy-now').addEventListener('click', () => {
    if (warnUnsaved(view.store.cart.add(variant()))) window.location.assign(CHECKOUT_PAGE);
  });
  view.store.cart.subscribe(() => sync(view, view.selection));
}

function showNotFound() {
  document.querySelector('main').replaceChildren(el('section', { className: 'store-message' }, [
    el('h1', { textContent: STRINGS.productNotFound }),
    el('a', { className: 'button-primary', href: 'index.html' }, [icon('arrowLeft'), STRINGS.seeCollection]),
  ]));
}

startPage((store) => {
  mountCart(store);
  const selection = parseProductQuery(window.location.search, store.products, store.config);
  if (!selection.product) {
    showNotFound();
    return;
  }
  // `view` is the page's single mutable holder; `view.selection` is always replaced, never mutated
  const view = { store, selection, drawnColorId: null };
  fillProduct(view);
  bindActions(view);
  sync(view, selection);
  $('product').hidden = false;
});
