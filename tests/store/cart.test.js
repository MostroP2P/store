import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_CART,
  MAX_QUANTITY,
  lineKey,
  addItem,
  setQuantity,
  removeItem,
  cartCount,
  variantQuantity,
  sanitizeCart,
  resolveCart,
} from '../../src/store/cart.js';

const LOVE_BLACK_L = { productId: 'love', colorId: 'black', size: 'L' };
const LOVE_RED_M = { productId: 'love', colorId: 'red', size: 'M' };

const PRODUCTS = [
  { id: 'love', name: 'Love at first sat', price: 30000, colors: ['black', 'red'] },
  { id: 'hold', name: 'Hold my invoice', price: 35000, colors: ['black'] },
];
const COLORS = [
  { id: 'black', name: 'Negro', hex: '#1a1a1a' },
  { id: 'red', name: 'Rojo', hex: '#c81e28' },
];
const SIZES = ['S', 'M', 'L'];
const isKnown = ({ productId, colorId, size }) => {
  const product = PRODUCTS.find((p) => p.id === productId);
  return Boolean(product && product.colors.includes(colorId) && SIZES.includes(size));
};

test('lineKey identifies a product, color and size', () => {
  assert.equal(lineKey(LOVE_BLACK_L), 'love|black|L');
});

test('addItem appends a new line and never mutates the cart', () => {
  const cart = addItem(EMPTY_CART, LOVE_BLACK_L);
  assert.deepEqual(cart.items, [{ ...LOVE_BLACK_L, quantity: 1 }]);
  assert.deepEqual(EMPTY_CART.items, []);
});

test('addItem increases an existing line and caps it', () => {
  const once = addItem(EMPTY_CART, LOVE_BLACK_L);
  const twice = addItem(once, LOVE_BLACK_L, 2);
  assert.equal(twice.items[0].quantity, 3);
  assert.equal(once.items[0].quantity, 1);
  assert.equal(addItem(twice, LOVE_BLACK_L, 500).items[0].quantity, MAX_QUANTITY);
});

test('setQuantity changes one line, removes it at 0 and ignores invalid values', () => {
  const cart = addItem(addItem(EMPTY_CART, LOVE_BLACK_L), LOVE_RED_M);
  assert.equal(setQuantity(cart, 'love|red|M', 4).items[1].quantity, 4);
  assert.equal(setQuantity(cart, 'love|red|M', 999).items[1].quantity, MAX_QUANTITY);
  assert.deepEqual(setQuantity(cart, 'love|red|M', 0).items, [{ ...LOVE_BLACK_L, quantity: 1 }]);
  assert.equal(setQuantity(cart, 'love|red|M', 'dos'), cart);
  assert.equal(setQuantity(cart, 'love|red|M', 2.5).items[1].quantity, 2);
  assert.equal(setQuantity(cart, 'nope|x|S', 3), cart);
});

test('removeItem drops one line', () => {
  const cart = addItem(addItem(EMPTY_CART, LOVE_BLACK_L), LOVE_RED_M);
  assert.deepEqual(removeItem(cart, 'love|black|L').items, [{ ...LOVE_RED_M, quantity: 1 }]);
});

test('cartCount and variantQuantity add up quantities', () => {
  const cart = addItem(addItem(EMPTY_CART, LOVE_BLACK_L, 2), LOVE_RED_M, 3);
  assert.equal(cartCount(cart), 5);
  assert.equal(variantQuantity(cart, LOVE_RED_M), 3);
  assert.equal(variantQuantity(cart, { ...LOVE_RED_M, size: 'S' }), 0);
});

test('sanitizeCart rebuilds a cart from untrusted storage data', () => {
  assert.deepEqual(sanitizeCart(null, isKnown), EMPTY_CART);
  assert.deepEqual(sanitizeCart({ items: 'nope' }, isKnown), EMPTY_CART);
  const raw = {
    items: [
      { ...LOVE_BLACK_L, quantity: 2 },
      { ...LOVE_BLACK_L, quantity: 1 },
      { ...LOVE_RED_M, quantity: 99 },
      { productId: 'gone', colorId: 'black', size: 'L', quantity: 1 },
      { ...LOVE_BLACK_L, quantity: -1 },
      { ...LOVE_BLACK_L, quantity: '3' },
      'garbage',
    ],
  };
  assert.deepEqual(sanitizeCart(raw, isKnown).items, [
    { ...LOVE_BLACK_L, quantity: 3 },
    { ...LOVE_RED_M, quantity: MAX_QUANTITY },
  ]);
});

test('resolveCart prices every line and skips unknown products or colors', () => {
  const cart = {
    items: [
      { ...LOVE_BLACK_L, quantity: 2 },
      { productId: 'hold', colorId: 'black', size: 'M', quantity: 1 },
      { productId: 'gone', colorId: 'black', size: 'M', quantity: 1 },
      { productId: 'hold', colorId: 'pink', size: 'M', quantity: 1 },
    ],
  };
  const { lines, subtotal, count } = resolveCart(cart, { products: PRODUCTS, colors: COLORS });
  assert.deepEqual(lines.map((l) => [l.key, l.product.name, l.color.name, l.size, l.quantity, l.unitPrice, l.total]), [
    ['love|black|L', 'Love at first sat', 'Negro', 'L', 2, 30000, 60000],
    ['hold|black|M', 'Hold my invoice', 'Negro', 'M', 1, 35000, 35000],
  ]);
  assert.equal(subtotal, 95000);
  assert.equal(count, 3);
});
