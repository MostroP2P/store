// Sends the order to the store as a NIP-17 private message (gift wrap) from a throwaway key:
// the buyer needs no Nostr account and only the store's key can read it.

import { generateSecretKey, wrapEvent, decodeNip19 } from '../vendor/nostr-tools.js';
import { isRelayUrl } from './config.js';

/** NIP-17: the relays where a user wants to receive private messages. */
export const DM_RELAY_LIST_KIND = 10050;
export const MAX_RELAYS = 6;
/** Two copies, so the order doesn't depend on one relay (one is enough when only one is configured). */
const MIN_ACCEPTED = 2;
const MAX_LOOKUP_EVENTS = 20;
const RELAY_LOOKUP_MS = 3000;
const PUBLISH_TIMEOUT_MS = 8000;

export function npubToHex(npub) {
  let decoded = null;
  try {
    decoded = decodeNip19(npub);
  } catch {
    // reported below
  }
  if (decoded?.type !== 'npub') throw new Error(`invalid npub: ${npub}`);
  return decoded.data;
}

/** A new secret key per checkout: both order messages (created / paid) share it, so they are one conversation. */
export const createSenderKey = () => generateSecretKey();

/** Kind 1059 gift wrap holding a kind 14 message with an optional subject. */
export function wrapOrderMessage({ senderKey, recipientHex, message, subject }) {
  return wrapEvent(senderKey, { publicKey: recipientHex }, message, subject);
}

async function queryRelayList(pool, relays, recipientHex, maxWait) {
  try {
    const events = await pool.querySync(relays, { kinds: [DM_RELAY_LIST_KIND], authors: [recipientHex], limit: 1 }, { maxWait });
    // Relays may ignore "limit": keep a few well-formed events only
    return events.slice(0, MAX_LOOKUP_EVENTS)
      .filter((event) => Number.isFinite(event?.created_at) && Array.isArray(event.tags));
  } catch {
    return [];
  }
}

/** The store's inbox relays (kind 10050) first, then the configured ones; at most MAX_RELAYS. */
export async function findDmRelays({ pool, recipientHex, relays, maxWait = RELAY_LOOKUP_MS }) {
  const events = await queryRelayList(pool, relays, recipientHex, maxWait);
  const latest = events.reduce((best, event) => (!best || event.created_at > best.created_at ? event : best), null);
  const inbox = (latest?.tags ?? [])
    .filter((tag) => tag[0] === 'relay' && isRelayUrl(tag[1]))
    .map((tag) => tag[1]);
  return [...new Set([...inbox, ...relays])].slice(0, MAX_RELAYS);
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Publishes to every relay; resolves { accepted, rejected } or throws when fewer than two accepted. */
export async function publishEvent({ pool, relays, event, timeoutMs = PUBLISH_TIMEOUT_MS }) {
  const results = await Promise.allSettled(pool.publish(relays, event).map((p) => withTimeout(p, timeoutMs)));
  const accepted = relays.filter((_, i) => results[i].status === 'fulfilled');
  if (accepted.length < Math.min(MIN_ACCEPTED, relays.length)) {
    throw new Error(`Only ${accepted.length} relay(s) accepted the order.`);
  }
  return { accepted, rejected: relays.filter((_, i) => results[i].status === 'rejected') };
}

/** Looks up the store's inbox, wraps the message and publishes it. */
export async function sendPrivateMessage({ pool, npub, relays, message, subject, senderKey }) {
  const recipientHex = npubToHex(npub);
  const targets = await findDmRelays({ pool, recipientHex, relays });
  const event = wrapOrderMessage({ senderKey, recipientHex, message, subject });
  return publishEvent({ pool, relays: targets, event });
}
