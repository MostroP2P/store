// Test-only builders: bech32 strings with a valid checksum (BIP-173) and BOLT11 invoices with the fields
// the store reads (amount, payment hash, timestamp, expiry). The signature is zeros: the store never checks it.

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const TAG_PAYMENT_HASH = 1;
const TAG_EXPIRY = 6;
const TIMESTAMP_WORDS = 7;
export const SIGNATURE = Object.freeze(new Array(104).fill(0));

const polymod = (values) => values.reduce((chk, value) => {
  const top = chk >>> 25;
  const next = ((chk & 0x1ffffff) << 5) ^ value;
  return GENERATOR.reduce((acc, gen, i) => (((top >>> i) & 1) ? acc ^ gen : acc), next);
}, 1);

const hrpExpand = (hrp) => [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];

/** `hrp` + "1" + the 5-bit `words` + a valid checksum. */
export function bech32(hrp, words) {
  const mod = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = [0, 1, 2, 3, 4, 5].map((i) => (mod >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...words, ...checksum].map((w) => CHARSET[w]).join('')}`;
}

/** Bytes → 5-bit words, the last one padded with zeros. */
export function toWords(bytes) {
  const bits = [...bytes].map((byte) => byte.toString(2).padStart(8, '0')).join('');
  const padded = bits.padEnd(Math.ceil(bits.length / 5) * 5, '0');
  return Array.from({ length: padded.length / 5 }, (_, i) => parseInt(padded.slice(i * 5, i * 5 + 5), 2));
}

/** A non-negative integer as `length` big-endian 5-bit words. */
const intWords = (value, length) => Array.from({ length }, (_, i) => Math.floor(value / 32 ** (length - 1 - i)) % 32);
const wordsFor = (value) => Math.max(1, Math.ceil(Math.log2(value + 1) / 5));

/** A tagged field: tag, 10-bit length, data. */
const tagged = (tag, data) => [tag, Math.floor(data.length / 32), data.length % 32, ...data];

/**
 * A mainnet invoice for `sats`, with `paymentHash` (64 hex), `timestamp` (seconds) and `expiry` (seconds).
 * The amount is written in nano-bitcoin ("lnbc300000n" = 30,000 sats), which every whole sat fits.
 */
export function buildInvoice({ sats, paymentHash, timestamp, expiry }) {
  const hash = toWords(Buffer.from(paymentHash, 'hex'));
  const words = [
    ...intWords(timestamp, TIMESTAMP_WORDS),
    ...tagged(TAG_PAYMENT_HASH, hash),
    ...tagged(TAG_EXPIRY, intWords(expiry, wordsFor(expiry))),
    ...SIGNATURE,
  ];
  return bech32(`lnbc${sats * 10}n`, words);
}
