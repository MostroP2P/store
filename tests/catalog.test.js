import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCatalog,
  slugify,
  fontFamilyFromFile,
  DEFAULT_SHADING,
  DEFAULT_SERIES_STYLE,
  DESIGNS_GROUP_ID,
  ALL_GROUP_ID,
} from '../src/catalog.js';

const LUCKIEST = 'assets/fonts/LuckiestGuy-Regular.ttf';

const validRaw = () => ({
  base: { image: 'assets/shirts/t-shirt.png', printArea: { x: 1, y: 2, width: 300, height: 400 } },
  colors: [
    { id: 'black', name: 'Negro', hex: '#1a1a1a' },
    { id: 'red', name: 'Rojo', hex: '#C81E28' },
  ],
  designs: [{ id: 'invaders', name: 'Invaders', image: 'designs/invaders.png', colors: ['black'] }],
  series: [
    {
      id: 'quotes',
      name: 'Quotes',
      style: { font: LUCKIEST, maxLines: 3 },
      items: [
        { image: 'designs/stickers/mostro-love-512.png', text: 'Love at first sat' },
        { image: 'designs/stickers/mostro-gm-512.png', text: 'GM', style: { textColor: '#7ed321' } },
      ],
    },
  ],
});

const product = (catalog, id) => catalog.products.find((p) => p.id === id);
const messages = (problems, level) => problems.filter((p) => p.level === level).map((p) => p.message);

test('slugify builds url-safe ids', () => {
  assert.equal(slugify('Love at first sat'), 'love-at-first-sat');
  assert.equal(slugify('  Mañana ¡Bitcoin! 21 '), 'manana-bitcoin-21');
  assert.equal(slugify('   '), '');
});

test('fontFamilyFromFile uses the file name, or null for system fonts', () => {
  assert.equal(fontFamilyFromFile(LUCKIEST), 'LuckiestGuy-Regular');
  assert.equal(fontFamilyFromFile('fonts/Other.woff2'), 'Other');
  assert.equal(fontFamilyFromFile('Georgia'), null);
});

test('a valid catalog normalizes without problems', () => {
  const { catalog, problems } = normalizeCatalog(validRaw());
  assert.deepEqual(problems, []);
  assert.equal(catalog.base.image, 'assets/shirts/t-shirt.png');
  assert.deepEqual(catalog.base.printArea, { x: 1, y: 2, width: 300, height: 400 });
  assert.deepEqual(catalog.base.shading, DEFAULT_SHADING);
  assert.deepEqual(catalog.colors[1], { id: 'red', name: 'Rojo', hex: '#c81e28' });
});

test('shading overrides merge over the defaults', () => {
  const raw = validRaw();
  raw.base.shading = { blur: 5 };
  const { catalog } = normalizeCatalog(raw);
  assert.deepEqual(catalog.base.shading, { ...DEFAULT_SHADING, blur: 5 });
});

test('designs become image products in the designs group', () => {
  const { catalog } = normalizeCatalog(validRaw());
  assert.deepEqual(product(catalog, 'invaders'), {
    id: 'invaders',
    name: 'Invaders',
    groupId: DESIGNS_GROUP_ID,
    layout: 'image',
    image: 'designs/invaders.png',
    text: null,
    style: null,
    colors: ['black'],
    status: 'draft',
    price: null,
    description: null,
  });
});

test('series items get automatic ids, names and the merged style', () => {
  const { catalog } = normalizeCatalog(validRaw());
  const love = product(catalog, 'quotes-love-at-first-sat');
  assert.equal(love.name, 'Love at first sat');
  assert.equal(love.groupId, 'quotes');
  assert.equal(love.layout, 'image-text');
  assert.equal(love.text, 'Love at first sat');
  assert.equal(love.colors, null);
  assert.deepEqual(love.style, {
    ...DEFAULT_SERIES_STYLE,
    font: LUCKIEST,
    maxLines: 3,
    fontFamily: 'LuckiestGuy-Regular',
  });
});

test('item style overrides the series style', () => {
  const { catalog } = normalizeCatalog(validRaw());
  assert.equal(product(catalog, 'quotes-gm').style.textColor, '#7ed321');
  assert.equal(product(catalog, 'quotes-gm').style.maxLines, 3);
});

test('explicit item id and name win over the automatic ones', () => {
  const raw = validRaw();
  raw.series[0].items[0] = { ...raw.series[0].items[0], id: 'love', name: 'Amor' };
  const { catalog } = normalizeCatalog(raw);
  assert.equal(product(catalog, 'love').name, 'Amor');
});

test('items without text are named after their image file', () => {
  const raw = validRaw();
  raw.series[0].items = [{ image: 'designs/stickers/mostro-gm-512.png' }];
  const { catalog } = normalizeCatalog(raw);
  assert.equal(catalog.products[1].id, 'quotes-mostro-gm-512');
  assert.equal(catalog.products[1].name, 'mostro-gm-512');
  assert.equal(catalog.products[1].text, null);
});

test('manual line breaks stay in the text but not in the name', () => {
  const raw = validRaw();
  raw.series[0].items = [{ image: 'a.png', text: 'GM\nfrens' }];
  const { catalog } = normalizeCatalog(raw);
  assert.equal(catalog.products[1].text, 'GM\nfrens');
  assert.equal(catalog.products[1].name, 'GM frens');
});

test('fonts are collected once per file, system fonts are not loaded', () => {
  const raw = validRaw();
  raw.series.push({ id: 'other', name: 'Other', style: { font: 'Georgia' }, items: [{ image: 'b.png', text: 'Hi' }] });
  const { catalog } = normalizeCatalog(raw);
  assert.deepEqual(catalog.fonts, [{ family: 'LuckiestGuy-Regular', file: LUCKIEST }]);
  assert.equal(product(catalog, 'other-hi').style.fontFamily, 'Georgia');
});

test('groups list every series in order', () => {
  const { catalog } = normalizeCatalog(validRaw());
  assert.deepEqual(catalog.groups, [{ id: 'quotes', name: 'Quotes' }]);
});

test('unknown fields such as price are ignored without problems', () => {
  const raw = validRaw();
  raw.designs[0].price = 25;
  raw.store = { lnAddress: 'store@pay.mostro.foundation' };
  assert.deepEqual(normalizeCatalog(raw).problems, []);
});

test('designs and series are optional', () => {
  const raw = validRaw();
  delete raw.designs;
  delete raw.series;
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(problems, []);
  assert.deepEqual(catalog.products, []);
});

for (const [label, mutate] of [
  ['the catalog is not an object', () => null],
  ['base.image is missing', (raw) => { delete raw.base.image; return raw; }],
  ['printArea is invalid', (raw) => { raw.base.printArea = { x: 0, y: 0, width: -1, height: 10 }; return raw; }],
  ['there are no valid colors', (raw) => { raw.colors = [{ id: 'x', name: 'X', hex: 'red' }]; return raw; }],
]) {
  test(`normalizeCatalog fails when ${label}`, () => {
    const { catalog, problems } = normalizeCatalog(mutate(validRaw()));
    assert.equal(catalog, null);
    assert.ok(messages(problems, 'error').length > 0);
  });
}

test('invalid and duplicated colors are skipped with an error', () => {
  const raw = validRaw();
  raw.colors.push({ id: 'bad', name: 'Bad', hex: '#xyz' }, { id: 'black', name: 'Otro negro', hex: '#000000' });
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(catalog.colors.map((c) => c.id), ['black', 'red']);
  assert.equal(messages(problems, 'error').length, 2);
});

test('designs without id or image are skipped with an error', () => {
  const raw = validRaw();
  raw.designs.push({ name: 'Sin id', image: 'x.png' }, { id: 'no-image' });
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(catalog.products.filter((p) => p.groupId === DESIGNS_GROUP_ID).map((p) => p.id), ['invaders']);
  assert.equal(messages(problems, 'error').length, 2);
});

test('series items without image are skipped with an error naming the series', () => {
  const raw = validRaw();
  raw.series[0].items.push({ text: 'Sin imagen' });
  const { problems } = normalizeCatalog(raw);
  const [message] = messages(problems, 'error');
  assert.match(message, /quotes/);
});

test('series without id or items are skipped with an error', () => {
  const raw = validRaw();
  raw.series.push({ name: 'Sin id', items: [] }, { id: 'no-items' });
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(catalog.groups.map((g) => g.id), ['quotes']);
  assert.equal(messages(problems, 'error').length, 2);
});

test('duplicated product ids keep the first product', () => {
  const raw = validRaw();
  raw.series[0].items.push({ image: 'other.png', text: 'Love at first sat' });
  const { catalog, problems } = normalizeCatalog(raw);
  assert.equal(catalog.products.filter((p) => p.id === 'quotes-love-at-first-sat').length, 1);
  assert.match(messages(problems, 'error')[0], /quotes-love-at-first-sat/);
});

test('unknown recommended colors are dropped with a warning', () => {
  const raw = validRaw();
  raw.designs[0].colors = ['black', 'purple'];
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(product(catalog, 'invaders').colors, ['black']);
  assert.match(messages(problems, 'warning')[0], /purple/);
});

test('invalid style values fall back to defaults with a warning', () => {
  const raw = validRaw();
  raw.series[0].style = { ...raw.series[0].style, textColor: 'green', textPosition: 'left' };
  const { catalog, problems } = normalizeCatalog(raw);
  const love = product(catalog, 'quotes-love-at-first-sat');
  assert.equal(love.style.textColor, 'auto');
  assert.equal(love.style.textPosition, 'below');
  assert.equal(messages(problems, 'warning').length, 2);
});

test('invalid numeric style values fall back to defaults with a warning', () => {
  const raw = validRaw();
  raw.series[0].style = { ...raw.series[0].style, imageWidth: 'abc', maxFontSize: 1e9, maxLines: 0 };
  const { catalog, problems } = normalizeCatalog(raw);
  const love = product(catalog, 'quotes-love-at-first-sat');
  assert.equal(love.style.imageWidth, DEFAULT_SERIES_STYLE.imageWidth);
  assert.equal(love.style.maxFontSize, DEFAULT_SERIES_STYLE.maxFontSize);
  assert.equal(love.style.maxLines, DEFAULT_SERIES_STYLE.maxLines);
  assert.equal(messages(problems, 'warning').length, 3);
});

test('a minimum font size above the maximum is clamped with a warning', () => {
  const raw = validRaw();
  raw.series[0].style = { ...raw.series[0].style, minFontSize: 120, maxFontSize: 80 };
  const { catalog, problems } = normalizeCatalog(raw);
  assert.equal(product(catalog, 'quotes-love-at-first-sat').style.minFontSize, 80);
  assert.equal(messages(problems, 'warning').length, 1);
});

test('invalid shading values fall back to defaults with a warning', () => {
  const raw = validRaw();
  raw.base.shading = { blur: 'abc', highlight: 0.3 };
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(catalog.base.shading, { ...DEFAULT_SHADING, highlight: 0.3 });
  assert.match(messages(problems, 'warning')[0], /blur/);
});

test('series with reserved or repeated ids are skipped with an error', () => {
  const raw = validRaw();
  raw.series.push(
    { id: DESIGNS_GROUP_ID, items: [] },
    { id: ALL_GROUP_ID, items: [] },
    { id: 'quotes', items: [{ image: 'z.png', text: 'Z' }] },
  );
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(catalog.groups.map((g) => g.id), ['quotes']);
  assert.equal(product(catalog, 'quotes-z'), undefined);
  assert.equal(messages(problems, 'error').length, 3);
});

test('two font files with the same name keep the first one and warn', () => {
  const raw = validRaw();
  raw.series.push({ id: 'other', style: { font: 'other/LuckiestGuy-Regular.ttf' }, items: [{ image: 'b.png', text: 'Hi' }] });
  const { catalog, problems } = normalizeCatalog(raw);
  assert.deepEqual(catalog.fonts, [{ family: 'LuckiestGuy-Regular', file: LUCKIEST }]);
  assert.match(messages(problems, 'warning')[0], /other\/LuckiestGuy-Regular\.ttf/);
});

test('store fields: designs and series items are drafts without price by default', () => {
  const { catalog, problems } = normalizeCatalog(validRaw());
  catalog.products.forEach((p) => {
    assert.equal(p.status, 'draft');
    assert.equal(p.price, null);
    assert.equal(p.description, null);
  });
  assert.deepEqual(problems, []);
});

test('store fields: a design can be published with its own price and description', () => {
  const raw = validRaw();
  Object.assign(raw.designs[0], { status: 'published', price: 35000, description: 'Arcade P2P' });
  const invaders = product(normalizeCatalog(raw).catalog, 'invaders');
  assert.equal(invaders.status, 'published');
  assert.equal(invaders.price, 35000);
  assert.equal(invaders.description, 'Arcade P2P');
});

test('store fields: series items inherit status, price and description, and can override them', () => {
  const raw = validRaw();
  Object.assign(raw.series[0], { status: 'published', price: 30000, description: 'Frases Mostro' });
  Object.assign(raw.series[0].items[1], { status: 'draft', price: 32000, description: 'Good morning' });
  const { catalog } = normalizeCatalog(raw);
  const love = product(catalog, 'quotes-love-at-first-sat');
  const gm = product(catalog, 'quotes-gm');
  assert.deepEqual([love.status, love.price, love.description], ['published', 30000, 'Frases Mostro']);
  assert.deepEqual([gm.status, gm.price, gm.description], ['draft', 32000, 'Good morning']);
});

test('store fields: invalid status or price fall back with a warning', () => {
  const raw = validRaw();
  Object.assign(raw.designs[0], { status: 'live', price: -1 });
  Object.assign(raw.series[0].items[0], { price: '30000' });
  const { catalog, problems } = normalizeCatalog(raw);
  assert.equal(product(catalog, 'invaders').status, 'draft');
  assert.equal(product(catalog, 'invaders').price, null);
  assert.equal(product(catalog, 'quotes-love-at-first-sat').price, null);
  assert.equal(messages(problems, 'warning').length, 3);
});
