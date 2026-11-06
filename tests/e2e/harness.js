// Harness of the browser tests: Chromium (playwright-core), the site served locally, and every outside
// service answered by the test (Yadio, the LN address, the payment status and the Nostr relays). Anything
// else is blocked, so nothing leaves the machine and no real invoice or order is ever made.
// It also records the JavaScript coverage of every page (V8, through CDP), for tests/e2e/report.js.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';
import { generateSecretKey, getPublicKey, npubEncode, unwrapEvent } from '../../src/vendor/nostr-tools.js';
import { buildInvoice } from '../helpers/invoice.js';
import { startSite } from './server.js';

/** 1 BTC = 100,000,000 ARS, so 1 ARS = 1 sat. */
export const RATE = 100_000_000;
const YADIO_URL = 'https://api.yadio.io/exrates/BTC';
const LNURLP_URL = 'https://pay.mostro.foundation/.well-known/lnurlp/store';
const CALLBACK_URL = 'https://pay.mostro.foundation/lnurlp/api/v1/lnurl/cb/e2e';
const CALLBACK = /^https:\/\/pay\.mostro\.foundation\/lnurlp\/api\/v1\/lnurl\/cb\/e2e\?/;
const STATUS = /^https:\/\/pay\.mostro\.foundation\/api\/v1\/payments\/[0-9a-f]{64}$/;
const CORS = Object.freeze({ 'access-control-allow-origin': '*' });
const CATALOG = new URL('../../catalog.json', import.meta.url);
const COVERAGE_DIR = new URL('../../coverage/e2e/', import.meta.url);
const ACTION_TIMEOUT_MS = 10_000;
const SNAPSHOT_TIMEOUT_MS = 2_000;

export const BUYER = Object.freeze({
  street: 'Av. Siempreviva',
  number: '742',
  floor: '3',
  apartment: 'B',
  postalCode: '1234',
  city: 'Springfield',
  province: 'Buenos Aires',
  notes: 'Ring twice',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  phone: '11 2233 4455',
});

const coverage = [];
const ROOT = new URL('../../', import.meta.url);

export const launchBrowser = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

/** catalog.json with the store's npub swapped for a key the test holds, plus `store` overrides. */
async function testCatalog(npub, store) {
  const raw = JSON.parse(await readFile(CATALOG, 'utf8'));
  return { ...raw, store: { ...raw.store, nostr: { ...raw.store.nostr, npub }, ...store } };
}

function answerInvoice(shop, route) {
  if (shop.lnurlError) return json(route, { status: 'ERROR', reason: shop.lnurlError });
  const params = new URL(route.request().url()).searchParams;
  const preimage = randomBytes(32);
  const paymentHash = createHash('sha256').update(preimage).digest('hex');
  const pr = buildInvoice({
    sats: Number(params.get('amount')) / 1000, paymentHash, timestamp: Math.floor(Date.now() / 1000), expiry: shop.invoiceExpiry,
  });
  shop.invoices.push({ pr, paymentHash, preimage: preimage.toString('hex'), comment: params.get('comment') });
  return json(route, { pr, routes: [] });
}

function answerStatus(shop, route) {
  shop.statusChecks += 1;
  if (shop.statusDown) return route.fulfill({ status: 503, headers: CORS });
  return json(route, { paid: shop.paid });
}

/** A relay that has no events and accepts (or rejects) whatever is published. */
function relay(shop, ws) {
  ws.onMessage((message) => {
    const [type, payload] = JSON.parse(message);
    if (type === 'REQ') ws.send(JSON.stringify(['EOSE', payload]));
    if (type === 'EVENT') {
      shop.published.push(payload);
      ws.send(JSON.stringify(['OK', payload.id, shop.relayAccepts, shop.relayAccepts ? '' : 'blocked: test']));
    }
  });
}

async function route(shop) {
  const { context, site } = shop;
  // Registered first, so it only answers what nothing below does: nothing leaves the machine
  await context.route((url) => !url.href.startsWith(site.url), (r) => r.abort('blockedbyclient'));
  await context.route(YADIO_URL, (r) => (shop.yadioDown ? r.fulfill({ status: 500, headers: CORS }) : json(r, { BTC: { ARS: RATE } })));
  await context.route(LNURLP_URL, (r) => json(r, {
    tag: 'payRequest', callback: CALLBACK_URL, minSendable: 1000, maxSendable: 100_000_000_000,
    metadata: '[["text/plain","Mostro Store"]]', commentAllowed: 255,
  }));
  await context.route(CALLBACK, (r) => answerInvoice(shop, r));
  await context.route(STATUS, (r) => answerStatus(shop, r));
  await context.routeWebSocket(/^wss:\/\//, (ws) => relay(shop, ws));
}

/** The NIP-17 messages the store received, decrypted with its key: [{ subject, content }]. */
function orders(shop) {
  const wraps = [...new Map(shop.published.map((event) => [event.id, event])).values()];
  return wraps.map((wrap) => unwrapEvent(wrap, shop.storeKey)).map((rumor) => ({
    subject: rumor.tags.find(([name]) => name === 'subject')?.[1],
    content: rumor.content,
  }));
}

async function newPage(shop, path, { clock = false, blockStorage = false, webln = null, init = null } = {}) {
  const page = await shop.context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  page.on('pageerror', (error) => shop.pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') shop.consoleErrors.push(message.text()); });
  shop.pages.push(page);
  const snapshot = await trackCoverage(shop, page);
  shop.trackers.set(page, snapshot);
  await saveCoverageBeforeLeaving(page, snapshot);
  if (clock) await page.clock.install();
  if (blockStorage) {
    // A browser that blocks site storage: reading window.localStorage throws
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } }));
  }
  if (init) await page.addInitScript(init);
  if (webln) {
    await page.exposeFunction('e2eWebln', (pr) => webln(pr));
    await page.addInitScript(() => {
      window.webln = { enable: async () => {}, sendPayment: (pr) => window.e2eWebln(pr) };
    });
  }
  await page.goto(`${shop.site.url}/${path}`);
  return page;
}

/**
 * A document's coverage is gone once the page leaves it, and DevTools holds every command while a
 * navigation is pending, so the snapshot has to come first: the page's own navigations (links,
 * location.assign / replace / reload) are paused with the Navigation API until it is saved, and
 * page.goto() saves it before going.
 */
async function saveCoverageBeforeLeaving(page, snapshot) {
  await page.exposeFunction('e2eSaveCoverage', () => snapshot());
  await page.addInitScript(() => {
    let leaving = false;
    window.navigation.addEventListener('navigate', (event) => {
      const crossDocument = !event.destination.sameDocument && !event.hashChange && event.downloadRequest === null;
      if (leaving || !crossDocument || !event.cancelable || event.navigationType === 'traverse') return;
      event.preventDefault();
      const { navigationType: type, destination: { url } } = event;
      window.e2eSaveCoverage().finally(() => {
        leaving = true;
        if (type === 'reload') window.location.reload();
        else if (type === 'replace') window.location.replace(url);
        else window.location.assign(url);
      });
    });
  });
  const goto = page.goto.bind(page);
  // The harness owns these pages: their goto saves the coverage first
  page.goto = async (...args) => {
    await snapshot();
    return goto(...args);
  };
}

/**
 * Precise V8 coverage of `page` through CDP. Returns snapshot(): it saves what ran since the last one.
 * The harness snapshots before every navigation and when the shop closes; the report joins the snapshots.
 */
async function trackCoverage(shop, page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  const prefix = `${shop.site.url}/src/`;
  return async () => {
    // A blank page has nothing to save (and is swapped for the site's process on its first navigation)
    if (page.isClosed() || page.url() === 'about:blank') return;
    const taken = cdp.send('Profiler.takePreciseCoverage');
    const timeout = new Promise((resolve) => { setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT_MS); });
    const answer = await Promise.race([taken, timeout]);
    if (process.env.E2E_DEBUG) console.log('snapshot', page.url(), answer ? 'ok' : 'timed out');
    if (!answer) return;
    const { result } = answer;
    coverage.push(...result
      .filter(({ url }) => url.startsWith(prefix) && !url.startsWith(`${prefix}vendor/`))
      .map(({ url, functions }) => ({ path: new URL(url).pathname.slice(1), functions })));
  };
}

/**
 * A store on its own server and browser context. Options: locale ('en-US'), reducedMotion
 * ('no-preference', or 'reduce' for a buyer who asks the system for less motion), store (overrides of
 * catalog.json → store), catalogBody (the whole catalog.json, as text), files ({ path: body or status }).
 * The returned shop holds the knobs of the outside services and what they received.
 */
export async function openShop(browser, { locale = 'en-US', reducedMotion = 'no-preference', store = {}, catalogBody = null, files = {} } = {}) {
  const storeKey = generateSecretKey();
  const catalog = catalogBody ?? JSON.stringify(await testCatalog(npubEncode(getPublicKey(storeKey)), store));
  const site = await startSite({ '/catalog.json': catalog, ...files });
  const context = await browser.newContext({ locale, reducedMotion, viewport: { width: 1280, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: site.url });
  const shop = {
    site, context, storeKey,
    // Knobs
    yadioDown: false, lnurlError: null, invoiceExpiry: 600, paid: false, statusDown: false, relayAccepts: true,
    // What happened
    invoices: [], published: [], statusChecks: 0, pages: [], pageErrors: [], consoleErrors: [], trackers: new Map(),
  };
  await route(shop);
  return {
    url: site.url,
    set: (knobs) => Object.assign(shop, knobs),
    get: (name) => shop[name],
    page: (path, options) => newPage(shop, path, options),
    orders: () => orders(shop),
    close: async () => {
      await Promise.all([...shop.trackers.values()].map((snapshot) => snapshot()));
      await context.close();
      await site.close();
    },
  };
}

/** Writes the coverage gathered by this test file to coverage/e2e/<name>.json, with each file's source. */
export async function saveCoverage(name) {
  const paths = [...new Set(coverage.map((entry) => entry.path))];
  const sources = new Map(await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, ROOT), 'utf8')])));
  await mkdir(COVERAGE_DIR, { recursive: true });
  await writeFile(new URL(`${name}.json`, COVERAGE_DIR), JSON.stringify(coverage.map((entry) => ({ ...entry, source: sources.get(entry.path) }))));
}

/** Fills the checkout form with `buyer`. */
export async function fillCheckout(page, buyer = BUYER) {
  for (const [name, value] of Object.entries(buyer)) {
    if (name === 'province') await page.selectOption('#field-province', value);
    else await page.fill(`#field-${name}`, value);
  }
}

/** Adds `count` of a product to the cart from its page, and stays there. */
export async function addToCart(page, shopUrl, id, count = 1) {
  await page.goto(`${shopUrl}/product.html?id=${id}`);
  for (let i = 0; i < count; i += 1) await page.click('#add-to-cart');
}
