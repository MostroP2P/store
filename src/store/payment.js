// Waits for a Lightning payment by polling a status URL. Clock, sleep and fetch are injected for tests.

import { isSettled } from './lnurl.js';

export const POLL_INTERVAL_MS = 3000;
/** Failed checks in a row before telling the buyer we can't confirm the payment here. */
export const UNREACHABLE_AFTER = 3;

const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const HEX_32_BYTES = /^[0-9a-f]{64}$/i;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Time left on an invoice: 61500 → "1:02". */
export function formatCountdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / SECOND_MS));
  const rest = String(seconds % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${rest}`;
}

/** Proof of payment from a wallet (WebLN): sha256(preimage) must equal the invoice payment hash. */
export async function preimageMatches(preimage, paymentHash) {
  if (typeof preimage !== 'string' || !HEX_32_BYTES.test(preimage)) return false;
  const bytes = Uint8Array.from(preimage.match(/../g), (byte) => parseInt(byte, 16));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex === String(paymentHash).toLowerCase();
}

/** One status check; any failure counts as "not paid (yet)". */
export const isPaidNow = (url, fetchJson) => fetchJson(url).then(isSettled, () => false);

/**
 * Polls `url` every `intervalMs` until the invoice is paid, expires or the caller cancels.
 * Network errors don't stop it: a failed check doesn't mean the invoice is gone.
 * onUnreachable() runs once, the first time UNREACHABLE_AFTER checks in a row fail (even after earlier answers).
 * Resolves 'paid' | 'expired' | 'cancelled', or 'unconfirmed' when the last check failed: the invoice may have
 * been paid and the page just couldn't see it, so it must not be called "expired".
 */
export async function waitForPayment({
  url,
  fetchJson,
  expiresAt,
  intervalMs = POLL_INTERVAL_MS,
  now = Date.now,
  sleep = wait,
  isCancelled = () => false,
  onUnreachable = () => {},
}) {
  let failures = 0;
  let warned = false;
  for (;;) {
    await sleep(intervalMs);
    if (isCancelled()) return 'cancelled';
    const status = await fetchJson(url).catch(() => null);
    if (isCancelled()) return 'cancelled';
    if (isSettled(status)) return 'paid';
    failures = status === null ? failures + 1 : 0;
    if (!warned && failures >= UNREACHABLE_AFTER) {
      warned = true;
      onUnreachable();
    }
    // Checked after the request: one last look past expiry catches a payment made at the very end
    if (now() >= expiresAt) return failures > 0 ? 'unconfirmed' : 'expired';
  }
}
