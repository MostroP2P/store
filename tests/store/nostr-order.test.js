import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSecretKey, getPublicKey, npubEncode, unwrapEvent } from '../../src/vendor/nostr-tools.js';
import {
  npubToHex,
  createSenderKey,
  wrapOrderMessage,
  findDmRelays,
  publishEvent,
  sendPrivateMessage,
  DM_RELAY_LIST_KIND,
  MAX_RELAYS,
} from '../../src/store/nostr-order.js';

const storeSecret = generateSecretKey();
const STORE_HEX = getPublicKey(storeSecret);
const STORE_NPUB = npubEncode(STORE_HEX);
const FALLBACK = ['wss://relay.mostro.network', 'wss://nos.lol'];

test('npubToHex decodes an npub and rejects anything else', () => {
  assert.equal(npubToHex(STORE_NPUB), STORE_HEX);
  assert.throws(() => npubToHex('npub1nope'), /npub/);
  assert.throws(() => npubToHex(`nsec${STORE_NPUB.slice(4)}`), /npub/);
});

test('wrapOrderMessage builds a NIP-17 gift wrap only the store can open', () => {
  const sender = generateSecretKey();
  const event = wrapOrderMessage({ senderKey: sender, recipientHex: STORE_HEX, message: 'Pedido MS-1', subject: 'Pedido MS-1' });
  assert.equal(event.kind, 1059);
  assert.deepEqual(event.tags.find((t) => t[0] === 'p'), ['p', STORE_HEX]);
  assert.notEqual(event.pubkey, getPublicKey(sender), 'the wrap must not reveal the sender key');

  const rumor = unwrapEvent(event, storeSecret);
  assert.equal(rumor.kind, 14);
  assert.equal(rumor.content, 'Pedido MS-1');
  assert.equal(rumor.pubkey, getPublicKey(sender));
  assert.deepEqual(rumor.tags.find((t) => t[0] === 'subject'), ['subject', 'Pedido MS-1']);
});

const fakePool = ({ events = [], queryError = null, publish = () => [] } = {}) => ({
  queries: [],
  published: [],
  async querySync(relays, filter) {
    this.queries.push({ relays, filter });
    if (queryError) throw queryError;
    return events;
  },
  publish(relays, event) {
    this.published.push({ relays, event });
    return publish(relays, event);
  },
});

const relayList = (createdAt, relays) => ({
  kind: DM_RELAY_LIST_KIND, created_at: createdAt, tags: relays.map((r) => ['relay', r]),
});

test('findDmRelays adds the store inbox relays (kind 10050) to the configured ones', async () => {
  const pool = fakePool({
    events: [
      relayList(100, ['wss://old.example']),
      relayList(200, ['wss://inbox.example', 'wss://nos.lol', 'https://not-a-relay.example']),
    ],
  });
  const relays = await findDmRelays({ pool, recipientHex: STORE_HEX, relays: FALLBACK, maxWait: 10 });
  assert.deepEqual(relays, ['wss://inbox.example', 'wss://nos.lol', 'wss://relay.mostro.network']);
  assert.deepEqual(pool.queries[0].filter, { kinds: [DM_RELAY_LIST_KIND], authors: [STORE_HEX], limit: 1 });
});

test('findDmRelays falls back to the configured relays when the lookup fails', async () => {
  assert.deepEqual(await findDmRelays({ pool: fakePool(), recipientHex: STORE_HEX, relays: FALLBACK, maxWait: 10 }), FALLBACK);
  const failing = fakePool({ queryError: new Error('timeout') });
  assert.deepEqual(await findDmRelays({ pool: failing, recipientHex: STORE_HEX, relays: FALLBACK, maxWait: 10 }), FALLBACK);
});

test('findDmRelays ignores malformed relay lists', async () => {
  const pool = fakePool({ events: [{ kind: DM_RELAY_LIST_KIND, created_at: 5, tags: 'nope' }, null] });
  assert.deepEqual(await findDmRelays({ pool, recipientHex: STORE_HEX, relays: FALLBACK, maxWait: 10 }), FALLBACK);
});

test('findDmRelays caps the number of relays', async () => {
  const many = Array.from({ length: 10 }, (_, i) => `wss://r${i}.example`);
  const pool = fakePool({ events: [relayList(1, many)] });
  const relays = await findDmRelays({ pool, recipientHex: STORE_HEX, relays: FALLBACK, maxWait: 10 });
  assert.equal(relays.length, MAX_RELAYS);
});

const THREE = [...FALLBACK, 'wss://relay.damus.io'];
const rejecting = (...names) => (relays) => relays.map((r) => (names.some((n) => r.includes(n))
  ? Promise.reject(new Error('blocked'))
  : Promise.resolve('ok')));

test('publishEvent reports which relays accepted the event', async () => {
  const pool = fakePool({ publish: rejecting('nos.lol') });
  const result = await publishEvent({ pool, relays: THREE, event: { id: '1' }, timeoutMs: 50 });
  assert.deepEqual(result, { accepted: ['wss://relay.mostro.network', 'wss://relay.damus.io'], rejected: ['wss://nos.lol'] });
});

test('publishEvent needs two relays to accept, so the store does not depend on a single one', async () => {
  const pool = fakePool({ publish: rejecting('nos.lol', 'damus') });
  await assert.rejects(publishEvent({ pool, relays: THREE, event: { id: '1' }, timeoutMs: 50 }), /relay/);
  const single = fakePool({ publish: rejecting() });
  const result = await publishEvent({ pool: single, relays: ['wss://only.example'], event: { id: '1' }, timeoutMs: 50 });
  assert.deepEqual(result.accepted, ['wss://only.example']);
});

test('publishEvent fails when no relay accepts the event in time', async () => {
  const pool = fakePool({ publish: (relays) => relays.map(() => new Promise(() => {})) });
  await assert.rejects(publishEvent({ pool, relays: FALLBACK, event: { id: '1' }, timeoutMs: 20 }), /relay/);
});

test('sendPrivateMessage wraps the message for the npub and publishes it to the inbox relays', async () => {
  const pool = fakePool({
    events: [relayList(1, ['wss://inbox.example'])],
    publish: (relays) => relays.map(() => Promise.resolve('ok')),
  });
  const senderKey = generateSecretKey();
  const result = await sendPrivateMessage({
    pool, npub: STORE_NPUB, relays: FALLBACK, message: 'Pedido MS-2', subject: 'Pedido MS-2', senderKey,
  });
  assert.deepEqual(result.accepted, ['wss://inbox.example', ...FALLBACK]);
  const { event } = pool.published[0];
  assert.equal(unwrapEvent(event, storeSecret).content, 'Pedido MS-2');
});

test('sendPrivateMessage refuses an invalid npub before touching the network', async () => {
  const pool = fakePool();
  await assert.rejects(
    sendPrivateMessage({ pool, npub: 'npub1nope', relays: FALLBACK, message: 'x', subject: 'x', senderKey: generateSecretKey() }),
    /npub/,
  );
  assert.equal(pool.queries.length, 0);
});

test('createSenderKey makes a new 32-byte key for every checkout', () => {
  const [a, b] = [createSenderKey(), createSenderKey()];
  assert.equal(a.length, 32);
  assert.notDeepEqual(a, b);
});

test('findDmRelays uses the newest relay list, whatever order the relays return them in', async () => {
  const pool = fakePool({ events: [relayList(9, ['wss://new.example']), relayList(1, ['wss://old.example'])] });
  const relays = await findDmRelays({ pool, recipientHex: STORE_HEX, relays: FALLBACK, maxWait: 10 });
  assert.ok(relays.includes('wss://new.example'));
  assert.ok(!relays.includes('wss://old.example'));
});
