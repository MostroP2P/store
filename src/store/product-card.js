// Product card (collection and "Te puede interesar"): shirt in its default color, name, price and colors.

import { el } from '../dom.js';
import { drawProduct, colorById } from './boot.js';
import { defaultColorFor } from './products.js';
import { productHref } from './query.js';
import { formatPrice } from './money.js';
import { STRINGS } from './strings.js';

const CARD_SCALE = 0.4;

function colorDots(store, product) {
  const dots = product.colors.map((id) => {
    const color = colorById(store, id);
    const dot = el('span', { className: 'color-dot', title: color.name });
    dot.style.setProperty('--swatch', color.hex);
    return dot;
  });
  const names = product.colors.map((id) => colorById(store, id).name).join(', ');
  return el('span', { className: 'product-card-colors' }, [
    el('span', { className: 'visually-hidden', textContent: `${STRINGS.availableIn} ${names}` }),
    el('span', { 'aria-hidden': 'true', className: 'color-dots' }, dots),
  ]);
}

export function productCard(store, product) {
  const canvas = el('canvas', { 'aria-hidden': 'true' });
  drawProduct(store, canvas, product, defaultColorFor(product, store.config), CARD_SCALE);
  return el('a', { className: 'product-card', href: productHref({ id: product.id }) }, [
    el('span', { className: 'product-stage' }, [canvas]),
    el('span', { className: 'product-card-name', textContent: product.name }),
    el('span', { className: 'price-mono', textContent: formatPrice(product.price) }),
    colorDots(store, product),
  ]);
}
