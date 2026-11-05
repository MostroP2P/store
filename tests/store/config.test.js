import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoreConfig, isRelayUrl } from '../../src/store/config.js';
import { npubEncode } from '../../src/vendor/nostr-tools.js';

const NPUB = npubEncode('11'.repeat(32));
const COLOR_IDS = ['black', 'white', 'red'];

const validRaw = () => ({
  currency: 'ars',
  price: 30000,
  lnAddress: 'dev@pay.mostro.foundation',
  sizes: [{ id: 'S', width: 49, length: 69 }, { id: 'M', width: 51, length: 71 }, { id: 'L' }],
  defaultSize: 'M',
  defaultColor: 'white',
  nostr: { npub: NPUB, relays: ['wss://relay.mostro.network', 'wss://nos.lol'] },
  details: [{ title: 'Shipping', text: 'Anywhere in the country.' }],
});

const messages = (problems, level) => problems.filter((p) => p.level === level).map((p) => p.message);

test('normalizes a complete store section', () => {
  const { config, problems } = normalizeStoreConfig(validRaw(), COLOR_IDS);
  assert.deepEqual(problems, []);
  assert.deepEqual(config, {
    currency: 'ARS',
    price: 30000,
    lnAddress: 'dev@pay.mostro.foundation',
    sizes: [
      { id: 'S', width: 49, length: 69 },
      { id: 'M', width: 51, length: 71 },
      { id: 'L', width: null, length: null },
    ],
    defaultSize: 'M',
    defaultColor: 'white',
    nostr: { npub: NPUB, relays: ['wss://relay.mostro.network', 'wss://nos.lol'] },
    details: [{ title: 'Shipping', text: 'Anywhere in the country.' }],
  });
});

test('returns no config when the store section is missing', () => {
  const { config, problems } = normalizeStoreConfig(undefined, COLOR_IDS);
  assert.equal(config, null);
  assert.equal(messages(problems, 'error').length, 1);
});

test('returns no config for an invalid default price', () => {
  for (const price of [0, -5, '30000', Number.NaN]) {
    const { config, problems } = normalizeStoreConfig({ ...validRaw(), price }, COLOR_IDS);
    assert.equal(config, null, `price ${price}`);
    assert.match(messages(problems, 'error')[0], /price/);
  }
});

test('returns no config without any valid size', () => {
  const { config, problems } = normalizeStoreConfig({ ...validRaw(), sizes: [{ width: 3 }, 'XL'] }, COLOR_IDS);
  assert.equal(config, null);
  assert.equal(messages(problems, 'warning').length, 2);
  assert.match(messages(problems, 'error')[0], /sizes/);
});

test('drops repeated sizes and non-numeric measures with warnings', () => {
  const raw = { ...validRaw(), sizes: [{ id: 'S', width: 'ancho' }, { id: 'S' }, { id: 'M', length: -3 }] };
  const { config, problems } = normalizeStoreConfig(raw, COLOR_IDS);
  assert.deepEqual(config.sizes, [{ id: 'S', width: null, length: null }, { id: 'M', width: null, length: null }]);
  assert.equal(messages(problems, 'warning').length, 3);
});

test('falls back to the first size and color when the defaults are unknown', () => {
  const { config, problems } = normalizeStoreConfig({ ...validRaw(), defaultSize: 'XXXL', defaultColor: 'pink' }, COLOR_IDS);
  assert.equal(config.defaultSize, 'S');
  assert.equal(config.defaultColor, 'black');
  assert.equal(messages(problems, 'warning').length, 2);
});

test('uses defaults silently when optional fields are absent', () => {
  const { currency, defaultSize, defaultColor, details, ...rest } = validRaw();
  const { config, problems } = normalizeStoreConfig(rest, COLOR_IDS);
  assert.deepEqual(problems, []);
  assert.equal(config.currency, 'ARS');
  assert.equal(config.defaultSize, 'S');
  assert.equal(config.defaultColor, 'black');
  assert.deepEqual(config.details, []);
});

test('warns about an invalid currency code and uses ARS', () => {
  const { config, problems } = normalizeStoreConfig({ ...validRaw(), currency: 'pesos' }, COLOR_IDS);
  assert.equal(config.currency, 'ARS');
  assert.equal(messages(problems, 'warning').length, 1);
});

test('keeps the store but disables payments for an invalid LN address', () => {
  for (const lnAddress of ['dev', 'dev@', '@pay.mostro.foundation', 'dev@localhost', 42]) {
    const { config, problems } = normalizeStoreConfig({ ...validRaw(), lnAddress }, COLOR_IDS);
    assert.equal(config.lnAddress, null, `lnAddress ${lnAddress}`);
    assert.match(messages(problems, 'error')[0], /lnAddress/);
  }
});

test('lowercases the LN address', () => {
  const { config } = normalizeStoreConfig({ ...validRaw(), lnAddress: 'Dev@Pay.Mostro.Foundation' }, COLOR_IDS);
  assert.equal(config.lnAddress, 'dev@pay.mostro.foundation');
});

test('keeps the store but disables orders for an invalid npub', () => {
  for (const npub of ['npub1nope', `nsec${NPUB.slice(4)}`, undefined]) {
    const { config, problems } = normalizeStoreConfig({ ...validRaw(), nostr: { ...validRaw().nostr, npub } }, COLOR_IDS);
    assert.equal(config.nostr, null);
    assert.match(messages(problems, 'error')[0], /npub/);
  }
});

test('drops relays that are not wss:// URLs and requires at least one', () => {
  const raw = { ...validRaw(), nostr: { npub: NPUB, relays: ['https://nos.lol', 'wss://nos.lol', 'wss://nos.lol', 'ws://insecure.example'] } };
  const { config, problems } = normalizeStoreConfig(raw, COLOR_IDS);
  assert.deepEqual(config.nostr.relays, ['wss://nos.lol']);
  assert.equal(messages(problems, 'warning').length, 3);

  const none = normalizeStoreConfig({ ...validRaw(), nostr: { npub: NPUB, relays: [] } }, COLOR_IDS);
  assert.equal(none.config.nostr, null);
  assert.match(messages(none.problems, 'error')[0], /relays/);
});

test('ignores malformed detail entries with a warning', () => {
  const raw = { ...validRaw(), details: [{ title: 'Pago', text: 'Lightning' }, { title: '' }, 'texto'] };
  const { config, problems } = normalizeStoreConfig(raw, COLOR_IDS);
  assert.deepEqual(config.details, [{ title: 'Pago', text: 'Lightning' }]);
  assert.equal(messages(problems, 'warning').length, 2);
});

test('isRelayUrl accepts public wss:// relays only', () => {
  assert.equal(isRelayUrl('wss://relay.mostro.network'), true);
  assert.equal(isRelayUrl('wss://nos.lol/'), true);
  for (const url of ['ws://nos.lol', 'https://nos.lol', 'wss://localhost', 'wss://relay.localhost', 'wss://127.0.0.1',
    'wss://192.168.1.10:7777', 'wss://[::1]', 'nope', 42]) {
    assert.equal(isRelayUrl(url), false, String(url));
  }
});

test('rejects an npub whose checksum is wrong (a typo would lose orders)', () => {
  const last = NPUB.at(-1);
  const typo = `${NPUB.slice(0, -1)}${last === 'q' ? 'p' : 'q'}`;
  const { config, problems } = normalizeStoreConfig({ ...validRaw(), nostr: { ...validRaw().nostr, npub: typo } }, COLOR_IDS);
  assert.equal(config.nostr, null);
  assert.match(messages(problems, 'error')[0], /npub/);
});
