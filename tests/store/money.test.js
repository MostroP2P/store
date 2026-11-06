import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moneyFormat, satsFor, parseYadioRate } from '../../src/store/money.js';

const es = moneyFormat('es', 'ARS');
const en = moneyFormat('en', 'ARS');

test('Spanish writes pesos the Argentine way', () => {
  assert.equal(es.price(30000), '$30.000');
  assert.equal(es.price(1234567), '$1.234.567');
  assert.equal(es.price(0), '$0');
  assert.equal(es.priceWithCurrency(30000), '$30.000 ARS');
});

test('English names the currency, so pesos are not read as dollars', () => {
  assert.equal(en.price(30000), 'ARS\u00a030,000');
  assert.equal(en.priceWithCurrency(1234567), 'ARS\u00a01,234,567');
  assert.equal(moneyFormat('en', 'USD').price(25), 'USD\u00a025');
});

test('French and Italian write the currency code after the amount, Portuguese before it, as each language does', () => {
  const fr = moneyFormat('fr', 'ARS');
  const it = moneyFormat('it', 'ARS');
  const pt = moneyFormat('pt', 'ARS');
  assert.equal(fr.price(30000), '30\u202f000\u00a0ARS');
  assert.equal(fr.priceWithCurrency(1234567), '1\u202f234\u202f567\u00a0ARS');
  assert.equal(it.price(30000), '30.000\u00a0ARS');
  assert.equal(it.priceWithCurrency(1234567), '1.234.567\u00a0ARS');
  assert.equal(pt.price(30000), 'ARS\u00a030.000');
  assert.equal(pt.priceWithCurrency(1234567), 'ARS\u00a01.234.567');
  assert.equal(pt.sats(22358), '22.358 sats');
});

test('numbers group thousands the local way, without decimals', () => {
  assert.equal(es.number(134185376.71), '134.185.377');
  assert.equal(en.number(134185376.71), '134,185,377');
});

test('sats use the singular for one sat', () => {
  assert.equal(es.sats(22358), '22.358 sats');
  assert.equal(en.sats(22358), '22,358 sats');
  assert.equal(es.sats(1), '1 sat');
});

test('an unknown language formats like English', () => {
  assert.equal(moneyFormat('de', 'ARS').price(30000), en.price(30000));
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
  assert.throws(() => parseYadioRate(null, 'ARS'), /rate/);
  assert.throws(() => parseYadioRate({ BTC: {} }, 'ARS'), /rate/);
  assert.throws(() => parseYadioRate({ BTC: { ARS: 0 } }, 'ARS'), /rate/);
  assert.throws(() => parseYadioRate({ BTC: { ARS: '1' } }, 'ARS'), /rate/);
});
