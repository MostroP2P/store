import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalog } from '../src/catalog.js';
import { normalizeStoreConfig } from '../src/store/config.js';
import { STRINGS as VIEWER_STRINGS } from '../src/viewer/strings.js';

// Accents, inverted marks, and words the old Spanish messages used without accents
const SPANISH = /[áéíóúñ¿¡]|\b(falta|debe|repetid[oa]|se usa|se ignora|usá|ningún|tiene|lista|sección|tienda|remera|talle|pedidos?|fuente)\b/i;
const SAMPLE_ARGS = ['X', 'X'];

const STORE_NPUB = 'npub1st0re749d5d02mwnf2c0vcj566p85y5wpnaz65llr8wt49cyp6kqe44n9m';
const AREA = { x: 0, y: 0, width: 10, height: 10 };
const BROKEN_CATALOG = {
  base: { image: 'base.png', printArea: AREA, shading: { blur: 99 } },
  colors: [
    { id: 'black', hex: '#000000' }, { hex: '#ffffff' }, { id: 'bad', hex: 'red' }, { id: 'black', hex: '#111111' },
  ],
  designs: [
    {}, { id: 'd1' }, { id: 'd2', image: 'x.png', colors: ['purple'], status: 'nope', price: -1 }, { id: 'd2', image: 'y.png' },
  ],
  series: [
    {},
    { id: 'all', items: [] },
    { id: 's1' },
    {
      id: 's2',
      style: { textColor: 'red', textPosition: 'left', minFontSize: 90, maxFontSize: 20, gap: -5, font: 'a/Font.ttf' },
      items: [{}, { image: 'i.png', style: 'x', colors: 'black' }, { image: 'j.png', style: { font: 'b/Font.ttf' } }],
    },
    { id: 's2', items: [] },
  ],
};
const CATALOG_FAILURES = [
  null,
  {},
  { base: { image: 'base.png', printArea: {} }, colors: [] },
  { base: { image: 'base.png', printArea: AREA }, colors: 'black' },
  { base: { image: 'base.png', printArea: AREA }, colors: [{ id: 'black', hex: '#000000' }], designs: 'x', series: 'x' },
];

const BROKEN_STORE = {
  price: 30000,
  currency: 'pesos',
  lnAddress: 'nope',
  defaultSize: 'XS',
  defaultColor: 'purple',
  sizes: [{ id: 'S', width: -1 }, {}, { id: 'S' }, { id: 'M' }],
  nostr: { npub: STORE_NPUB, relays: ['https://x', 'wss://relay.example', 'wss://relay.example'] },
  details: [{ title: 'Shipping' }],
};
const STORE_FAILURES = [
  null,
  { price: 0 },
  { price: 1, sizes: [] },
  { price: 1, sizes: [{ id: 'M' }], nostr: { npub: 'npub1nope', relays: ['wss://relay.example'] } },
  { price: 1, sizes: [{ id: 'M' }], nostr: { npub: STORE_NPUB, relays: [] } },
];

function catalogMessages() {
  return [BROKEN_CATALOG, ...CATALOG_FAILURES].flatMap((raw) => normalizeCatalog(raw).problems.map((p) => p.message));
}

function storeMessages() {
  return [BROKEN_STORE, ...STORE_FAILURES].flatMap((raw) => normalizeStoreConfig(raw, ['black']).problems.map((p) => p.message));
}

test('catalog.json problems are reported in English', () => {
  const messages = catalogMessages();
  assert.ok(messages.length >= 25, `only ${messages.length} messages`);
  messages.forEach((message) => assert.doesNotMatch(message, SPANISH, message));
});

test('problems in the store section are reported in English', () => {
  const messages = storeMessages();
  // One per message the store section can produce
  assert.ok(messages.length >= 15, `only ${messages.length} messages`);
  messages.forEach((message) => assert.doesNotMatch(message, SPANISH, message));
});

test('the viewer speaks English', () => {
  Object.values(VIEWER_STRINGS)
    .map((value) => (typeof value === 'function' ? value(...SAMPLE_ARGS) : value))
    .forEach((text) => assert.doesNotMatch(text, SPANISH, text));
});
