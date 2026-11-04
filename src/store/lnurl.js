// LNURL-pay for a Lightning address (LUD-06 / LUD-16 / LUD-12 comment), same checks as the donate page:
// the invoice must be for exactly the requested amount. Payment status: LUD-21 "verify" when the server
// offers it, otherwise LNbits' public endpoint GET /api/v1/payments/<hash> ({ "paid": true | false }).

import { decodeInvoice } from './bolt11.js';

const LN_ADDRESS = /^([a-z0-9._+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
const LNBITS_STATUS_PATH = '/api/v1/payments/';
const MAINNET = 'bc';
const MS_PER_SECOND = 1000;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
const EXPIRY_RANGE_S = { min: 60, max: 24 * 60 * 60 };

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const isMsat = (value) => Number.isSafeInteger(value) && value > 0;
const sameOrigin = (a, b) => new URL(a).origin === new URL(b).origin;

/** "store@pay.mostro.foundation" → "https://pay.mostro.foundation/.well-known/lnurlp/store" */
export function lnurlpUrl(address) {
  const match = LN_ADDRESS.exec(String(address).trim());
  if (!match) throw new Error(`LN address inválida: ${address}`);
  return `https://${match[2].toLowerCase()}/.well-known/lnurlp/${match[1].toLowerCase()}`;
}

/**
 * Checks the LUD-06 payRequest answer and keeps { callback, minSendable, maxSendable, commentAllowed }.
 * With `host`, the callback must live on the LN address host (no requests to arbitrary servers).
 */
export function parsePayParams(json, host = null) {
  if (json?.status === 'ERROR') throw new Error(json.reason || 'el servidor Lightning devolvió un error');
  if (json?.tag !== 'payRequest') throw new Error('respuesta LNURL inválida: no es un payRequest');
  if (!isHttpsUrl(json.callback)) throw new Error('respuesta LNURL inválida: el callback no es https');
  if (host && new URL(json.callback).hostname !== host) throw new Error('respuesta LNURL inválida: el callback apunta a otro servidor');
  if (!isMsat(json.minSendable) || !isMsat(json.maxSendable) || json.minSendable > json.maxSendable) {
    throw new Error('respuesta LNURL inválida: límites de monto');
  }
  return {
    callback: json.callback,
    minSendable: json.minSendable,
    maxSendable: json.maxSendable,
    commentAllowed: Number.isInteger(json.commentAllowed) && json.commentAllowed > 0 ? json.commentAllowed : 0,
  };
}

/** Callback URL asking for an invoice of `msat`, with the comment cut to what the server allows (LUD-12). */
export function callbackUrl(params, msat, comment) {
  if (!Number.isSafeInteger(msat) || msat < params.minSendable || msat > params.maxSendable) {
    throw new Error(`monto fuera de los límites del servidor: ${msat} msat`);
  }
  const url = new URL(params.callback);
  url.searchParams.set('amount', String(msat));
  const text = comment.slice(0, params.commentAllowed);
  if (text) url.searchParams.set('comment', text);
  return url.toString();
}

/** Why an invoice's date or expiry can't be trusted (null when fine): a hostile server could make the page wait forever. */
export function invoiceTimingProblem({ timestamp, expiry }, now) {
  if (Math.abs(timestamp * MS_PER_SECOND - now) > MAX_CLOCK_SKEW_MS) return 'la factura tiene una fecha inválida';
  if (expiry < EXPIRY_RANGE_S.min || expiry > EXPIRY_RANGE_S.max) return `la factura tiene un vencimiento inválido (${expiry} s)`;
  return null;
}

/**
 * Checks the callback answer: a mainnet invoice for exactly `msat`, issued now.
 * A LUD-21 verify URL is kept only on the callback's origin. Returns { pr, paymentHash, expiresAt (ms), verify }.
 */
export function parseInvoiceResponse(json, msat, { now = Date.now(), callback }) {
  if (json?.status === 'ERROR') throw new Error(json.reason || 'el servidor no pudo crear la factura');
  if (typeof json?.pr !== 'string') throw new Error('el servidor no devolvió una factura');
  const invoice = decodeInvoice(json.pr);
  if (invoice.network !== MAINNET) throw new Error(`la factura no es de Bitcoin mainnet (${invoice.network})`);
  if (invoice.msat !== msat) throw new Error(`la factura no es por el monto pedido (${invoice.msat} ≠ ${msat} msat)`);
  const timing = invoiceTimingProblem(invoice, now);
  if (timing) throw new Error(timing);
  return {
    pr: json.pr.trim(),
    paymentHash: invoice.paymentHash,
    expiresAt: (invoice.timestamp + invoice.expiry) * MS_PER_SECOND,
    verify: isHttpsUrl(json.verify) && sameOrigin(json.verify, callback) ? json.verify : null,
  };
}

/** Where to ask whether the invoice was paid. */
export function statusUrl(invoice, callback) {
  return invoice.verify ?? `${new URL(callback).origin}${LNBITS_STATUS_PATH}${invoice.paymentHash}`;
}

/** LUD-21 answers { settled: true }; LNbits answers { paid: true }. */
export const isSettled = (json) => json?.settled === true || json?.paid === true;

/** Full LNURL-pay flow; fetchJson(url) → parsed JSON (throws on HTTP errors). */
export async function requestInvoice({ address, msat, comment, fetchJson, now = Date.now() }) {
  const url = lnurlpUrl(address);
  const params = parsePayParams(await fetchJson(url), new URL(url).hostname);
  const json = await fetchJson(callbackUrl(params, msat, comment));
  const invoice = parseInvoiceResponse(json, msat, { now, callback: params.callback });
  return { ...invoice, statusUrl: statusUrl(invoice, params.callback) };
}
