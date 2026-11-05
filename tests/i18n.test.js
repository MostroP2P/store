import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pickLanguage, localizeJson, SUPPORTED_LANGS, DEFAULT_LANG } from '../src/i18n.js';
import { normalizeCatalog } from '../src/catalog.js';
import { normalizeStoreConfig } from '../src/store/config.js';

const SPANISH_ONLY = /[áéíóúñ¿¡]/i;

test('the store speaks English and Spanish, English by default', () => {
  assert.deepEqual([...SUPPORTED_LANGS], ['en', 'es']);
  assert.equal(DEFAULT_LANG, 'en');
});

test('a browser in any other language gets English', () => {
  assert.equal(pickLanguage(null, []), 'en');
  assert.equal(pickLanguage(null, ['fr-FR', 'de']), 'en');
  assert.equal(pickLanguage(null, undefined), 'en');
});

test('a browser in Spanish gets Spanish, whatever the region', () => {
  assert.equal(pickLanguage(null, ['es-AR', 'en']), 'es');
  assert.equal(pickLanguage(null, ['es-419']), 'es');
  assert.equal(pickLanguage(null, ['ES']), 'es');
  // Some webviews write es_AR; emulators may leave a quality value
  assert.equal(pickLanguage(null, ['es_AR']), 'es');
  assert.equal(pickLanguage(null, ['fr-FR', 'es;q=0.8']), 'es');
});

test('the first supported language of the browser wins', () => {
  assert.equal(pickLanguage(null, ['en-US', 'es']), 'en');
  assert.equal(pickLanguage(null, ['fr', 'es-ES', 'en']), 'es');
  assert.equal(pickLanguage(null, [null, '', 42, 'es']), 'es');
});

test('a language chosen with the switch beats the browser', () => {
  assert.equal(pickLanguage('en', ['es-AR']), 'en');
  assert.equal(pickLanguage('es', ['en-US']), 'es');
  // Anything else saved under the key is ignored
  assert.equal(pickLanguage('pt', ['es-AR']), 'es');
  assert.equal(pickLanguage({ lang: 'es' }, []), 'en');
});

test('localizeJson keeps the text of the page language', () => {
  const raw = {
    colors: [{ id: 'black', name: { en: 'Black', es: 'Negro' }, hex: '#1a1a1a' }],
    store: { price: 30000, details: [{ title: { en: 'Shipping', es: 'Envío' }, text: 'Same text' }] },
  };
  assert.deepEqual(localizeJson(raw, 'es'), {
    colors: [{ id: 'black', name: 'Negro', hex: '#1a1a1a' }],
    store: { price: 30000, details: [{ title: 'Envío', text: 'Same text' }] },
  });
  assert.equal(localizeJson(raw, 'en').colors[0].name, 'Black');
  assert.equal(raw.colors[0].name.es, 'Negro', 'the input is not changed');
});

test('a missing or empty translation falls back to English, then to the other language', () => {
  assert.equal(localizeJson({ en: 'Black' }, 'es'), 'Black');
  assert.equal(localizeJson({ en: 'Black', es: ' ' }, 'es'), 'Black');
  assert.equal(localizeJson({ es: 'Negro' }, 'en'), 'Negro');
  assert.equal(localizeJson({ en: '', es: '' }, 'en'), '');
});

test('objects that are not translations stay as they are', () => {
  assert.deepEqual(localizeJson({ id: 'S', width: 49 }, 'es'), { id: 'S', width: 49 });
  assert.deepEqual(localizeJson({ en: 'Black', pt: 'Preto' }, 'es'), { en: 'Black', pt: 'Preto' });
  assert.deepEqual(localizeJson({ en: 1 }, 'es'), { en: 1 });
  assert.deepEqual(localizeJson({}, 'es'), {});
  assert.equal(localizeJson(null, 'es'), null);
  assert.equal(localizeJson('plain', 'es'), 'plain');
});

test('catalog.json opens in every language, fully translated', async () => {
  const raw = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
  for (const lang of SUPPORTED_LANGS) {
    const localized = localizeJson(raw, lang);
    const { catalog, problems } = normalizeCatalog(localized);
    assert.deepEqual(problems, [], lang);
    const { config, problems: storeProblems } = normalizeStoreConfig(localized.store, catalog.colors.map((c) => c.id));
    assert.deepEqual(storeProblems, [], lang);
    const texts = [
      ...catalog.colors.map((c) => c.name),
      ...catalog.groups.map((g) => g.name),
      ...catalog.products.flatMap((p) => [p.name, p.description ?? '']),
      ...config.details.flatMap((d) => [d.title, d.text]),
    ];
    texts.forEach((text) => assert.equal(typeof text, 'string', lang));
    if (lang === 'en') texts.forEach((text) => assert.doesNotMatch(text, SPANISH_ONLY, text));
  }
  const names = (lang) => normalizeCatalog(localizeJson(raw, lang)).catalog.colors.map((c) => c.name);
  assert.notDeepEqual(names('en'), names('es'));
});
