import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductQuery, productHref } from '../../src/store/query.js';

const PRODUCTS = [
  { id: 'love', colors: ['black', 'red'] },
  { id: 'invaders', colors: ['navy', 'white'] },
];
const CONFIG = { sizes: [{ id: 'S' }, { id: 'M' }, { id: 'L' }], defaultSize: 'L', defaultColor: 'black' };

test('reads a product, color and size from the query string', () => {
  const { product, colorId, size } = parseProductQuery('?id=love&color=red&size=M', PRODUCTS, CONFIG);
  assert.equal(product.id, 'love');
  assert.equal(colorId, 'red');
  assert.equal(size, 'M');
});

test('falls back to defaults for unknown colors or sizes', () => {
  assert.deepEqual(
    parseProductQuery('?id=love&color=pink&size=XXL', PRODUCTS, CONFIG),
    { product: PRODUCTS[0], colorId: 'black', size: 'L' },
  );
  assert.equal(parseProductQuery('?id=invaders', PRODUCTS, CONFIG).colorId, 'navy');
});

test('returns no product for a missing or unknown id', () => {
  assert.equal(parseProductQuery('', PRODUCTS, CONFIG).product, null);
  assert.equal(parseProductQuery('?id=nope', PRODUCTS, CONFIG).product, null);
});

test('productHref builds an encoded product link', () => {
  assert.equal(productHref({ id: 'love', color: 'red', size: 'M' }), 'product.html?id=love&color=red&size=M');
  assert.equal(productHref({ id: 'a b&c' }), 'product.html?id=a+b%26c');
});
