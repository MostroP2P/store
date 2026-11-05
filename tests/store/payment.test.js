import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForPayment, isPaidNow, UNREACHABLE_AFTER } from '../../src/store/payment.js';

/** Fake clock: sleep() only moves time forward, so the tests run instantly. */
const fakeClock = (start = 1_000_000) => {
  let now = start;
  return { now: () => now, sleep: async (ms) => { now += ms; } };
};

const answers = (...list) => {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    const next = list.length > 1 ? list.shift() : list[0];
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetchJson, calls };
};

test('resolves "paid" once the status endpoint reports the payment', async () => {
  const clock = fakeClock();
  const { fetchJson, calls } = answers({ paid: false }, { paid: false }, { paid: true });
  const result = await waitForPayment({ url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 60_000 });
  assert.equal(result, 'paid');
  assert.equal(calls.length, 3);
});

test('keeps polling through network errors', async () => {
  const clock = fakeClock();
  const { fetchJson } = answers(new Error('offline'), new Error('HTTP 502'), { settled: true });
  const result = await waitForPayment({ url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 60_000 });
  assert.equal(result, 'paid');
});

test('resolves "expired" when the invoice expires unpaid', async () => {
  const clock = fakeClock();
  const { fetchJson, calls } = answers({ paid: false });
  const result = await waitForPayment({ url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 10_000 });
  assert.equal(result, 'expired');
  // checks at 3, 6, 9 s and one last time after expiry (12 s) for a payment made at the very end
  assert.equal(calls.length, 4);
});

test('resolves "cancelled" as soon as the caller cancels', async () => {
  const clock = fakeClock();
  let cancelled = false;
  const fetchJson = async () => { cancelled = true; return { paid: false }; };
  const result = await waitForPayment({
    url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 60_000, isCancelled: () => cancelled,
  });
  assert.equal(result, 'cancelled');
});

test('does not report "paid" for a payment confirmed after cancelling', async () => {
  const clock = fakeClock();
  let cancelled = false;
  const fetchJson = async () => { cancelled = true; return { paid: true }; };
  const result = await waitForPayment({
    url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 60_000, isCancelled: () => cancelled,
  });
  assert.equal(result, 'cancelled');
});

test('formatCountdown shows minutes and seconds, never negative', async () => {
  const { formatCountdown } = await import('../../src/store/payment.js');
  assert.equal(formatCountdown(3_599_000), '59:59');
  assert.equal(formatCountdown(61_500), '1:02');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(-5000), '0:00');
});

test('preimageMatches checks that sha256(preimage) is the payment hash', async () => {
  const { preimageMatches } = await import('../../src/store/payment.js');
  // sha256 of 32 zero bytes
  const zeros = '00'.repeat(32);
  const hash = '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925';
  assert.equal(await preimageMatches(zeros, hash), true);
  assert.equal(await preimageMatches(zeros, hash.toUpperCase()), true);
  assert.equal(await preimageMatches('11'.repeat(32), hash), false);
  assert.equal(await preimageMatches('not hex', hash), false);
  assert.equal(await preimageMatches(undefined, hash), false);
});

test('resolves "unconfirmed" when the status endpoint never answered', async () => {
  const clock = fakeClock();
  const { fetchJson } = answers(new Error('HTTP 404'));
  let warned = 0;
  const result = await waitForPayment({
    url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 20_000, onUnreachable: () => { warned += 1; },
  });
  assert.equal(result, 'unconfirmed');
  assert.equal(warned, 1, 'warns once');
});

test('warns about an unreachable endpoint only after several failed checks', async () => {
  const clock = fakeClock();
  const failures = Array.from({ length: UNREACHABLE_AFTER - 1 }, () => new Error('HTTP 404'));
  const { fetchJson } = answers(...failures, { paid: false }, new Error('HTTP 502'), { paid: true });
  let warned = 0;
  const result = await waitForPayment({
    url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 60_000, onUnreachable: () => { warned += 1; },
  });
  assert.equal(result, 'paid');
  assert.equal(warned, 0);
});

test('isPaidNow checks the status once and never throws', async () => {
  assert.equal(await isPaidNow('https://pay/x', async () => ({ paid: true })), true);
  assert.equal(await isPaidNow('https://pay/x', async () => ({ paid: false })), false);
  assert.equal(await isPaidNow('https://pay/x', async () => { throw new Error('offline'); }), false);
});

test('a status endpoint that stops answering still offers the manual fallback and ends "unconfirmed"', async () => {
  const clock = fakeClock();
  const { fetchJson } = answers({ paid: false }, new Error('HTTP 502'));
  let warned = 0;
  const result = await waitForPayment({
    url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 30_000, onUnreachable: () => { warned += 1; },
  });
  assert.equal(result, 'unconfirmed');
  assert.equal(warned, 1);
});

test('ends "unconfirmed" when the last check after expiry fails', async () => {
  const clock = fakeClock();
  const { fetchJson } = answers({ paid: false }, { paid: false }, new Error('offline'));
  const result = await waitForPayment({ url: 'https://pay/x', fetchJson, ...clock, intervalMs: 3000, expiresAt: clock.now() + 8_000 });
  assert.equal(result, 'unconfirmed');
});

test('waits with real timers and a silent fallback when none is given', async () => {
  const { fetchJson } = answers(new Error('offline'));
  const result = await waitForPayment({ url: 'u', fetchJson, expiresAt: Date.now() + 40, intervalMs: 5 });
  assert.equal(result, 'unconfirmed');
});

test('stops when the caller cancels while a check is in flight', async () => {
  const clock = fakeClock();
  let cancelled = false;
  const fetchJson = async () => {
    cancelled = true;
    return { paid: true };
  };
  const result = await waitForPayment({
    url: 'u', fetchJson, expiresAt: clock.now() + 60_000, now: clock.now, sleep: clock.sleep, isCancelled: () => cancelled,
  });
  assert.equal(result, 'cancelled');
});

test('a cancel during the wait stops before checking the status again', async () => {
  const clock = fakeClock();
  const { fetchJson, calls } = answers({ paid: false });
  const result = await waitForPayment({
    url: 'u', fetchJson, expiresAt: clock.now() + 60_000, now: clock.now, sleep: clock.sleep, isCancelled: () => true,
  });
  assert.equal(result, 'cancelled');
  assert.equal(calls.length, 0);
});
