// The checkout in a real browser, end to end: form, Lightning invoice, payment confirmation, WebLN, the
// encrypted order the store receives, and every way it can go wrong. All outside services are answered by
// the harness: no real invoice is requested and no real order is sent. Run with `npm run test:e2e`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, openShop, saveCoverage, fillCheckout, addToCart, BUYER } from './harness.js';

const INVADERS = 'mostro-invaders';
const NAME = 'Mostro Invaders';
const ORDER_ID = /MS-[0-9A-HJKMNP-TV-Z]{6}/;
const STATUS = /\/api\/v1\/payments\//;
const POLL_MS = 3000;
const SLOW = { timeout: 20_000 };

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => {
  await browser?.close();
  await saveCoverage('checkout');
});

async function withShop(options, scenario) {
  const shop = await openShop(browser, options);
  try {
    await scenario(shop);
    assert.deepEqual(shop.get('pageErrors'), []);
  } finally {
    await shop.close();
  }
}

/** A checkout page with `count` Mostro Invaders in the cart and the form filled in. */
async function readyCheckout(shop, { count = 1, pageOptions = {}, buyer = BUYER } = {}) {
  const page = await shop.page('index.html', pageOptions);
  await addToCart(page, shop.url, INVADERS, count);
  await page.goto(`${shop.url}/checkout.html`);
  await page.waitForSelector('#pay-button');
  await fillCheckout(page, buyer);
  return page;
}

async function payAndWaitForInvoice(page) {
  await page.click('#pay-button');
  await page.waitForSelector('.order-id');
  return ORDER_ID.exec(await page.textContent('.order-id'))[0];
}

/** With the page clock installed: lets one status check run and waits for its answer. */
async function pollOnce(page, ms = POLL_MS) {
  await Promise.all([page.waitForResponse((response) => STATUS.test(response.url())), page.clock.fastForward(ms)]);
}

test('paying with Lightning: the order reaches the store encrypted and the cart empties', () => withShop({}, async (shop) => {
  const page = await shop.page('index.html');
  await addToCart(page, shop.url, INVADERS, 2);
  await page.goto(`${shop.url}/checkout.html`);
  await page.waitForSelector('#pay-button');
  assert.equal(await page.textContent('#summary-sats'), '≈ 120,000 sats');
  assert.match(await page.textContent('#payment-body'), /≈ 120,000 sats.*ARS\u00a0120,000 · 1 BTC = ARS\u00a0100,000,000 per Yadio/s);

  // Paying with an empty form points at the first problem
  await page.click('#pay-button');
  assert.equal(await page.textContent('#field-street-error'), 'Street is required.');
  assert.equal(await page.textContent('#pay-hint'), 'Fill in the street to continue.');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'field-street');
  await page.fill('#field-email', 'ana@');
  await page.press('#field-email', 'Tab');
  assert.equal(await page.textContent('#field-email-error'), 'Check the email.');

  // The form survives a reload, and "Clear saved details" forgets it
  await fillCheckout(page);
  assert.equal(await page.textContent('#field-notes-counter'), '10/500');
  assert.equal(await page.textContent('#pay-hint'), '');
  await page.reload();
  await page.waitForSelector('#pay-button');
  assert.equal(await page.inputValue('#field-street'), BUYER.street);
  await page.click('#clear-saved');
  assert.equal(await page.inputValue('#field-street'), '');
  // Data saved more than a week ago is not restored
  await page.evaluate(() => sessionStorage.setItem('mostro-store:checkout', JSON.stringify({ savedAt: 0, values: { street: 'Old' } })));
  await page.reload();
  await page.waitForSelector('#pay-button');
  assert.equal(await page.inputValue('#field-street'), '');
  await fillCheckout(page);

  const id = await payAndWaitForInvoice(page);
  assert.equal(await page.isDisabled('#lang-switch'), true);
  assert.equal(await page.textContent('#payment-status'), `Invoice ready for order ${id}: 120,000 sats.`);
  assert.equal(await page.locator('#payment-body svg.qr').count(), 1);
  assert.match(await page.textContent('#payment-body'), /The invoice expires in (9:5\d|10:00)/);
  const [invoice] = shop.get('invoices');
  assert.equal(invoice.comment, `Pedido ${id} · store.mostro.network`);

  await page.click('text=Copy invoice');
  await page.waitForSelector('text=Copied!');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), invoice.pr);
  // Without clipboard access the invoice is selected for copying by hand
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('denied')) }));
  await page.click('#payment-body .invoice-actions button.button-secondary');
  await page.waitForSelector('text=Select the invoice and copy it by hand.');

  shop.set({ paid: true });
  await page.waitForSelector('#payment-body h3:text("Payment received!")', SLOW);
  assert.match(await page.textContent('#payment-body'), new RegExp(`Your order ${id} is confirmed\\.`));
  assert.match(await page.textContent('#payment-body'), /We’ll write to ana@example\.com to arrange shipping\./);
  assert.equal(await page.isDisabled('#lang-switch'), true);
  assert.equal(await page.isHidden('#cart-button'), true);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('mostro-store:checkout')), null);
  assert.match(await page.textContent('#summary-lines'), new RegExp(`${NAME} \\(2\\)`));

  const [order, paid] = shop.orders();
  assert.equal(order.subject, `Pedido ${id}`);
  assert.match(order.content, /Pendiente de pago/);
  assert.match(order.content, /2 × Mostro Invaders — Black, talle L — \$120\.000/);
  assert.match(order.content, /Ana Pérez/);
  assert.match(order.content, /Idioma: inglés/);
  assert.match(paid.content, new RegExp(`✅ Pedido ${id} pagado: 120\\.000 sats recibidos\\.`));
}));

test('WebLN: the extension pays, and its preimage proves it', () => withShop({}, async (shop) => {
  const webln = (pr) => ({ preimage: shop.get('invoices').find((invoice) => invoice.pr === pr).preimage });
  const page = await readyCheckout(shop, { pageOptions: { webln } });
  await payAndWaitForInvoice(page);
  await page.click('text=Pay with the extension');
  await page.waitForSelector('#payment-body h3:text("Payment received!")');
  assert.equal(shop.get('paid'), false, 'confirmed by the preimage, not by the status check');
}));

test('WebLN: a wrong proof keeps waiting, and a failing extension says so', () => withShop({}, async (shop) => {
  let calls = 0;
  const webln = () => {
    calls += 1;
    if (calls === 1) return { preimage: '00'.repeat(32) };
    throw new Error('rejected by the user');
  };
  const page = await readyCheckout(shop, { pageOptions: { webln, clock: true } });
  await payAndWaitForInvoice(page);
  await page.click('text=Pay with the extension');
  await page.waitForSelector('text=The extension didn’t return a proof of payment. Still waiting for the confirmation…');
  await page.click('text=Pay with the extension');
  await page.waitForSelector('text=The extension couldn’t pay. Try the QR.');
}));

test('a status endpoint that cannot be reached lets the buyer say they paid (in Spanish)', () => withShop({ locale: 'es-AR' }, async (shop) => {
  shop.set({ statusDown: true });
  const page = await readyCheckout(shop);
  await page.click('#clear-saved');
  await page.click('#pay-button');
  assert.equal(await page.textContent('#pay-hint'), 'Completá la calle para continuar.');
  await fillCheckout(page);
  const id = await payAndWaitForInvoice(page);
  await page.click('text=Ya pagué', SLOW);
  await page.waitForSelector('#payment-body h3:text("¡Gracias!")');
  assert.match(await page.textContent('#payment-body'), new RegExp(`Tu pedido ${id} quedó registrado`));
  const messages = shop.orders();
  assert.match(messages[0].content, /Idioma: español/);
  assert.match(messages[1].content, new RegExp(`⚠️ Pedido ${id}: el comprador dice que ya pagó`));
}));

test('an expired invoice offers a new one at the current rate', () => withShop({}, async (shop) => {
  shop.set({ invoiceExpiry: 60 });
  const page = await readyCheckout(shop, { pageOptions: { clock: true } });
  await payAndWaitForInvoice(page);
  await pollOnce(page);
  await pollOnce(page, 60_000);
  await page.waitForSelector('#payment-body h3:text("The invoice expired")');
  await page.click('text=Create another invoice');
  await page.waitForSelector('.order-id');
  assert.equal(shop.get('invoices').length, 2);
}));

test('a payment that cannot be confirmed before the invoice expires is "unconfirmed", not "expired"', () => withShop({}, async (shop) => {
  shop.set({ invoiceExpiry: 60, statusDown: true });
  const page = await readyCheckout(shop, { pageOptions: { clock: true } });
  const id = await payAndWaitForInvoice(page);
  for (let i = 0; i < 3; i += 1) await pollOnce(page);
  await page.waitForSelector('text=I’ve paid');
  await pollOnce(page, 60_000);
  await page.waitForSelector('#payment-body h3:text("We couldn’t confirm the payment")');
  assert.match(await page.textContent('#payment-body'), new RegExp(`If you already paid, don’t pay again: the store sees your payment for order ${id}`));
  await page.click('text=Create another invoice');
  await page.waitForSelector('.order-id');
}));

test('a payment made just before "Change my details" still completes the order', () => withShop({}, async (shop) => {
  const page = await readyCheckout(shop, { pageOptions: { clock: true } });
  await payAndWaitForInvoice(page);
  shop.set({ paid: true });
  await page.click('text=Change my details');
  await page.waitForSelector('#payment-body h3:text("Payment received!")');
  assert.equal(await page.isDisabled('#lang-switch'), true);
}));

test('changing the cart while an invoice is open cancels it', () => withShop({}, async (shop) => {
  const page = await readyCheckout(shop, { pageOptions: { clock: true } });
  await payAndWaitForInvoice(page);
  await page.click('#cart-button');
  await page.click(`button[aria-label="One more ${NAME}"]`);
  await page.click('dialog.cart-panel .icon-button');
  await page.waitForSelector('#pay-button');
  assert.equal(await page.textContent('#pay-hint'), 'Your cart changed: create a new invoice.');
  assert.equal(await page.isDisabled('#lang-switch'), false);
  assert.equal(await page.textContent('#summary-total'), 'ARS\u00a0120,000');
  // With no invoice open, a cart change just updates the summary
  await page.click('#cart-button');
  await page.click(`button[aria-label="One more ${NAME}"]`);
  await page.click('dialog.cart-panel .icon-button');
  assert.equal(await page.textContent('#summary-total'), 'ARS\u00a0180,000');
}));

test('Yadio down, an LN server that refuses and relays that reject: each says what failed', () => withShop({}, async (shop) => {
  shop.set({ yadioDown: true });
  const page = await readyCheckout(shop);
  assert.match(await page.textContent('#payment-body'), /no exchange rate/);
  await page.click('#pay-button');
  await page.waitForSelector('#payment-body h3:text("Couldn’t prepare the payment")');
  assert.match(await page.textContent('#payment-body'), /We couldn’t get the exchange rate from Yadio\./);
  await page.click('summary:text("Technical detail")');
  assert.match(await page.textContent('.error-detail'), /HTTP 500/);

  shop.set({ yadioDown: false, lnurlError: 'amount too low' });
  await page.click('text=Try again');
  await page.waitForSelector('text=The Lightning server couldn’t create the invoice.');
  assert.match(await page.textContent('.error-detail'), /amount too low/);

  shop.set({ lnurlError: null, relayAccepts: false });
  await page.click('text=Try again');
  await page.waitForSelector('text=We couldn’t send your order to the store over Nostr.');

  shop.set({ relayAccepts: true });
  await page.click('text=Try again');
  await page.waitForSelector('.order-id');
}));

test('an empty cart at the checkout points back to the collection', () => withShop({}, async (shop) => {
  const page = await shop.page('checkout.html');
  await page.waitForSelector('#checkout-empty:not([hidden])');
  assert.equal(await page.isHidden('#checkout-content'), true);
}));

test('a store without a valid LN address shows the products but closes the payment', () => withShop({ store: { lnAddress: 'nope' } }, async (shop) => {
  const page = await shop.page('index.html');
  await addToCart(page, shop.url, INVADERS);
  await page.goto(`${shop.url}/checkout.html`);
  await page.waitForSelector('text=Payments are not set up in this store yet.');
}));
