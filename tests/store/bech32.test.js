import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBech32 } from '../../src/store/bech32.js';

// Test vectors from BIP-173
const CHARSET_VECTOR = 'abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw';
const STORE_NPUB = 'npub1st0re749d5d02mwnf2c0vcj566p85y5wpnaz65llr8wt49cyp6kqe44n9m';

test('decodes the human-readable part and the data words, without the checksum', () => {
  const { hrp, words } = decodeBech32(CHARSET_VECTOR);
  assert.equal(hrp, 'abcdef');
  assert.deepEqual(words, Array.from({ length: 32 }, (_, i) => i));
});

test('accepts the valid BIP-173 vectors, in lower or upper case', () => {
  ['A12UEL5L', 'a12uel5l', 'split1checkupstagehandshakeupstreamerranterredcaperred2y9e3w'].forEach((value) => {
    assert.doesNotThrow(() => decodeBech32(value), value);
  });
  assert.equal(decodeBech32('A12UEL5L').hrp, 'a');
});

test('an npub carries 52 five-bit words: a 32-byte public key', () => {
  const { hrp, words } = decodeBech32(STORE_NPUB);
  assert.equal(hrp, 'npub');
  assert.equal(words.length, 52);
});

test('rejects mixed case', () => {
  assert.throws(() => decodeBech32('A12uEL5L'), /mixed-case/);
});

test('rejects a wrong checksum, even after a single changed character', () => {
  assert.throws(() => decodeBech32(`${STORE_NPUB.slice(0, -1)}q`), /checksum/);
  assert.throws(() => decodeBech32('A1G7SGD8'), /checksum/);
});

test('rejects characters outside the bech32 alphabet', () => {
  assert.throws(() => decodeBech32('x1b4n0q5v'), /invalid character "b"/);
});

test('rejects strings without a separator, a human-readable part or a full checksum', () => {
  ['pzry9x0s0muk', '1pzry9x0s0muk', '10a06t8', 'li1dgmt3'].forEach((value) => {
    assert.throws(() => decodeBech32(value), /not a bech32 string/, value);
  });
});

test('rejects anything that is not a string', () => {
  [null, undefined, 42, ['npub1']].forEach((value) => {
    assert.throws(() => decodeBech32(value), /not a bech32 string/);
  });
});
