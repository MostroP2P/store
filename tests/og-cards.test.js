import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { storeShirts } from '../scripts/og-cards.mjs';
import { publishedProducts } from '../scripts/seo-pages.mjs';

const raw = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
const context = () => publishedProducts(raw);
const LOVE = 'mostro-quotes-love-at-first-sat';
const NODE = 'mostro-quotes-my-node-my-rules';

test('the store card shows its three shirts in their colors', () => {
  const { products, config } = context();
  assert.deepEqual(storeShirts(products, config).map(({ slot, product, colorId }) => [slot, product.id, colorId]), [
    [0, LOVE, 'white'], [1, 'mostro-invaders', 'black'], [2, 'mostro-quotes-hold-my-invoice', 'orange'],
  ]);
});

test('with fewer shirts on sale the store card fills fewer slots, never one without a shirt', () => {
  const { products, config } = context();
  const only = (ids) => products.filter((product) => ids.includes(product.id));
  assert.deepEqual(storeShirts(only([NODE]), config).map(({ slot, product }) => [slot, product.id]), [[0, NODE]]);
  assert.deepEqual(storeShirts([], config), []);
  // A listed shirt not on sale gives its slot to the shirt at that position, in its default color
  const twoOthers = only([NODE, 'mostro-quotes-sovereign-at-first-sat']);
  assert.deepEqual(storeShirts(twoOthers, config).map(({ slot, colorId }) => [slot, colorId]), [[0, 'black'], [1, 'black']]);
});

test('a missing shirt gives its slot to one that is not on the card already, so none shows twice', () => {
  const { products, config } = context();
  // In catalog order Mostro Invaders comes first, and it already has slot 1
  const withoutLove = products.filter((product) => product.id !== LOVE);
  assert.deepEqual(storeShirts(withoutLove, config).map(({ slot, product }) => [slot, product.id]), [
    [0, NODE], [1, 'mostro-invaders'], [2, 'mostro-quotes-hold-my-invoice'],
  ]);
  const onlyListedTwo = products.filter((product) => ['mostro-invaders', 'mostro-quotes-hold-my-invoice'].includes(product.id));
  assert.deepEqual(storeShirts(onlyListedTwo, config).map(({ slot, product }) => [slot, product.id]), [
    [1, 'mostro-invaders'], [2, 'mostro-quotes-hold-my-invoice'],
  ]);
});

test('a listed color the shirt does not come in falls back to its default color', () => {
  const { products, config } = context();
  const invadersOnlyNavy = products.map((product) => (product.id === 'mostro-invaders' ? { ...product, colors: ['navy'] } : product));
  assert.equal(storeShirts(invadersOnlyNavy, config)[1].colorId, 'navy');
});
