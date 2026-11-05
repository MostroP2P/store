import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { storeShirts, cardInputs, cardFiles, STORE_CARD, LOGO } from '../scripts/og-cards.mjs';
import { cardFingerprints, RENDERER_FILES } from '../scripts/og-fingerprint.mjs';
import { publishedProducts } from '../scripts/seo-pages.mjs';

const raw = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
const context = (catalog = raw) => publishedProducts(catalog);
// Fake file hashes: the path itself, unless a test swaps one
const hashes = (changed = {}) => async (path) => changed[path] ?? `hash-of-${path}`;
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

test('a listed color the shirt does not come in falls back to its default color', () => {
  const { products, config } = context();
  const invadersOnlyNavy = products.map((product) => (product.id === 'mostro-invaders' ? { ...product, colors: ['navy'] } : product));
  assert.equal(storeShirts(invadersOnlyNavy, config)[1].colorId, 'navy');
});

test('a product card depends on its shirt, its color, the base shirt and the currency', () => {
  const inputs = cardInputs(LOVE, context());
  assert.equal(inputs.shirts.length, 1);
  assert.equal(inputs.shirts[0].name, 'Love at first sat');
  assert.equal(inputs.shirts[0].hex, '#1a1a1a');
  assert.equal(inputs.currency, 'ARS');
  assert.deepEqual(cardFiles(inputs), ['assets/fonts/LuckiestGuy-Regular.ttf', 'assets/shirts/t-shirt.png', LOGO, 'designs/stickers/mostro-love-512.png'].sort());
  assert.throws(() => cardInputs('nope', context()), /no product on sale with id "nope"/);
});

test('a full design reads no font file', () => {
  assert.ok(!cardFiles(cardInputs('mostro-invaders', context())).some((path) => path.endsWith('.ttf')));
});

test('every card changes its fingerprint when what it shows changes, and only then', async () => {
  const names = [STORE_CARD, LOVE, NODE];
  const before = await cardFingerprints(context(), names, hashes());
  assert.deepEqual(await cardFingerprints(context(), names, hashes()), before, 'stable');

  const pricier = await cardFingerprints(context({ ...raw, store: { ...raw.store, price: 31000 } }), names, hashes());
  assert.notEqual(pricier[LOVE], before[LOVE]);
  assert.notEqual(pricier[NODE], before[NODE]);

  const newDesign = await cardFingerprints(context(), names, hashes({ 'designs/stickers/mostro-love-512.png': 'edited' }));
  assert.notEqual(newDesign[LOVE], before[LOVE]);
  assert.notEqual(newDesign[STORE_CARD], before[STORE_CARD], 'the store card shows that shirt too');
  assert.equal(newDesign[NODE], before[NODE]);

  const newRenderer = await cardFingerprints(context(), names, hashes({ [RENDERER_FILES[0]]: 'edited' }));
  names.forEach((name) => assert.notEqual(newRenderer[name], before[name]));
});
