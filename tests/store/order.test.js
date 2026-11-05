import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newOrderId, orderComment, orderSubject, orderMessage, paidMessage, claimedMessage, ORDER_ID_PATTERN,
} from '../../src/store/order.js';

const ORDER = {
  id: 'MS-7K3F2Q',
  lines: [
    { name: 'Love at first sat', colorName: 'Negro', size: 'L', quantity: 2, total: 60000 },
    { name: 'Hold my invoice', colorName: 'Azul', size: 'M', quantity: 1, total: 30000 },
  ],
  subtotal: 90000,
  currency: 'ARS',
  lang: 'en',
  sats: 67072,
  rate: 134185376.71,
  paymentHash: 'ab'.repeat(32),
  customer: {
    street: 'Av. Siempreviva', number: '742', floor: '3', apartment: 'B',
    postalCode: '1234', city: 'Springfield', province: 'Buenos Aires',
    notes: 'Tocar timbre dos veces',
    firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', phone: '11 2233 4455',
  },
};

test('newOrderId uses MS- and six unambiguous characters', () => {
  // Crockford base32: each byte keeps its 5 low bits (0 → "0", 31 → "Z", 32 → "0", 255 → "Z")
  const id = newOrderId(() => Uint8Array.from([0, 1, 2, 31, 32, 255]));
  assert.equal(id, 'MS-012Z0Z');
  assert.match(id, ORDER_ID_PATTERN);
});

test('newOrderId uses the browser random source by default', () => {
  const ids = new Set(Array.from({ length: 50 }, () => newOrderId()));
  ids.forEach((id) => assert.match(id, ORDER_ID_PATTERN));
  assert.ok(ids.size > 45);
});

test('orderComment fits in an LN address comment', () => {
  const comment = orderComment('MS-7K3F2Q');
  assert.equal(comment, 'Pedido MS-7K3F2Q · store.mostro.network');
  assert.ok(comment.length <= 255);
});

test('orderMessage lists items, totals, payment and delivery data', () => {
  const message = orderMessage(ORDER);
  [
    'Pedido MS-7K3F2Q',
    'Pendiente de pago',
    '2 × Love at first sat — Negro, talle L — $60.000',
    '1 × Hold my invoice — Azul, talle M — $30.000',
    'Total: $90.000 ARS = 67.072 sats',
    '1 BTC = $134.185.377 ARS (Yadio)',
    `Payment hash: ${'ab'.repeat(32)}`,
    'Ana Pérez',
    'Av. Siempreviva 742, piso 3, depto B',
    'CP 1234, Springfield, Buenos Aires',
    'Email: ana@example.com',
    'Teléfono: 11 2233 4455',
    'Instrucciones: Tocar timbre dos veces',
  ].forEach((part) => assert.ok(message.includes(part), `missing "${part}"\n${message}`));
});

test('orderMessage stays in Spanish and says which language to answer the buyer in', () => {
  assert.ok(orderMessage(ORDER).includes('Idioma: inglés'));
  assert.ok(orderMessage({ ...ORDER, lang: 'es' }).includes('Idioma: español'));
  assert.ok(!orderMessage({ ...ORDER, lang: undefined }).includes('Idioma'));
  assert.ok(!orderMessage({ ...ORDER, lang: 'xx\n✅' }).includes('Idioma'));
});

test('orderSubject is the order number, in Spanish like every message to the store', () => {
  assert.equal(orderSubject('MS-7K3F2Q'), 'Pedido MS-7K3F2Q');
});

test('orderMessage leaves out empty optional fields', () => {
  const customer = { ...ORDER.customer, floor: '', apartment: ' ', notes: '' };
  const message = orderMessage({ ...ORDER, customer });
  assert.ok(message.includes('Av. Siempreviva 742\n'));
  assert.ok(!message.includes('piso'));
  assert.ok(!message.includes('Instrucciones'));
});

test('paidMessage confirms the order and the payment', () => {
  const message = paidMessage(ORDER);
  assert.match(message, /MS-7K3F2Q/);
  assert.match(message, /pagado/i);
  assert.match(message, /67\.072 sats/);
});

test('orderMessage flattens line breaks and strips control and bidi characters', () => {
  const customer = { ...ORDER.customer, notes: 'Timbre 2\n✅ Pedido MS-FAKE01 pagado', firstName: 'Ana\u202E', city: 'Spring\u0007field' };
  const message = orderMessage({ ...ORDER, customer });
  assert.ok(message.includes('Instrucciones: Timbre 2 ✅ Pedido MS-FAKE01 pagado'));
  assert.ok(!/[\u202E\u0007]/.test(message));
  assert.ok(message.includes('CP 1234, Spring field, Buenos Aires'));
});

test('claimedMessage tells the store to check the wallet before shipping', () => {
  const message = claimedMessage(ORDER);
  assert.match(message, /MS-7K3F2Q/);
  assert.match(message, /billetera/);
  assert.match(message, /67\.072 sats/);
});
