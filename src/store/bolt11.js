// BOLT11 invoice decoding (pure), limited to what the store checks: amount, payment hash and expiry.
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md — the signature is not verified.

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONST = 1;
const CHECKSUM_WORDS = 6;
const SIGNATURE_WORDS = 104;
const TIMESTAMP_WORDS = 7;
const TAG_PAYMENT_HASH = 1;
const TAG_EXPIRY = 6;
const PAYMENT_HASH_WORDS = 52;
const DEFAULT_EXPIRY_SECONDS = 3600;

// "ln" + network + optional amount + optional multiplier
const HRP = /^ln(bcrt|bc|tbs|tb|sb)(\d*)([munp]?)$/;
const MSAT_PER_BTC = 100_000_000_000n;
const DIVISOR = { '': 1n, m: 1_000n, u: 1_000_000n, n: 1_000_000_000n, p: 1_000_000_000_000n };

function polymod(values) {
  return values.reduce((chk, value) => {
    const top = chk >>> 25;
    const next = ((chk & 0x1ffffff) << 5) ^ value;
    return GENERATOR.reduce((acc, gen, i) => (((top >>> i) & 1) ? acc ^ gen : acc), next);
  }, 1);
}

const hrpExpand = (hrp) => [
  ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
];

/** Splits and checks a bech32 string; returns the human readable part and the data words (no checksum). */
function bech32Words(text) {
  const separator = text.lastIndexOf('1');
  if (separator < 1 || text.length - separator - 1 < CHECKSUM_WORDS) throw new Error('not a bech32 string');
  const hrp = text.slice(0, separator);
  const words = [...text.slice(separator + 1)].map((char) => {
    const word = CHARSET.indexOf(char);
    if (word === -1) throw new Error(`invalid character "${char}"`);
    return word;
  });
  if (polymod([...hrpExpand(hrp), ...words]) !== BECH32_CONST) throw new Error('bad checksum');
  return { hrp, words: words.slice(0, -CHECKSUM_WORDS) };
}

const wordsToInt = (words) => words.reduce((value, word) => value * 32 + word, 0);

/** 5-bit words → hex bytes, dropping the padding bits at the end. */
function wordsToHex(words) {
  const bits = words.map((w) => w.toString(2).padStart(5, '0')).join('');
  const bytes = bits.slice(0, bits.length - (bits.length % 8)).match(/.{8}/g) ?? [];
  return bytes.map((byte) => parseInt(byte, 2).toString(16).padStart(2, '0')).join('');
}

/** Tagged fields → Map(tag → data words), keeping the first valid one of each tag. */
function readTags(words) {
  const tags = new Map();
  let i = 0;
  while (i < words.length) {
    if (i + 3 > words.length) throw new Error('truncated tagged field');
    const tag = words[i];
    const length = words[i + 1] * 32 + words[i + 2];
    const data = words.slice(i + 3, i + 3 + length);
    if (data.length !== length) throw new Error('truncated tagged field');
    // BOLT11: readers must skip a "p" field whose length is not 52
    const usable = tag !== TAG_PAYMENT_HASH || length === PAYMENT_HASH_WORDS;
    if (usable && !tags.has(tag)) tags.set(tag, data);
    i += 3 + length;
  }
  return tags;
}

/** Amount in msat written in the human readable part ("lnbc2500u" → 250000000), or null for "any amount". */
export function hrpAmountMsat(hrp) {
  const match = HRP.exec(hrp);
  if (!match) throw new Error(`unknown network in "${hrp}"`);
  const [, , digits, multiplier] = match;
  if (digits === '') return null;
  if (digits.startsWith('0')) throw new Error(`invalid amount "${digits}${multiplier}"`);
  const msat = BigInt(digits) * MSAT_PER_BTC;
  const divisor = DIVISOR[multiplier];
  if (msat % divisor !== 0n) throw new Error(`invalid amount "${digits}${multiplier}" (sub-millisatoshi)`);
  const value = msat / divisor;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`amount too large "${digits}${multiplier}"`);
  return Number(value);
}

/**
 * Decodes a BOLT11 invoice (upper or lower case, with or without "lightning:").
 * Returns { network, msat (null = any amount), paymentHash (hex), timestamp (s), expiry (s) }; throws if invalid.
 */
export function decodeInvoice(pr) {
  if (typeof pr !== 'string') throw new Error('the invoice must be a string');
  const text = pr.trim().toLowerCase().replace(/^lightning:/, '');
  const { hrp, words } = bech32Words(text);
  const msat = hrpAmountMsat(hrp);
  if (words.length < TIMESTAMP_WORDS + SIGNATURE_WORDS) throw new Error('invoice too short');

  const tags = readTags(words.slice(TIMESTAMP_WORDS, -SIGNATURE_WORDS));
  const hash = tags.get(TAG_PAYMENT_HASH);
  if (!hash) throw new Error('invoice without payment hash');
  return {
    network: HRP.exec(hrp)[1],
    msat,
    paymentHash: wordsToHex(hash),
    timestamp: wordsToInt(words.slice(0, TIMESTAMP_WORDS)),
    expiry: tags.has(TAG_EXPIRY) ? wordsToInt(tags.get(TAG_EXPIRY)) : DEFAULT_EXPIRY_SECONDS,
  };
}
