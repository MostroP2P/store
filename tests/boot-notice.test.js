// The notice for a store page whose scripts never started. One module that fails to load (the network
// changed, the connection dropped) stops every module of the page, and the buyer is left with an empty
// page. No script is left to translate the notice, so the HTML carries it in both languages, and the
// stylesheet shows it (tests/e2e/store.e2e.js drives that in the browser).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const STORE_STYLESHEET = '<link rel="stylesheet" href="css/store.css">';
const NOTICE = /<section class="store-message boot-notice">([\s\S]*?)<\/section>/g;

async function storePages() {
  const names = (await readdir(ROOT)).filter((name) => name.endsWith('.html'));
  const pages = await Promise.all(names.map(async (name) => [name, await readFile(new URL(name, ROOT), 'utf8')]));
  return pages.filter(([, html]) => html.includes(STORE_STYLESHEET));
}

test('every store page, the generated product pages included, carries one notice for when its scripts never start', async () => {
  const pages = await storePages();
  const names = pages.map(([name]) => name);
  assert.ok(['index.html', 'product.html', 'checkout.html'].every((name) => names.includes(name)), names.join(' '));
  for (const [name, html] of pages) {
    const main = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? '';
    assert.equal([...html.matchAll(NOTICE)].length, 1, name);
    assert.match(main.trimStart(), /^(<!--[\s\S]*?-->\s*)?<section class="store-message boot-notice">/, `${name}: first in <main>`);
  }
});

test('the notice says what happened in English and Spanish, and links to the page itself to reload it', async () => {
  for (const [name, html] of await storePages()) {
    const [notice] = [...html.matchAll(NOTICE)].map((match) => match[1]);
    assert.match(notice, /<p lang="en"><strong>The store didn’t finish loading\.<\/strong> Check your connection and reload the page\.<\/p>/, name);
    assert.match(notice, /<p lang="es"><strong>La tienda no terminó de cargar\.<\/strong> Revisá tu conexión y recargá la página\.<\/p>/, name);
    assert.match(notice, /<a class="button-primary" href=""><span lang="en">Reload<\/span> · <span lang="es">Recargar<\/span><\/a>/, name);
    // Translation never runs for it: a data-i18n key would only hide it until a script that never came
    assert.doesNotMatch(notice, /data-i18n/, name);
  }
});
