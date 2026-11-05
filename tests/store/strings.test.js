import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STRINGS } from '../../src/store/strings.js';
import { SUPPORTED_LANGS } from '../../src/i18n.js';
import { FIELD_ORDER, REQUIRED_FIELDS, CHECKED_FIELDS } from '../../src/store/checkout-form.js';

const STORE_PAGES = ['index.html', 'product.html', 'checkout.html'];
const SPANISH_ONLY = /[áéíóúñ¿¡]/i;
const SAMPLE_ARGS = ['X', 'X', 'X'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** What a table looks like, without its words: same keys, kinds, list lengths and function arities. */
function shape(value) {
  if (typeof value === 'function') return `function/${value.length}`;
  if (Array.isArray(value)) return value.map(shape);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  return typeof value;
}

/** Every text a table can produce (functions called with sample arguments). */
function allTexts(value) {
  if (typeof value === 'function') return [value(...SAMPLE_ARGS)];
  if (Array.isArray(value)) return value.flatMap(allTexts);
  if (isObject(value)) return Object.values(value).flatMap(allTexts);
  return [value];
}

async function pageKeys() {
  const pages = await Promise.all(STORE_PAGES.map((page) => readFile(new URL(`../../${page}`, import.meta.url), 'utf8')));
  const html = pages.join('\n');
  const textKeys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  const attrKeys = [...html.matchAll(/data-i18n-attr="([^"]+)"/g)]
    .flatMap((m) => m[1].split(/\s+/).filter(Boolean).map((pair) => pair.split(':')[1]));
  return [...textKeys, ...attrKeys];
}

test('there is a table for every supported language', () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), [...SUPPORTED_LANGS].sort());
});

test('every language has exactly the texts of the English table', () => {
  SUPPORTED_LANGS.forEach((lang) => assert.deepEqual(shape(STRINGS[lang]), shape(STRINGS.en), lang));
});

test('every text produces a non-empty string', () => {
  SUPPORTED_LANGS.forEach((lang) => allTexts(STRINGS[lang]).forEach((text) => {
    assert.equal(typeof text, 'string', lang);
    assert.ok(text.length > 0, lang);
  }));
});

test('the English table has no Spanish left in it', () => {
  allTexts(STRINGS.en).forEach((text) => assert.doesNotMatch(text, SPANISH_ONLY, text));
});

test('the static texts of the store pages exist in every language', async () => {
  const keys = await pageKeys();
  assert.ok(keys.length > 20, `only ${keys.length} keys found`);
  SUPPORTED_LANGS.forEach((lang) => keys.forEach((key) => {
    assert.equal(typeof STRINGS[lang][key], 'string', `${lang}: data-i18n "${key}"`);
  }));
});

test('every checkout field has its label, name and messages', () => {
  SUPPORTED_LANGS.forEach((lang) => {
    const { fields } = STRINGS[lang];
    assert.deepEqual(Object.keys(fields).sort(), [...FIELD_ORDER].sort(), lang);
    FIELD_ORDER.forEach((name) => {
      assert.equal(typeof fields[name].label, 'string', `${lang} ${name}`);
      assert.equal(typeof fields[name].name, 'string', `${lang} ${name}`);
    });
    REQUIRED_FIELDS.forEach((name) => assert.equal(typeof fields[name].required, 'string', `${lang} ${name}`));
    CHECKED_FIELDS.forEach((name) => assert.equal(typeof fields[name].invalid, 'string', `${lang} ${name}`));
  });
});

test('the language switch is labelled in the language it switches to', () => {
  assert.equal(STRINGS.en.switchLanguage, 'View in English');
  assert.equal(STRINGS.es.switchLanguage, 'Ver en español');
});

test('counts read right in both languages', () => {
  assert.equal(STRINGS.en.cartButton(1), 'Open the cart: 1 T-shirt');
  assert.equal(STRINGS.en.cartButton(3), 'Open the cart: 3 T-shirts');
  assert.equal(STRINGS.es.cartButton(1), 'Abrir el carrito: 1 remera');
  assert.equal(STRINGS.es.cartButton(3), 'Abrir el carrito: 3 remeras');
  SUPPORTED_LANGS.forEach((lang) => {
    assert.equal(STRINGS[lang].summaryQuantity('Love', 1), 'Love');
    assert.equal(STRINGS[lang].summaryQuantity('Love', 2), 'Love (2)');
  });
});
