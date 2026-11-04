import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCartStore, CART_STORAGE_KEY } from '../../src/store/cart-store.js';
import { lineKey } from '../../src/store/cart.js';

const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
};

const VARIANT = { productId: 'love', colorId: 'black', size: 'L' };
const isValidVariant = ({ productId }) => productId === 'love';

test('starts from the saved cart, dropping unknown products', () => {
  const saved = JSON.stringify({ items: [{ ...VARIANT, quantity: 2 }, { productId: 'gone', colorId: 'black', size: 'L', quantity: 1 }] });
  const store = createCartStore({ storage: memoryStorage({ [CART_STORAGE_KEY]: saved }), isValidVariant });
  assert.deepEqual(store.get().items, [{ ...VARIANT, quantity: 2 }]);
});

test('every change is saved and announced to subscribers', () => {
  const storage = memoryStorage();
  const store = createCartStore({ storage, isValidVariant });
  const seen = [];
  const unsubscribe = store.subscribe((cart) => seen.push(cart.items.length));

  store.add(VARIANT);
  store.add(VARIANT);
  assert.equal(store.get().items[0].quantity, 2);
  assert.deepEqual(JSON.parse(storage.data.get(CART_STORAGE_KEY)).items, [{ ...VARIANT, quantity: 2 }]);

  store.setQuantity(lineKey(VARIANT), 5);
  assert.equal(store.get().items[0].quantity, 5);
  store.remove(lineKey(VARIANT));
  assert.deepEqual(store.get().items, []);
  store.add(VARIANT);
  store.clear();
  assert.deepEqual(store.get().items, []);
  assert.deepEqual(seen, [1, 1, 1, 0, 1, 0]);

  unsubscribe();
  store.add(VARIANT);
  assert.equal(seen.length, 6);
});

test('reload picks up a change made in another tab', () => {
  const storage = memoryStorage();
  const store = createCartStore({ storage, isValidVariant });
  const seen = [];
  store.subscribe((cart) => seen.push(cart.items.length));
  storage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: [{ ...VARIANT, quantity: 1 }] }));
  store.reload();
  assert.equal(store.get().items.length, 1);
  assert.deepEqual(seen, [1]);
});

test('still works in memory when storage is unavailable, and says the change was not saved', () => {
  const store = createCartStore({ storage: null, isValidVariant });
  assert.equal(store.add(VARIANT), false);
  assert.equal(store.get().items[0].quantity, 1);
  assert.equal(createCartStore({ storage: memoryStorage(), isValidVariant }).add(VARIANT), true);
});

test('subtract takes away a finished order and keeps the rest', () => {
  const store = createCartStore({ storage: memoryStorage(), isValidVariant });
  store.add(VARIANT, 3);
  const bought = [{ ...VARIANT, quantity: 2 }];
  store.subtract(bought);
  assert.deepEqual(store.get().items, [{ ...VARIANT, quantity: 1 }]);
});
