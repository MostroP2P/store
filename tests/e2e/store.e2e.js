// The store pages in a real browser: language, collection, product page, size guide and cart panel.
// Run with `npm run test:e2e`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launchBrowser, openShop, saveCoverage, addToCart } from './harness.js';

const INVADERS = 'mostro-invaders';
const NAME = 'Mostro Invaders';
const CATALOG = new URL('../../catalog.json', import.meta.url);
// The notice waits --boot-notice-delay (css/store.css) before it shows
const NOTICE_TIMEOUT_MS = 15_000;

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => {
  await browser?.close();
  await saveCoverage('store');
});

/** Opens a shop, runs `scenario(shop)` and always closes it; fails on any uncaught page error. */
async function withShop(options, scenario) {
  const shop = await openShop(browser, options);
  try {
    await scenario(shop);
    assert.deepEqual(shop.get('pageErrors'), []);
  } finally {
    await shop.close();
  }
}

const catalog = async () => JSON.parse(await readFile(CATALOG, 'utf8'));

test('an English browser gets English; the picker moves to Spanish and remembers it', () => withShop({}, async (shop) => {
  const page = await shop.page('index.html');
  await page.waitForSelector('.product-card');
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
  assert.equal(await page.textContent('h1'), 'Mostro T-shirts');
  assert.equal(await page.textContent('.product-card .price-mono'), 'ARS\u00a060,000');
  assert.deepEqual(await page.locator('.section-title').allTextContents(), ['Designs', 'Mostro says…']);
  assert.equal(await page.textContent('.lang-switch-code'), 'EN');

  await page.click('#lang-switch');
  await Promise.all([page.waitForEvent('load'), page.click('#lang-list button[lang="es"]')]);
  await page.waitForSelector('.product-card');
  assert.equal(await page.getAttribute('html', 'lang'), 'es');
  assert.equal(await page.textContent('h1'), 'Remeras Mostro');
  assert.equal(await page.textContent('.product-card .price-mono'), '$60.000');
  assert.equal(await page.getAttribute('#lang-switch', 'aria-label'), 'Idioma: Español');
  assert.equal(await page.textContent('.lang-switch-code'), 'ES');

  await page.goto(`${shop.url}/product.html?id=${INVADERS}`);
  await page.waitForSelector('#product:not([hidden])');
  assert.equal(await page.textContent('[data-i18n="buyNow"]'), 'Comprar');
  assert.equal(await page.textContent('#color-name'), 'Negro');
}));

test('a Spanish browser gets Spanish from the first visit', () => withShop({ locale: 'es-AR' }, async (shop) => {
  const page = await shop.page('index.html');
  await page.waitForSelector('.product-card');
  assert.equal(await page.getAttribute('html', 'lang'), 'es');
  assert.equal(await page.title(), 'Mostro Store · Remeras');
  assert.equal(await page.getAttribute('#lang-switch', 'aria-label'), 'Idioma: Español');
  assert.equal(await page.getAttribute('#lang-list button[lang="es"]', 'aria-current'), 'true');
}));

// A browser in each of the other languages: its texts, its prices and its color names from catalog.json
const OTHER_LANGUAGES = [
  { locale: 'fr-FR', lang: 'fr', title: 'T-shirts Mostro', price: '60\u202f000\u00a0ARS', sections: ['Motifs', 'Mostro dit…'], black: 'Noir' },
  { locale: 'it-IT', lang: 'it', title: 'Magliette Mostro', price: '60.000\u00a0ARS', sections: ['Grafiche', 'Mostro dice…'], black: 'Nero' },
  { locale: 'pt-BR', lang: 'pt', title: 'Camisetas Mostro', price: 'ARS\u00a060.000', sections: ['Estampas', 'Mostro diz…'], black: 'Preto' },
];

OTHER_LANGUAGES.forEach(({ locale, lang, title, price, sections, black }) => {
  test(`a browser in ${locale} gets the store in that language`, () => withShop({ locale }, async (shop) => {
    const page = await shop.page('index.html');
    await page.waitForSelector('.product-card');
    assert.equal(await page.getAttribute('html', 'lang'), lang);
    assert.equal(await page.textContent('h1'), title);
    assert.equal(await page.textContent('.product-card .price-mono'), price);
    assert.deepEqual(await page.locator('.section-title').allTextContents(), sections);
    assert.equal(await page.textContent('.lang-switch-code'), lang.toUpperCase());

    await page.goto(`${shop.url}/product.html?id=${INVADERS}`);
    await page.waitForSelector('#product:not([hidden])');
    assert.equal(await page.textContent('#color-name'), black);
  }));
});

test('the language picker opens a list with every language in its own name, and closes without choosing', () => withShop({}, async (shop) => {
  const page = await shop.page('index.html');
  await page.waitForSelector('.product-card');
  const button = '#lang-switch';
  const isOpen = async () => (await page.getAttribute(button, 'aria-expanded')) === 'true' && page.isVisible('#lang-list');
  assert.equal(await page.getAttribute(button, 'aria-label'), 'Language: English');
  assert.equal(await isOpen(), false);

  await page.click(button);
  assert.equal(await isOpen(), true);
  const items = await page.$$eval('#lang-list button', (nodes) => nodes.map((b) => [b.lang, b.textContent, b.getAttribute('aria-current')]));
  assert.deepEqual(items, [
    ['en', 'English', 'true'], ['es', 'Español', null], ['fr', 'Français', null], ['it', 'Italiano', null], ['pt', 'Português', null],
  ]);
  // Moving through the list with the keyboard changes nothing; Escape closes it and gives the focus back
  await page.focus('#lang-list button[lang="fr"]');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  assert.equal(await isOpen(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'lang-switch');
  assert.equal(await page.getAttribute('html', 'lang'), 'en');

  // A click elsewhere closes it; so does the button again, and leaving it with the keyboard
  await page.click(button);
  await page.click('h1');
  assert.equal(await isOpen(), false);
  await page.click(button);
  await page.click(button);
  assert.equal(await isOpen(), false);
  await page.click(button);
  await page.focus('#lang-list button[lang="pt"]');
  await page.keyboard.press('Tab');
  assert.equal(await isOpen(), false);

  // The language already shown just closes the list
  await page.click(button);
  await page.click('#lang-list button[lang="en"]');
  assert.equal(await isOpen(), false);
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
}));

test('a choice the browser will not save leaves the page in its language', () => withShop({}, async (shop) => {
  const page = await shop.page('index.html');
  await page.waitForSelector('.product-card');
  // Storage that worked when the page started and refuses writes later (full, or revoked)
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  await page.click('#lang-switch');
  await page.click('#lang-list button[lang="it"]');
  assert.equal(await page.getAttribute('#lang-switch', 'aria-expanded'), 'false');
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
  assert.equal(await page.textContent('h1'), 'Mostro T-shirts');
}));

test('the product page: color, size, size guide and related shirts', () => withShop({}, async (shop) => {
  const page = await shop.page(`product.html?id=${INVADERS}`);
  await page.waitForSelector('#product:not([hidden])');
  assert.equal(await page.title(), `${NAME} · Mostro Store`);
  assert.equal(await page.textContent('#product-lead'), 'The Mostros invade the screen, arcade style.');

  await page.click('label.color-option:has(input[value="navy"])');
  assert.equal(await page.textContent('#color-name'), 'Navy blue');
  assert.equal(await page.getAttribute('#product-canvas', 'aria-label'), `${NAME} T-shirt in navy blue`);
  await page.selectOption('#size-select', 'XL');
  assert.match(page.url(), /color=navy&size=XL$/);

  await page.click('#size-guide-button');
  await page.waitForSelector('dialog.size-guide[open]');
  assert.match(await page.textContent('dialog.size-guide'), /Width \(armpit to armpit\)/);
  await page.click('dialog.size-guide .icon-button');
  await page.waitForSelector('dialog.size-guide:not([open])', { state: 'attached' });
  // A click on the backdrop closes it too
  await page.click('#size-guide-button');
  await page.mouse.click(5, 5);
  await page.waitForSelector('dialog.size-guide:not([open])', { state: 'attached' });

  const related = page.locator('#related .product-card');
  assert.ok(await related.count() > 0);
  await Promise.all([page.waitForURL(/\/mostro-quotes-[a-z-]+\.html/), related.first().click()]);
  await page.waitForSelector('#product:not([hidden])');
}));

test('the cart panel: add, change quantities, remove, empty and go to checkout', () => withShop({}, async (shop) => {
  const page = await shop.page('index.html');
  await addToCart(page, shop.url, INVADERS, 2);
  assert.equal(await page.textContent('#add-label'), 'Add to cart (2)');
  assert.equal(await page.textContent('#cart-count'), '2');
  assert.equal(await page.getAttribute('#cart-button', 'aria-label'), 'Open the cart: 2 T-shirts');

  await page.click('#cart-button');
  await page.waitForSelector('dialog.cart-panel[open]');
  await page.click(`button[aria-label="One more ${NAME}"]`);
  await page.click(`button[aria-label="One less ${NAME}"]`);
  const quantity = page.locator(`input[aria-label="Quantity of ${NAME}"]`);
  await quantity.fill('5');
  await quantity.press('Enter');
  assert.equal(await page.textContent('#cart-count'), '5');
  assert.match(await page.textContent('.cart-summary'), /Total: ARS\u00a0300,000/);
  // An emptied field is not "0": the line keeps its quantity
  await quantity.fill('');
  await quantity.press('Enter');
  assert.equal(await page.textContent('#cart-count'), '5');

  await page.click('.cart-line .button-danger-small');
  await page.waitForSelector('.cart-empty');
  await page.click('dialog.cart-panel .icon-button');

  await page.click('#add-to-cart');
  await page.click('#cart-button');
  await page.click('.cart-actions .button-outline-danger');
  await page.waitForSelector('#cart-button[hidden]', { state: 'attached' });
  // The backdrop closes the panel
  await page.mouse.click(5, 5);
  await page.waitForSelector('dialog.cart-panel:not([open])', { state: 'attached' });

  await page.click('#add-to-cart');
  await page.click('#cart-button');
  await Promise.all([page.waitForURL(/checkout\.html$/), page.click('.cart-actions .button-primary')]);
  await page.waitForSelector('#summary-lines .summary-line');
}));

test('every product has a page of its own: the address to share, with its preview', () => withShop({}, async (shop) => {
  const page = await shop.page('index.html');
  await page.waitForSelector('.product-card');
  assert.equal(await page.getAttribute('.product-card', 'href'), `${INVADERS}.html`);

  await page.goto(`${shop.url}/${INVADERS}.html?color=navy&size=XL`);
  await page.waitForSelector('#product:not([hidden])');
  assert.equal(await page.textContent('#color-name'), 'Navy blue');
  assert.equal(await page.inputValue('#size-select'), 'XL');
  assert.equal(await page.getAttribute('meta[property="og:image"]', 'content'), `https://store.mostro.network/assets/og/${INVADERS}.jpg`);
  await page.selectOption('#size-select', 'S');
  assert.match(page.url(), new RegExp(`/${INVADERS}\\.html\\?color=navy&size=S$`));

  // The generic page moves to the product's own address
  await page.goto(`${shop.url}/product.html?id=${INVADERS}`);
  await page.waitForSelector('#product:not([hidden])');
  assert.match(page.url(), new RegExp(`/${INVADERS}\\.html\\?color=black&size=L$`));
  // The structured data is a data block: the Content-Security-Policy has nothing to block
  assert.deepEqual(shop.get('consoleErrors').filter((message) => /Content Security Policy/i.test(message)), []);
}));

test('Buy now adds the shirt and goes straight to the checkout', () => withShop({}, async (shop) => {
  const page = await shop.page(`product.html?id=${INVADERS}&color=white&size=S`);
  await page.waitForSelector('#product:not([hidden])');
  await Promise.all([page.waitForURL(/checkout\.html$/), page.click('#buy-now')]);
  await page.waitForSelector('#summary-lines .summary-line');
  assert.match(await page.textContent('#summary-lines'), /White.*Size S/s);
}));

test('a second tab sees the cart change', () => withShop({}, async (shop) => {
  const home = await shop.page('index.html');
  await home.waitForSelector('.product-card');
  const product = await shop.page(`product.html?id=${INVADERS}`);
  await product.waitForSelector('#product:not([hidden])');
  await product.click('#add-to-cart');
  await home.waitForSelector('#cart-button:not([hidden])');
  assert.equal(await home.textContent('#cart-count'), '1');
}));

test('an unknown product offers the way back to the collection', () => withShop({}, async (shop) => {
  const page = await shop.page('product.html?id=nope');
  await page.waitForSelector('.store-message');
  assert.equal(await page.textContent('.store-message h1'), 'We couldn’t find that T-shirt.');
}));

test('a browser that blocks storage is told so, instead of losing the cart', () => withShop({}, async (shop) => {
  const page = await shop.page(`product.html?id=${INVADERS}`, { blockStorage: true });
  await page.waitForSelector('#product:not([hidden])');
  assert.equal(await page.isHidden('#lang-switch'), true);
  await page.click('#buy-now');
  await page.waitForSelector('#storage-warning:not([hidden])');
  // It stays on the product page instead of opening an empty checkout
  assert.doesNotMatch(page.url(), /checkout\.html/);
  assert.match(await page.textContent('#storage-warning'), /won’t let us save the cart/);
}));

test('the store explains when it cannot open', async () => {
  const { store, ...withoutStore } = await catalog();
  const cases = [
    [{ files: { '/catalog.json': 500 } }, /HTTP 500/],
    [{ catalogBody: '{}' }, /catalog\.json has errors/],
    [{ catalogBody: JSON.stringify(withoutStore) }, /missing the "store" section/],
  ];
  for (const [options, reason] of cases) {
    await withShop(options, async (shop) => {
      const page = await shop.page('index.html');
      await page.waitForSelector('.store-message');
      assert.equal(await page.textContent('.store-message h1'), 'The store is not available right now.');
      assert.match(await page.textContent('.store-message p'), reason);
    });
  }
  assert.ok(store);
});

test('a page whose scripts fail to load says so in English and Spanish, and reloading recovers it', () => withShop({}, async (shop) => {
  // dom.js is imported by every page: when it drops, no module of the page runs
  let dropping = true;
  await shop.get('context').route('**/src/dom.js', (route) => (dropping ? route.abort('internetdisconnected') : route.fallback()));
  const pages = await Promise.all(['index.html', `product.html?id=${INVADERS}`, 'checkout.html'].map((path) => shop.page(path)));

  for (const page of pages) assert.equal(await page.isVisible('.boot-notice'), false, `${page.url()}: not before the wait`);
  await Promise.all(pages.map((page) => page.waitForSelector('.boot-notice', { state: 'visible', timeout: NOTICE_TIMEOUT_MS })));
  for (const page of pages) {
    assert.deepEqual(await page.locator('.boot-notice p').allTextContents(), [
      'The store didn’t finish loading. Check your connection and reload the page.',
      'La tienda no terminó de cargar. Revisá tu conexión y recargá la página.',
    ]);
  }

  dropping = false;
  for (const page of pages) {
    assert.equal(await page.$eval('.boot-notice a', (link) => link.href), page.url(), 'the same page, query included');
    await Promise.all([page.waitForEvent('load'), page.click('.boot-notice a')]);
    await page.waitForSelector('html.i18n-ready');
    assert.equal(await page.locator('.boot-notice').count(), 0);
  }
}));

test('the notice also shows to a buyer who asks for reduced motion', () => withShop({ reducedMotion: 'reduce' }, async (shop) => {
  await shop.get('context').route('**/src/dom.js', (route) => route.abort('internetdisconnected'));
  const page = await shop.page('index.html');
  await page.waitForSelector('.boot-notice', { state: 'visible', timeout: NOTICE_TIMEOUT_MS });
}));

test('a page whose scripts start without its stylesheet does not tell the buyer to reload', () => withShop({}, async (shop) => {
  // Mid-payment, a reload link would invite the very reload the checkout locks away
  await shop.get('context').route('**/css/store.css', (route) => route.abort('internetdisconnected'));
  const pages = await Promise.all(['index.html', `product.html?id=${INVADERS}`, 'checkout.html'].map((path) => shop.page(path)));
  for (const page of pages) {
    await page.waitForSelector('html.i18n-ready');
    assert.equal(await page.locator('.boot-notice').count(), 0, page.url());
  }
}));

test('the collection says so when nothing is for sale', async () => {
  const raw = await catalog();
  const drafts = {
    ...raw,
    designs: raw.designs.map((design) => ({ ...design, status: 'draft' })),
    series: raw.series.map((series) => ({ ...series, status: 'draft' })),
  };
  await withShop({ catalogBody: JSON.stringify(drafts) }, async (shop) => {
    const page = await shop.page('index.html');
    await page.waitForSelector('#collection .muted');
    assert.equal(await page.textContent('#collection .muted'), 'No T-shirts for sale yet.');
  });
});
