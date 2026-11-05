import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lnurlpUrl,
  parsePayParams,
  callbackUrl,
  parseInvoiceResponse,
  statusUrl,
  isSettled,
  requestInvoice,
  invoiceTimingProblem,
} from '../../src/store/lnurl.js';

// BOLT #11 example: 250,000,000 msat, timestamp 1496314658, expiry 60 s
const COFFEE = 'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh';
const COFFEE_MSAT = 250_000_000;
const COFFEE_HASH = '0001020304050607080900010203040506070809000102030405060708090102';
// "now" right after the example invoice was issued
const COFFEE_NOW = 1496314658 * 1000 + 5000;
// BOLT #11 testnet example (2,000,000,000 msat)
const TESTNET = 'lntb20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfpp3x9et2e20v6pu37c5d9vax37wxq72un989qrsgqdj545axuxtnfemtpwkc45hx9d2ft7x04mt8q7y6t0k2dge9e7h8kpy9p34ytyslj3yu569aalz2xdk8xkd7ltxqld94u8h2esmsmacgpghe9k8';

const PARAMS_JSON = {
  tag: 'payRequest',
  callback: 'https://pay.mostro.foundation/lnurlp/api/v1/lnurl/cb/StDxvw',
  minSendable: 1000,
  maxSendable: 5_000_000_000,
  metadata: '[["text/plain", "Payment to dev"]]',
  commentAllowed: 255,
};

test('lnurlpUrl builds the LUD-16 well-known URL', () => {
  assert.equal(lnurlpUrl('dev@pay.mostro.foundation'), 'https://pay.mostro.foundation/.well-known/lnurlp/dev');
  assert.throws(() => lnurlpUrl('nope'), /LN address/);
});

test('parsePayParams keeps the fields the store needs', () => {
  assert.deepEqual(parsePayParams(PARAMS_JSON), {
    callback: PARAMS_JSON.callback,
    minSendable: 1000,
    maxSendable: 5_000_000_000,
    commentAllowed: 255,
  });
  assert.equal(parsePayParams({ ...PARAMS_JSON, commentAllowed: undefined }).commentAllowed, 0);
});

test('parsePayParams only accepts a callback on the LN address host', () => {
  assert.equal(parsePayParams(PARAMS_JSON, 'pay.mostro.foundation').callback, PARAMS_JSON.callback);
  assert.throws(() => parsePayParams({ ...PARAMS_JSON, callback: 'https://evil.example/cb' }, 'pay.mostro.foundation'), /another server/);
});

test('parsePayParams rejects answers that are not usable payRequests', () => {
  const bad = [
    null,
    { ...PARAMS_JSON, tag: 'withdrawRequest' },
    { ...PARAMS_JSON, callback: 'http://pay.example/cb' },
    { ...PARAMS_JSON, callback: 'not a url' },
    { ...PARAMS_JSON, minSendable: 5000, maxSendable: 1000 },
    { ...PARAMS_JSON, minSendable: '1000' },
    { status: 'ERROR', reason: 'disabled' },
  ];
  bad.forEach((json) => assert.throws(() => parsePayParams(json), Error, JSON.stringify(json)));
});

test('callbackUrl adds the amount and a comment cut to the allowed length', () => {
  const params = parsePayParams(PARAMS_JSON);
  const url = new URL(callbackUrl(params, 22_358_000, 'Pedido MS-AB12CD'));
  assert.equal(url.origin + url.pathname, PARAMS_JSON.callback);
  assert.equal(url.searchParams.get('amount'), '22358000');
  assert.equal(url.searchParams.get('comment'), 'Pedido MS-AB12CD');

  const short = new URL(callbackUrl({ ...params, commentAllowed: 6 }, 1000, 'Pedido MS-AB12CD'));
  assert.equal(short.searchParams.get('comment'), 'Pedido');
  const none = new URL(callbackUrl({ ...params, commentAllowed: 0 }, 1000, 'Pedido'));
  assert.equal(none.searchParams.has('comment'), false);
});

test('callbackUrl keeps query parameters already in the callback', () => {
  const params = { ...parsePayParams(PARAMS_JSON), callback: 'https://pay.example/cb?k1=abc' };
  const url = new URL(callbackUrl(params, 1000, ''));
  assert.equal(url.searchParams.get('k1'), 'abc');
  assert.equal(url.searchParams.get('amount'), '1000');
});

test('callbackUrl refuses amounts outside the server limits', () => {
  const params = parsePayParams(PARAMS_JSON);
  assert.throws(() => callbackUrl(params, 999, ''), /amount/);
  assert.throws(() => callbackUrl(params, 5_000_000_001, ''), /amount/);
  assert.throws(() => callbackUrl(params, 1000.5, ''), /amount/);
});

const CALLBACK = 'https://pay.example/cb';
const at = { now: COFFEE_NOW, callback: CALLBACK };

test('parseInvoiceResponse accepts an invoice for exactly the requested amount', () => {
  assert.deepEqual(parseInvoiceResponse({ pr: COFFEE, routes: [] }, COFFEE_MSAT, at), {
    pr: COFFEE,
    paymentHash: COFFEE_HASH,
    expiresAt: (1496314658 + 60) * 1000,
    verify: null,
  });
});

test('parseInvoiceResponse keeps only an https verify URL on the callback origin', () => {
  const check = (verify) => parseInvoiceResponse({ pr: COFFEE, verify }, COFFEE_MSAT, at).verify;
  assert.equal(check('https://pay.example/verify/1'), 'https://pay.example/verify/1');
  assert.equal(check('http://pay.example/verify/1'), null);
  assert.equal(check('https://other.example/verify/1'), null);
});

test('parseInvoiceResponse rejects errors, missing invoices and wrong amounts', () => {
  assert.throws(() => parseInvoiceResponse({ status: 'ERROR', reason: 'Amount too small' }, COFFEE_MSAT, at), /Amount too small/);
  assert.throws(() => parseInvoiceResponse({}, COFFEE_MSAT, at), /invoice/);
  assert.throws(() => parseInvoiceResponse({ pr: COFFEE }, COFFEE_MSAT + 1000, at), /amount/);
  assert.throws(() => parseInvoiceResponse({ pr: 'lnbc1nope' }, COFFEE_MSAT, at), Error);
});

test('parseInvoiceResponse rejects invoices that are not for Bitcoin mainnet', () => {
  assert.throws(() => parseInvoiceResponse({ pr: TESTNET }, 2_000_000_000, at), /mainnet/);
});

test('parseInvoiceResponse rejects an invoice whose date is far from now', () => {
  const later = { ...at, now: COFFEE_NOW + 11 * 60 * 1000 };
  assert.throws(() => parseInvoiceResponse({ pr: COFFEE }, COFFEE_MSAT, later), /date/);
});

test('invoiceTimingProblem accepts a fresh invoice with a sane expiry', () => {
  const now = 1_800_000_000_000;
  const timestamp = now / 1000;
  assert.equal(invoiceTimingProblem({ timestamp, expiry: 3600 }, now), null);
  assert.equal(invoiceTimingProblem({ timestamp: timestamp - 300, expiry: 60 }, now), null);
  assert.match(invoiceTimingProblem({ timestamp, expiry: 30 }, now), /expiry/);
  assert.match(invoiceTimingProblem({ timestamp, expiry: 2 * 86400 }, now), /expiry/);
  assert.match(invoiceTimingProblem({ timestamp: timestamp + 3600, expiry: 3600 }, now), /date/);
});

test('statusUrl prefers LUD-21 verify and falls back to the LNbits payment endpoint', () => {
  const invoice = { paymentHash: COFFEE_HASH, verify: 'https://pay.example/verify/1' };
  assert.equal(statusUrl(invoice, PARAMS_JSON.callback), 'https://pay.example/verify/1');
  assert.equal(
    statusUrl({ ...invoice, verify: null }, PARAMS_JSON.callback),
    `https://pay.mostro.foundation/api/v1/payments/${COFFEE_HASH}`,
  );
});

test('isSettled understands LUD-21 and LNbits answers', () => {
  assert.equal(isSettled({ status: 'OK', settled: true }), true);
  assert.equal(isSettled({ paid: true }), true);
  assert.equal(isSettled({ paid: false }), false);
  assert.equal(isSettled({ settled: 'true' }), false);
  assert.equal(isSettled(null), false);
});

test('requestInvoice runs the LNURL-pay flow and returns the checked invoice', async () => {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    return url.includes('.well-known') ? PARAMS_JSON : { pr: COFFEE, routes: [] };
  };
  const invoice = await requestInvoice({
    address: 'dev@pay.mostro.foundation', msat: COFFEE_MSAT, comment: 'Pedido MS-1', fetchJson, now: COFFEE_NOW,
  });
  assert.equal(calls[0], 'https://pay.mostro.foundation/.well-known/lnurlp/dev');
  assert.match(calls[1], /amount=250000000&comment=Pedido\+MS-1$/);
  assert.equal(invoice.paymentHash, COFFEE_HASH);
  assert.equal(invoice.statusUrl, `https://pay.mostro.foundation/api/v1/payments/${COFFEE_HASH}`);
});
