// The store pages in a real browser: language, collection, product page, size guide, cart panel and old
// links. Run with `npm run test:e2e`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launchBrowser, openShop, saveCoverage, addToCart } from './harness.js';

const INVADERS = 'mostro-invaders';
const NAME = 'Mostro Invaders';
const CATALOG = new URL('../../catalog.json', import.meta.url);

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

test('an English browser gets English; the switch moves to Spanish and remembers it', () => withShop({}, async (shop) => {
  const page = await shop.page('index.html');
  await page.waitForSelector('.product-card');
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
  assert.equal(await page.textContent('h1'), 'Mostro T-shirts');
  assert.equal(await page.textContent('.product-card .price-mono'), 'ARS\u00a030,000');
  assert.deepEqual(await page.locator('.section-title').allTextContents(), ['Designs', 'Mostro says…']);

  await Promise.all([page.waitForEvent('load'), page.click('#lang-switch')]);
  await page.waitForSelector('.product-card');
  assert.equal(await page.getAttribute('html', 'lang'), 'es');
  assert.equal(await page.textContent('h1'), 'Remeras Mostro');
  assert.equal(await page.textContent('.product-card .price-mono'), '$30.000');

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
  assert.equal(await page.textContent('#lang-switch'), 'EN');
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
  await Promise.all([page.waitForURL(/product\.html\?id=mostro-quotes-/), related.first().click()]);
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
  assert.match(await page.textContent('.cart-summary'), /Total: ARS\u00a0150,000/);
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
  assert.match(page.url(), /product\.html/);
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

test('old links (producto.html?talle=, visor.html) land on the new pages', () => withShop({}, async (shop) => {
  const page = await shop.page(`producto.html?id=${INVADERS}&color=navy&talle=M`);
  await page.waitForURL(/product\.html\?id=mostro-invaders&color=navy&size=M$/);
  await page.waitForSelector('#product:not([hidden])');
  assert.equal(await page.inputValue('#size-select'), 'M');
  await page.goto(`${shop.url}/visor.html?debug#shirt=${INVADERS}`);
  await page.waitForURL(/viewer\.html\?debug#/);
  await page.waitForSelector('dialog.detail[open]');
}));
