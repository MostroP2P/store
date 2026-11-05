import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeProducts, defaultColorFor, relatedProducts, groupSections } from '../../src/store/products.js';

const COLORS = [
  { id: 'black', name: 'Negro', hex: '#1a1a1a' },
  { id: 'white', name: 'Blanco', hex: '#f0f0ec' },
  { id: 'red', name: 'Rojo', hex: '#c81e28' },
];
const CONFIG = { price: 30000, defaultColor: 'white' };

const product = (id, groupId, extra = {}) => ({
  id, name: id, groupId, status: 'published', price: null, colors: null, description: null, ...extra,
});

const CATALOG = {
  colors: COLORS,
  groups: [{ id: 'quotes', name: 'Mostro dice…' }],
  products: [
    product('invaders', 'designs', { colors: ['black', 'red'], price: 35000 }),
    product('love', 'quotes'),
    product('draft', 'quotes', { status: 'draft' }),
    product('node', 'quotes'),
    product('hold', 'quotes'),
  ],
};

test('storeProducts keeps published products and resolves price and colors', () => {
  const products = storeProducts(CATALOG, CONFIG);
  assert.deepEqual(products.map((p) => p.id), ['invaders', 'love', 'node', 'hold']);
  assert.equal(products[0].price, 35000);
  assert.deepEqual(products[0].colors, ['black', 'red']);
  assert.equal(products[1].price, 30000);
  assert.deepEqual(products[1].colors, ['black', 'white', 'red']);
});

test('storeProducts offers every color when the recommended list is empty', () => {
  const catalog = { ...CATALOG, products: [product('x', 'quotes', { colors: [] })] };
  assert.deepEqual(storeProducts(catalog, CONFIG)[0].colors, ['black', 'white', 'red']);
});

test('defaultColorFor prefers the store default when the product offers it', () => {
  const [invaders, love] = storeProducts(CATALOG, CONFIG);
  assert.equal(defaultColorFor(love, CONFIG), 'white');
  assert.equal(defaultColorFor(invaders, CONFIG), 'black');
});

test('relatedProducts lists the same group first and never the product itself', () => {
  const products = storeProducts(CATALOG, CONFIG);
  const love = products.find((p) => p.id === 'love');
  assert.deepEqual(relatedProducts(products, love, 3).map((p) => p.id), ['node', 'hold', 'invaders']);
  assert.deepEqual(relatedProducts(products, love, 1).map((p) => p.id), ['node']);
});

test('groupSections follows the catalog order and skips empty groups', () => {
  const products = storeProducts(CATALOG, CONFIG);
  const sections = groupSections(products, CATALOG.groups, 'Designs');
  assert.deepEqual(sections.map((s) => [s.id, s.name, s.products.length]), [
    ['designs', 'Designs', 1],
    ['quotes', 'Mostro dice…', 3],
  ]);
  const onlyQuotes = groupSections(products.filter((p) => p.groupId === 'quotes'), CATALOG.groups, 'Designs');
  assert.deepEqual(onlyQuotes.map((s) => s.id), ['quotes']);
});
