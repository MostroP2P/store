import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, formatSats, formatNumber, satsFor, parseYadioRate } from '../../src/store/money.js';

test('formatPrice writes pesos the Argentine way', () => {
  assert.equal(formatPrice(30000), '$30.000');
  assert.equal(formatPrice(1234567), '$1.234.567');
  assert.equal(formatPrice(0), '$0');
});

test('formatNumber groups thousands with dots', () => {
  assert.equal(formatNumber(134185376.71), '134.185.377');
});

test('formatSats uses the singular for one sat', () => {
  assert.equal(formatSats(22358), '22.358 sats');
  assert.equal(formatSats(1), '1 sat');
});

test('satsFor converts a fiat amount and rounds up to a whole sat', () => {
  assert.equal(satsFor(30000, 134185376.71), 22358);
  assert.equal(satsFor(90000, 134185376.71), 67072);
  assert.equal(satsFor(100, 100000000), 100);
});

test('satsFor rejects amounts or rates that are not positive numbers', () => {
  assert.throws(() => satsFor(30000, 0), /rate/);
  assert.throws(() => satsFor(30000, Number.NaN), /rate/);
  assert.throws(() => satsFor(-1, 1000), /amount/);
});

test('parseYadioRate reads the BTC price in the store currency', () => {
  const json = { BTC: { ARS: 134185376.71, USD: 80261.47 }, base: 'BTC', timestamp: 1793820007356 };
  assert.equal(parseYadioRate(json, 'ARS'), 134185376.71);
  assert.equal(parseYadioRate(json, 'USD'), 80261.47);
});

test('parseYadioRate fails on unexpected answers', () => {
  assert.throws(() => parseYadioRate(null, 'ARS'), /cotización/);
  assert.throws(() => parseYadioRate({ BTC: {} }, 'ARS'), /cotización/);
  assert.throws(() => parseYadioRate({ BTC: { ARS: 0 } }, 'ARS'), /cotización/);
  assert.throws(() => parseYadioRate({ BTC: { ARS: '1' } }, 'ARS'), /cotización/);
});
