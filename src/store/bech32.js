// Bech32 decoding (BIP-173), shared by BOLT11 invoices and Nostr npubs (pure).

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONST = 1;
const CHECKSUM_WORDS = 6;

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

/**
 * Splits and checks a bech32 string. Mixed case is invalid (BIP-173); all upper case is accepted.
 * Returns { hrp, words } with the 5-bit data words (checksum removed); throws if invalid.
 */
export function decodeBech32(value) {
  if (typeof value !== 'string') throw new Error('not a bech32 string');
  if (value !== value.toLowerCase() && value !== value.toUpperCase()) throw new Error('mixed-case bech32 string');
  const text = value.toLowerCase();
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
