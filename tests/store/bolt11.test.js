import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeInvoice, hrpAmountMsat } from '../../src/store/bolt11.js';

// Builds bech32 strings with a valid checksum, to reach the checks that come after it (BIP-173)
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const polymod = (values) => values.reduce((chk, value) => {
  const top = chk >>> 25;
  const next = ((chk & 0x1ffffff) << 5) ^ value;
  return GENERATOR.reduce((acc, gen, i) => (((top >>> i) & 1) ? acc ^ gen : acc), next);
}, 1);
const hrpExpand = (hrp) => [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
function bech32(hrp, words) {
  const mod = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = [0, 1, 2, 3, 4, 5].map((i) => (mod >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...words, ...checksum].map((w) => CHARSET[w]).join('')}`;
}
const TIMESTAMP = new Array(7).fill(0);
const SIGNATURE = new Array(104).fill(0);
const invoiceWith = (tagged) => bech32('lnbc', [...TIMESTAMP, ...tagged, ...SIGNATURE]);

// Test vectors from BOLT #11 (11-payment-encoding.md, "Examples")
const SPEC_HASH = '0001020304050607080900010203040506070809000102030405060708090102';
const SPEC_TIMESTAMP = 1496314658;
const DONATION = 'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';
const COFFEE = 'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh';
const HASHED_LIST = 'lnbc20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqs9qrsgq7ea976txfraylvgzuxs8kgcw23ezlrszfnh8r6qtfpr6cxga50aj6txm9rxrydzd06dfeawfk6swupvz4erwnyutnjq7x39ymw6j38gp7ynn44';
// 1-sat invoice issued by pay.mostro.foundation (LNbits), decoded independently with Python
const LNBITS = 'lnbc10n1p4whpnqpp5sjr8j5rus7jtkrvqdspg7tzw5wnjffrdq9tejkazx6frc9vv0gmqcqzyssp526634wclndhy0449agzduzykue076jhuc5sqdsdf6leqd3xpt0tq9q7sqqqqqqqqqqqqqqqqqqqsqqqqqysgqhp55zskqa2lk2r0gamky89rmr39l5ks8ul6wzveepmtevhwhztyqk9qmqz9gxqrrssrzjqwryaup9lh50kkranzgcdnn2fgvx390wgj5jd07rwr3vxeje0glclle5rvte3pqhkcqqqqlgqqqqqeqqjqswl94ad25rsthxj3s64jlmt7y7qngzwgfku7jkcxq2eg8mjq8vqredv9cektyfa5yyyh2quz4uar04e5usftjp28n89xgacc7xn5rycpnlk9yg';

test('decodes amount, payment hash, timestamp and expiry of the BOLT11 coffee example', () => {
  assert.deepEqual(decodeInvoice(COFFEE), {
    network: 'bc',
    msat: 250_000_000,
    paymentHash: SPEC_HASH,
    timestamp: SPEC_TIMESTAMP,
    expiry: 60,
  });
});

test('an invoice without amount or expiry gets msat null and the default hour', () => {
  const invoice = decodeInvoice(DONATION);
  assert.equal(invoice.msat, null);
  assert.equal(invoice.expiry, 3600);
  assert.equal(invoice.paymentHash, SPEC_HASH);
});

test('decodes milli-bitcoin amounts', () => {
  assert.equal(decodeInvoice(HASHED_LIST).msat, 2_000_000_000);
});

test('decodes a real LNbits invoice', () => {
  assert.deepEqual(decodeInvoice(LNBITS), {
    network: 'bc',
    msat: 1000,
    paymentHash: '848679507c87a4bb0d806c028f2c4ea3a724a46d0157995ba236923c158c7a36',
    timestamp: 1793820256,
    expiry: 3600,
  });
});

test('accepts upper case and a lightning: prefix', () => {
  assert.equal(decodeInvoice(`LIGHTNING:${COFFEE.toUpperCase()}`).msat, 250_000_000);
});

test('rejects a corrupted invoice (bad checksum)', () => {
  const corrupted = `${COFFEE.slice(0, 40)}${COFFEE[40] === 'q' ? 'p' : 'q'}${COFFEE.slice(41)}`;
  assert.throws(() => decodeInvoice(corrupted), /checksum/);
});

test('rejects strings that are not invoices', () => {
  for (const value of ['', 'hola', 'lnurl1dp68gurn8ghj7', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 42, null]) {
    assert.throws(() => decodeInvoice(value), Error, String(value));
  }
});

test('hrpAmountMsat applies every BOLT11 multiplier', () => {
  assert.equal(hrpAmountMsat('lnbc'), null);
  assert.equal(hrpAmountMsat('lnbc1'), 100_000_000_000);
  assert.equal(hrpAmountMsat('lnbc20m'), 2_000_000_000);
  assert.equal(hrpAmountMsat('lnbc2500u'), 250_000_000);
  assert.equal(hrpAmountMsat('lnbc10n'), 1000);
  assert.equal(hrpAmountMsat('lnbc10p'), 1);
  assert.equal(hrpAmountMsat('lntb10n'), 1000);
  assert.equal(hrpAmountMsat('lnbcrt10n'), 1000);
});

test('hrpAmountMsat rejects malformed amounts', () => {
  assert.throws(() => hrpAmountMsat('lnbc15p'), /amount/);
  assert.throws(() => hrpAmountMsat('lnbc0u'), /amount/);
  assert.throws(() => hrpAmountMsat('lnbc01u'), /amount/);
  assert.throws(() => hrpAmountMsat('lnxx10n'), /network/);
});

test('rejects mixed-case invoices (BIP-173) but accepts any case for the lightning: prefix', () => {
  const mixed = `${COFFEE.slice(0, 12).toUpperCase()}${COFFEE.slice(12)}`;
  assert.throws(() => decodeInvoice(mixed), /mixed-case/);
  assert.equal(decodeInvoice(`lightning:${COFFEE.toUpperCase()}`).msat, 250_000_000);
  assert.equal(decodeInvoice(`Lightning:${COFFEE}`).msat, 250_000_000);
});

test('rejects an invoice too short to hold a timestamp and a signature', () => {
  assert.throws(() => decodeInvoice(bech32('lnbc', new Array(50).fill(0))), /too short/);
});

test('rejects an invoice without a payment hash', () => {
  assert.throws(() => decodeInvoice(invoiceWith([])), /without payment hash/);
});

test('rejects tagged fields cut short, in their header or in their data', () => {
  assert.throws(() => decodeInvoice(invoiceWith([1, 1])), /truncated tagged field/);
  assert.throws(() => decodeInvoice(invoiceWith([1, 1, 20, ...new Array(10).fill(0)])), /truncated tagged field/);
});

test('rejects amounts beyond what JavaScript counts exactly', () => {
  assert.throws(() => hrpAmountMsat('lnbc1000000'), /amount too large/);
});
