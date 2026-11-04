// Cart state shared by the store pages: saved in localStorage, announced to subscribers on every change.

import { EMPTY_CART, addItem, setQuantity, removeItem, sanitizeCart } from './cart.js';
import { readJson, writeJson } from './persist.js';

export const CART_STORAGE_KEY = 'mostro-store:cart';

/**
 * storage: window.localStorage (or null: the cart then lives only in memory).
 * isValidVariant({ productId, colorId, size }): false drops lines of products no longer on sale.
 */
export function createCartStore({ storage, isValidVariant }) {
  const load = () => sanitizeCart(readJson(storage, CART_STORAGE_KEY, null), isValidVariant);
  const listeners = new Set();
  // The only mutable binding: always replaced by a new immutable cart
  let cart = load();

  const notify = () => listeners.forEach((listener) => listener(cart));
  const commit = (next) => {
    cart = next;
    writeJson(storage, CART_STORAGE_KEY, cart);
    notify();
  };

  return {
    get: () => cart,
    add: (variant, quantity = 1) => commit(addItem(cart, variant, quantity)),
    setQuantity: (key, quantity) => commit(setQuantity(cart, key, quantity)),
    remove: (key) => commit(removeItem(cart, key)),
    clear: () => commit(EMPTY_CART),
    /** Re-reads storage, e.g. after another tab changed the cart. */
    reload: () => {
      cart = load();
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
