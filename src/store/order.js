// Orders (pure): order number and the texts that reach the store (LN comment and Nostr message).
// The store reads them in Spanish whatever the buyer's language; the order says which language to answer in.

import { moneyFormat } from './money.js';

// Crockford base32 (no I, L, O, U): easy to read aloud or copy by hand
const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ID_LENGTH = 6;
const ID_MASK = 31;
const STORE_HOST = 'store.mostro.network';
export const ORDER_ID_PATTERN = /^MS-[0-9A-HJKMNP-TV-Z]{6}$/;
// Messages to the store are in Spanish; prices as the store writes them ($30.000)
const STORE_LANG = 'es';
const LANGUAGE_NAMES = Object.freeze({
  en: 'inglés', es: 'español', fr: 'francés', it: 'italiano', pt: 'portugués',
});

const browserRandom = (length) => crypto.getRandomValues(new Uint8Array(length));
// One line per field: control/format characters (bidi overrides, zero-width…) and line breaks become spaces,
// so buyer text can't fake extra lines such as "✅ Pedido … pagado" in the store's message
const clean = (value) => (typeof value === 'string'
  ? value.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, ' ').replace(/\s+/g, ' ').trim()
  : '');

/** "MS-7K3F2Q" */
export function newOrderId(randomBytes = browserRandom) {
  const chars = Array.from(randomBytes(ID_LENGTH), (byte) => ID_ALPHABET[byte & ID_MASK]);
  return `MS-${chars.join('')}`;
}

/** Comment attached to the Lightning payment, so each payment can be matched with its order. */
export const orderComment = (id) => `Pedido ${id} · ${STORE_HOST}`;

/** Subject of the Nostr messages about an order. */
export const orderSubject = (id) => `Pedido ${id}`;

function addressLines(customer) {
  const street = [
    `${clean(customer.street)} ${clean(customer.number)}`,
    clean(customer.floor) && `piso ${clean(customer.floor)}`,
    clean(customer.apartment) && `depto ${clean(customer.apartment)}`,
  ].filter(Boolean).join(', ');
  return [
    `${clean(customer.firstName)} ${clean(customer.lastName)}`,
    street,
    `CP ${clean(customer.postalCode)}, ${clean(customer.city)}, ${clean(customer.province)}`,
  ];
}

/**
 * Message sent to the store when the invoice is created.
 * order: { id, lines: [{ name, colorName, size, quantity, total }], subtotal, currency, lang, sats, rate, paymentHash, customer }
 */
export function orderMessage(order) {
  const { customer } = order;
  const notes = clean(customer.notes);
  const money = moneyFormat(STORE_LANG, order.currency);
  const language = Object.hasOwn(LANGUAGE_NAMES, order.lang) ? LANGUAGE_NAMES[order.lang] : null;
  return [
    `🛒 Pedido ${order.id} — Pendiente de pago`,
    '',
    'Remeras:',
    ...order.lines.map((l) => `• ${l.quantity} × ${l.name} — ${l.colorName}, talle ${l.size} — ${money.price(l.total)}`),
    '',
    `Total: ${money.priceWithCurrency(order.subtotal)} = ${money.sats(order.sats)}`,
    `1 BTC = ${money.priceWithCurrency(order.rate)} (Yadio)`,
    `Payment hash: ${order.paymentHash}`,
    '',
    'Envío a:',
    ...addressLines(customer),
    '',
    'Contacto:',
    `Email: ${clean(customer.email)}`,
    `Teléfono: ${clean(customer.phone)}`,
    ...(language ? [`Idioma: ${language}`] : []),
    ...(notes ? ['', `Instrucciones: ${notes}`] : []),
  ].join('\n');
}

/** Follow-up when the page could not confirm the payment but the buyer says it is paid. */
export function claimedMessage(order) {
  return [
    `⚠️ Pedido ${order.id}: el comprador dice que ya pagó ${moneyFormat(STORE_LANG, order.currency).sats(order.sats)}, pero la página no pudo confirmarlo.`,
    'Verificá el pago en la billetera antes de enviar.',
    `Payment hash: ${order.paymentHash}`,
  ].join('\n');
}

/** Follow-up message once the browser sees the payment settled. */
export function paidMessage(order) {
  return [
    `✅ Pedido ${order.id} pagado: ${moneyFormat(STORE_LANG, order.currency).sats(order.sats)} recibidos.`,
    `Payment hash: ${order.paymentHash}`,
  ].join('\n');
}
