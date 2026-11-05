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

test('productHref links to the page of the product itself, the one link previews read', () => {
  assert.equal(productHref({ id: 'love', color: 'red', size: 'M' }), 'love.html?color=red&size=M');
  assert.equal(productHref({ id: 'love' }), 'love.html');
  assert.equal(productHref({ id: 'a b&c' }), 'a%20b%26c.html');
});

test('the page of a product names it; product.html takes the id from the query', () => {
  assert.equal(parseProductQuery('?color=red&size=M', PRODUCTS, CONFIG, 'love').product.id, 'love');
  // On a product's own page, a stray ?id= does not swap the product
  assert.equal(parseProductQuery('?id=invaders', PRODUCTS, CONFIG, 'love').product.id, 'love');
  assert.equal(parseProductQuery('?id=invaders', PRODUCTS, CONFIG, undefined).product.id, 'invaders');
});
