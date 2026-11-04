// Checkout (checkout.html): order summary, delivery form (kept only in this tab) and Lightning payment.
// Flow: Yadio rate → sats → LNURL invoice whose comment is the order number → order sent to the store
// as an encrypted Nostr DM (NIP-17) → QR → payment confirmed by polling (LUD-21 / LNbits) or by WebLN.
// When the page can't see the payment (no status endpoint) the buyer can say "Ya pagué": the store
// then checks its wallet. The wallet is always the source of truth, never this page.

import { el } from '../dom.js';
import { SimplePool } from '../vendor/nostr-tools.js';
import { startPage, drawProduct, fetchJson } from './boot.js';
import { mountCart } from './cart-ui.js';
import { buildCheckoutForm } from './checkout-fields.js';
import { createPaymentPanel } from './payment-ui.js';
import { resolveCart } from './cart.js';
import {
  validateCheckout, firstProblem, sanitizeSavedForm, savedFormRecord, restoreSavedForm, FIELD_ORDER, FIELD_LIMITS,
} from './checkout-form.js';
import { YADIO_URL, parseYadioRate, satsFor, formatPrice, formatSats } from './money.js';
import { requestInvoice } from './lnurl.js';
import { waitForPayment, preimageMatches, isPaidNow } from './payment.js';
import { newOrderId, orderComment, orderMessage, paidMessage, claimedMessage } from './order.js';
import { createSenderKey, sendPrivateMessage } from './nostr-order.js';
import { readJson, writeJson, removeKey } from './persist.js';
import { STRINGS } from './strings.js';

const FORM_STORAGE_KEY = 'mostro-store:checkout';
const SUMMARY_THUMB_SCALE = 0.1;
const QUOTE_MAX_AGE_MS = 60_000;
const MSAT_PER_SAT = 1000;
/** Thrown inside an attempt that a newer one (or a cancel) replaced: it stops quietly. */
const CANCELLED = Symbol('cancelled');

const $ = (id) => document.getElementById(id);

const cartTotals = (view) => resolveCart(view.store.cart.get(), { products: view.store.products, colors: view.store.catalog.colors });
const cartSignature = (view) => JSON.stringify(view.store.cart.get().items);
const readForm = (view) => Object.fromEntries(FIELD_ORDER.map((name) => [name, view.form.controls.get(name).value]));
const canPay = (config) => Boolean(config.lnAddress && config.nostr);
const emailOf = (ctx) => ctx.order.customer.email.trim();

// ---------- Summary ----------

function summaryLine(store, line) {
  const canvas = el('canvas', { className: 'summary-thumb', 'aria-hidden': 'true' });
  drawProduct(store, canvas, line.product, line.color.id, SUMMARY_THUMB_SCALE);
  return el('li', { className: 'summary-line' }, [
    canvas,
    el('div', {}, [
      el('p', { className: 'summary-name', textContent: STRINGS.summaryQuantity(line.product.name, line.quantity) }),
      el('p', { className: 'muted', textContent: line.color.name }),
      el('p', { className: 'muted', textContent: STRINGS.sizeChip(line.size) }),
    ]),
    el('p', { className: 'summary-price', textContent: formatPrice(line.total) }),
  ]);
}

/** Price in sats for the current cart, when the Yadio rate is known. */
function quoteFor(view, subtotal) {
  if (!view.quote) return null;
  if (view.quote.error) return { error: true };
  return { rate: view.quote.rate, sats: satsFor(subtotal, view.quote.rate) };
}

function showReady(view, subtotal, quote) {
  if (!canPay(view.store.config)) {
    view.payment.closed();
    return;
  }
  view.payment.ready({ subtotal, quote, hint: view.notice ?? firstProblem(validateCheckout(readForm(view))) });
}

/** Either the checkout (summary, form, payment) or the "empty cart" message. */
function showCheckout(isEmpty) {
  $('checkout-empty').hidden = !isEmpty;
  $('checkout-content').hidden = isEmpty;
}

function fillSummary(view, lines, subtotal, satsText) {
  $('summary-lines').replaceChildren(...lines.map((line) => summaryLine(view.store, line)));
  $('summary-subtotal').textContent = formatPrice(subtotal);
  $('summary-total').textContent = formatPrice(subtotal);
  $('summary-sats').textContent = satsText;
}

/** Summary and, when nothing else is on screen (invoice, result), the payment button. */
function renderSummary(view) {
  if (view.paid) return;
  const { lines, subtotal } = cartTotals(view);
  showCheckout(lines.length === 0);
  if (lines.length === 0) return;
  const quote = quoteFor(view, subtotal);
  fillSummary(view, lines, subtotal, quote?.sats ? STRINGS.approxSats(formatSats(quote.sats)) : '');
  if (!view.active && !view.busy && !view.result) showReady(view, subtotal, quote);
}

async function fetchRate(view) {
  const rate = parseYadioRate(await fetchJson(YADIO_URL), view.store.config.currency);
  view.quote = { rate, at: Date.now() };
  return rate;
}

/** Rate shown in the summary; a failure only hides the sats estimate. */
async function refreshQuote(view) {
  try {
    await fetchRate(view);
  } catch {
    view.quote = { error: true };
  }
  renderSummary(view);
}

const freshRate = (view) => (view.quote?.rate && Date.now() - view.quote.at < QUOTE_MAX_AGE_MS
  ? Promise.resolve(view.quote.rate)
  : fetchRate(view));

// ---------- Form ----------

function showFieldError(view, name, errors) {
  const message = view.touched.has(name) ? (errors[name] ?? '') : '';
  view.form.errors.get(name).textContent = message;
  view.form.controls.get(name).setAttribute('aria-invalid', String(Boolean(message)));
}

function onFormChange(view, name) {
  const values = readForm(view);
  writeJson(view.store.session, FORM_STORAGE_KEY, savedFormRecord(values, Date.now()));
  const errors = validateCheckout(values);
  if (name) showFieldError(view, name, errors);
  if (name === 'notes') $('field-notes-counter').textContent = STRINGS.notesCounter(values.notes.length, FIELD_LIMITS.notes);
  view.payment.setHint(firstProblem(errors));
}

function restoreForm(view) {
  const record = readJson(view.store.session, FORM_STORAGE_KEY, null);
  const saved = restoreSavedForm(record, Date.now());
  // Expired (older than a week) or unreadable: forget it
  if (!saved && record !== null) removeKey(view.store.session, FORM_STORAGE_KEY);
  const values = saved ?? sanitizeSavedForm(null);
  FIELD_ORDER.forEach((name) => { view.form.controls.get(name).value = values[name]; });
  $('field-notes-counter').textContent = STRINGS.notesCounter(values.notes.length, FIELD_LIMITS.notes);
}

function clearSavedForm(view) {
  removeKey(view.store.session, FORM_STORAGE_KEY);
  FIELD_ORDER.forEach((name) => { view.form.controls.get(name).value = ''; });
  view.touched = new Set();
  const errors = validateCheckout({});
  FIELD_ORDER.forEach((name) => showFieldError(view, name, errors));
  $('field-notes-counter').textContent = STRINGS.notesCounter(0, FIELD_LIMITS.notes);
  view.payment.setHint(firstProblem(errors));
}

const lockForm = (view, locked) => view.form.fieldsets.forEach((fieldset) => { fieldset.disabled = locked; });

/** Validates the whole form and starts the payment, or points at the first problem. Used by Pay and Retry. */
function trySubmit(view) {
  if (view.busy || view.active || view.paid || !canPay(view.store.config)) return;
  if (cartTotals(view).lines.length === 0) return;
  const errors = validateCheckout(readForm(view));
  view.touched = new Set(FIELD_ORDER);
  FIELD_ORDER.forEach((name) => showFieldError(view, name, errors));
  const first = FIELD_ORDER.find((name) => errors[name]);
  if (!first) {
    startPayment(view);
    return;
  }
  view.result = false;
  view.notice = null;
  renderSummary(view);
  view.form.controls.get(first).focus();
}

// ---------- Payment ----------

/** One stage of an attempt: shows `message`, runs it and stops the attempt if a newer one replaced it. */
async function step(view, session, message, failure, run) {
  if (session !== view.session) throw CANCELLED;
  view.payment.working(message);
  const value = await Promise.resolve().then(run).catch((err) => {
    throw session === view.session ? new Error(failure, { cause: err }) : CANCELLED;
  });
  if (session !== view.session) throw CANCELLED;
  return value;
}

/** Rate, invoice and encrypted order message. Returns the context of the invoice to show. */
async function createOrder(view, session, pool) {
  const { config } = view.store;
  const { lines, subtotal } = cartTotals(view);
  const customer = readForm(view);
  const rate = await step(view, session, STRINGS.stepRate, STRINGS.errorRate, () => freshRate(view));
  const sats = satsFor(subtotal, rate);
  const id = newOrderId();
  const invoice = await step(view, session, STRINGS.stepInvoice, STRINGS.errorInvoice, () => requestInvoice({
    address: config.lnAddress, msat: sats * MSAT_PER_SAT, comment: orderComment(id), fetchJson,
  }));
  const order = {
    id, subtotal, currency: config.currency, sats, rate, paymentHash: invoice.paymentHash, customer,
    lines: lines.map((l) => ({ name: l.product.name, colorName: l.color.name, size: l.size, quantity: l.quantity, total: l.total })),
  };
  // What this order buys: only this comes off the cart when it completes
  const items = lines.map((l) => ({ productId: l.product.id, colorId: l.color.id, size: l.size, quantity: l.quantity }));
  const senderKey = createSenderKey();
  await step(view, session, STRINGS.stepOrder, STRINGS.errorOrder, () => sendPrivateMessage({
    pool, npub: config.nostr.npub, relays: config.nostr.relays, message: orderMessage(order), subject: STRINGS.orderNumber(id), senderKey,
  }));
  return { session, order, items, invoice, pool, senderKey };
}

function closeActive(view) {
  view.active?.pool.destroy();
  view.active = null;
  lockForm(view, false);
}

function showResult(view, render) {
  view.result = true;
  render();
}

/** A payment made just before cancelling would otherwise go unnoticed: check the old invoice once more. */
async function confirmLate(view, ctx) {
  const paid = await isPaidNow(ctx.invoice.statusUrl, fetchJson);
  if (paid) completeOrder(view, ctx, 'paid');
  else ctx.pool.destroy();
}

/** Drops the invoice being prepared or shown (new data, cart changed…) and shows the payment button again. */
function cancelActive(view, notice = null) {
  const previous = view.active;
  view.session += 1;
  view.busy = false;
  view.notice = notice;
  view.result = false;
  view.active = null;
  lockForm(view, false);
  renderSummary(view);
  if (previous) confirmLate(view, previous);
}

async function watchPayment(view, ctx) {
  const panel = view.payment.invoice({
    order: ctx.order, invoice: ctx.invoice, onCancel: () => cancelActive(view), onWebln: () => payWithWebln(view, ctx, panel),
  });
  const result = await waitForPayment({
    url: ctx.invoice.statusUrl, fetchJson, expiresAt: ctx.invoice.expiresAt,
    isCancelled: () => ctx.session !== view.session,
    onUnreachable: () => panel.cannotConfirm(() => completeOrder(view, ctx, 'claimed')),
  });
  if (result === 'paid') completeOrder(view, ctx, 'paid');
  if (result !== 'expired' && result !== 'unconfirmed') return;
  closeActive(view);
  const onRetry = () => trySubmit(view);
  showResult(view, () => (result === 'expired'
    ? view.payment.expired({ onRetry })
    : view.payment.unconfirmed({ order: ctx.order, email: emailOf(ctx), onRetry })));
}

async function startPayment(view) {
  view.session += 1;
  const { session } = view;
  const pool = new SimplePool();
  view.busy = true;
  view.notice = null;
  view.result = false;
  view.cartKey = cartSignature(view);
  lockForm(view, true);
  try {
    const ctx = await createOrder(view, session, pool);
    view.busy = false;
    view.active = ctx;
    await watchPayment(view, ctx);
  } catch (err) {
    pool.destroy();
    if (err === CANCELLED || session !== view.session) return;
    view.busy = false;
    closeActive(view);
    showResult(view, () => view.payment.error({
      message: err.message, detail: err.cause?.message ?? null, onRetry: () => trySubmit(view),
    }));
  }
}

async function payWithWebln(view, ctx, panel) {
  const current = () => ctx.session === view.session;
  panel.weblnBusy(true);
  panel.fail('');
  try {
    await window.webln.enable();
    const response = await window.webln.sendPayment(ctx.invoice.pr);
    if (!current()) return;
    if (await preimageMatches(response?.preimage, ctx.invoice.paymentHash)) completeOrder(view, ctx, 'paid');
    // No valid proof from the wallet: keep waiting for the status check
    else panel.fail(STRINGS.weblnUnverified);
  } catch {
    if (current()) panel.fail(STRINGS.weblnFailed);
  } finally {
    if (current()) panel.weblnBusy(false);
  }
}

const COMPLETIONS = Object.freeze({
  paid: { message: paidMessage, show: (payment, args) => payment.paid(args) },
  claimed: { message: claimedMessage, show: (payment, args) => payment.claimed(args) },
});

/** Ends the checkout: confirmation on screen, bought items off the cart, delivery data forgotten, DM to the store. */
function completeOrder(view, ctx, kind) {
  if (view.paid) return;
  const completion = COMPLETIONS[kind];
  view.session += 1;
  view.active = null;
  view.paid = true;
  // The cart may have changed, even emptied, since this order was made (e.g. confirmed after a cancel):
  // always show the confirmation, with what this order bought
  const bought = resolveCart({ items: ctx.items }, { products: view.store.products, colors: view.store.catalog.colors });
  showCheckout(false);
  fillSummary(view, bought.lines, ctx.order.subtotal, formatSats(ctx.order.sats));
  document.querySelector('main').classList.add('is-paid');
  completion.show(view.payment, { order: ctx.order, email: emailOf(ctx) });
  // Not clear(): an older invoice confirmed late must keep items added afterwards (e.g. from another tab)
  view.store.cart.subtract(ctx.items);
  removeKey(view.store.session, FORM_STORAGE_KEY);
  const { nostr } = view.store.config;
  // Best effort: the store matches orders against its wallet anyway (payment hash + "Pedido MS-…" comment)
  sendPrivateMessage({
    pool: ctx.pool, npub: nostr.npub, relays: nostr.relays,
    message: completion.message(ctx.order), subject: STRINGS.orderNumber(ctx.order.id), senderKey: ctx.senderKey,
  }).catch(() => {}).finally(() => ctx.pool.destroy());
}

// ---------- Page ----------

function onCartChange(view) {
  if (view.paid) return;
  if (view.active || view.busy) {
    // Another tab may rewrite the same cart: only a real change cancels the invoice
    if (cartSignature(view) !== view.cartKey) cancelActive(view, STRINGS.cartChanged);
    return;
  }
  view.result = false;
  renderSummary(view);
}

function bindEvents(view) {
  const form = $('checkout-form');
  form.addEventListener('input', (event) => onFormChange(view, event.target.name));
  form.addEventListener('focusout', (event) => {
    if (!event.target.name) return;
    view.touched = new Set([...view.touched, event.target.name]);
    onFormChange(view, event.target.name);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    trySubmit(view);
  });
  $('clear-saved').addEventListener('click', () => clearSavedForm(view));
  view.store.cart.subscribe(() => onCartChange(view));
}

startPage((store) => {
  mountCart(store);
  // `view` is the page's single mutable holder: flow flags, the Yadio quote and the active invoice
  const view = {
    store,
    form: buildCheckoutForm($('checkout-form')),
    payment: createPaymentPanel($('payment-body'), { lnAddress: store.config.lnAddress, liveRegion: $('payment-status') }),
    touched: new Set(),
    quote: null,
    session: 0,
    busy: false,
    active: null,
    notice: null,
    result: false,
    cartKey: null,
    paid: false,
  };
  restoreForm(view);
  bindEvents(view);
  renderSummary(view);
  if (canPay(store.config)) refreshQuote(view);
});
