// Header cart button + "Tu carrito" panel, like kinoto.com.ar: change quantities, remove lines,
// empty the cart or go to checkout. Re-renders on every cart change while it is open.

import { el } from '../dom.js';
import { resolveCart, cartCount, MAX_QUANTITY } from './cart.js';
import { drawProduct } from './boot.js';
import { formatPrice } from './money.js';
import { productHref } from './query.js';
import { icon } from './icons.js';
import { STRINGS } from './strings.js';

const THUMB_SCALE = 0.12;
const CHECKOUT_PAGE = 'checkout.html';
const BUMP_CLASS = 'is-bumped';
const BUMP_MS = 450;

function stepper(store, line) {
  const name = line.product.name;
  const input = el('input', {
    type: 'number', min: 1, max: MAX_QUANTITY, inputMode: 'numeric', value: line.quantity,
    'aria-label': STRINGS.quantityOf(name), dataset: { focus: `${line.key}:qty` },
    // An emptied field is not "0": NaN leaves the line as it was (and re-renders the old quantity)
    onchange: (event) => {
      const value = event.target.value.trim();
      store.cart.setQuantity(line.key, value === '' ? Number.NaN : Number(value));
    },
  });
  const step = (delta, iconName, label, role) => el('button', {
    type: 'button', className: 'stepper-button', 'aria-label': label, dataset: { focus: `${line.key}:${role}` },
    onclick: () => store.cart.setQuantity(line.key, line.quantity + delta),
  }, [icon(iconName)]);
  return el('span', { className: 'stepper' }, [
    step(-1, 'minus', STRINGS.decrease(name), 'minus'), input, step(1, 'plus', STRINGS.increase(name), 'plus'),
  ]);
}

function cartLine(store, line) {
  const canvas = el('canvas', { className: 'cart-thumb', 'aria-hidden': 'true' });
  drawProduct(store, canvas, line.product, line.color.id, THUMB_SCALE);
  const href = productHref({ id: line.product.id, color: line.color.id, size: line.size });
  return el('li', { className: 'cart-line' }, [
    canvas,
    el('div', { className: 'cart-line-body' }, [
      el('a', { className: 'cart-line-name', href, textContent: line.product.name }),
      el('div', { className: 'chips' }, [
        el('span', { className: 'chip', textContent: line.color.name }),
        el('span', { className: 'chip', textContent: STRINGS.sizeChip(line.size) }),
        stepper(store, line),
        el('span', { className: 'chip price-mono', textContent: formatPrice(line.unitPrice) }),
        ...(line.quantity > 1 ? [el('span', { className: 'chip chip-strong price-mono', textContent: formatPrice(line.total) })] : []),
      ]),
      el('button', {
        type: 'button', className: 'button-danger-small', dataset: { focus: `${line.key}:remove` },
        onclick: () => store.cart.remove(line.key),
      }, [icon('trash'), STRINGS.removeFromCart]),
    ]),
  ]);
}

function summary(store, subtotal) {
  return el('aside', { className: 'cart-summary' }, [
    el('p', { className: 'sum-row' }, [`${STRINGS.subtotal}: `, el('strong', { textContent: formatPrice(subtotal) })]),
    el('p', { className: 'sum-row' }, [`${STRINGS.shipping}: `, el('strong', { textContent: STRINGS.shippingValue })]),
    el('p', { className: 'sum-note' }, [icon('info'), STRINGS.shippingNote]),
    el('p', { className: 'sum-total' }, [`${STRINGS.total}: `, el('strong', { textContent: formatPrice(subtotal) })]),
    el('div', { className: 'cart-actions' }, [
      el('a', { className: 'button-primary button-block', href: CHECKOUT_PAGE }, [icon('card'), STRINGS.checkout]),
      el('button', { type: 'button', className: 'button-outline-danger button-block', onclick: () => store.cart.clear() },
        [icon('trash'), STRINGS.emptyCart]),
    ]),
  ]);
}

function renderPanel(store, body) {
  const { lines, subtotal } = resolveCart(store.cart.get(), { products: store.products, colors: store.catalog.colors });
  if (lines.length === 0) {
    body.replaceChildren(el('p', { className: 'cart-empty', textContent: STRINGS.cartEmpty }));
    return;
  }
  const focused = document.activeElement?.dataset?.focus;
  body.replaceChildren(
    el('ul', { className: 'cart-lines' }, lines.map((line) => cartLine(store, line))),
    summary(store, subtotal),
  );
  // Keep the keyboard focus on the same control after re-rendering
  if (focused) body.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus();
}

function buildDialog() {
  const body = el('div', { className: 'cart-body' });
  const close = el('button', { type: 'button', className: 'icon-button', 'aria-label': STRINGS.close }, [icon('close')]);
  const dialog = el('dialog', { className: 'cart-panel', 'aria-labelledby': 'cart-title' }, [
    el('div', { className: 'cart-head' }, [el('h2', { id: 'cart-title', textContent: STRINGS.cartTitle }), close]),
    body,
  ]);
  close.addEventListener('click', () => dialog.close());
  // A click on the backdrop (outside the panel) closes it
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return { dialog, body, close };
}

/** Wires the header cart button (#cart-button, #cart-count) and returns { open }. */
export function mountCart(store) {
  const button = document.getElementById('cart-button');
  const badge = document.getElementById('cart-count');
  const { dialog, body, close } = buildDialog();
  document.body.append(dialog);

  let lastCount = cartCount(store.cart.get());
  const sync = (cart) => {
    const count = cartCount(cart);
    button.hidden = count === 0;
    badge.textContent = String(count);
    button.setAttribute('aria-label', STRINGS.cartButton(count));
    if (count > lastCount) {
      button.classList.add(BUMP_CLASS);
      setTimeout(() => button.classList.remove(BUMP_CLASS), BUMP_MS);
    }
    lastCount = count;
    if (dialog.open) renderPanel(store, body);
    if (dialog.open && count === 0) close.focus();
  };
  const open = () => {
    renderPanel(store, body);
    dialog.showModal();
  };
  button.addEventListener('click', open);
  store.cart.subscribe(sync);
  sync(store.cart.get());
  return { open };
}
