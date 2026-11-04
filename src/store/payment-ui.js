// Checkout payment panel: price in sats, the Lightning invoice (styled QR like the donate page) and the
// waiting / paid / expired / error states. It only renders; checkout-page.js runs the flow.
// Each state is announced in a persistent live region; when the panel had the focus (the buyer clicked
// a button in it), the focus moves to the new state's heading.

import { el, svgEl } from '../dom.js';
import { buildStyledQr } from './qr.js';
import { formatCountdown } from './payment.js';
import { formatPrice, formatSats } from './money.js';
import { icon } from './icons.js';
import { STRINGS } from './strings.js';

const LOGO = 'designs/characters/mostro.png';
const LOGO_ASPECT = 1000 / 1446;
const QR_LIGHT = '#ffffff';
const QR_DARK = '#0e130c';
// Finder centers must read as dark to a scanner: #4a9a26 (≈ 46 % luminance) broke some versions
const QR_ACCENT = '#2f6b14';
const COPIED_RESET_MS = 1600;
const TICK_MS = 1000;
const COLLECTION_PAGE = 'index.html';

const sentence = (className, text) => el('p', { className, textContent: text });
const focusTarget = (tag, props, children = []) => el(tag, { ...props, tabIndex: -1, dataset: { autofocus: 'true' } }, children);
const actionButton = (label, onClick, className = 'button-primary button-block') => el('button', { type: 'button', className, onclick: onClick }, [label]);
const keepShopping = () => el('a', { className: 'button-primary button-block', href: COLLECTION_PAGE }, [STRINGS.keepShopping]);

function qrCode(pr) {
  const uri = `lightning:${pr}`;
  const qr = buildStyledQr(uri.toUpperCase(), { mode: 'Alphanumeric', errorCorrection: 'Q', logoAspect: LOGO_ASPECT });
  const svg = svgEl('svg', { viewBox: `0 0 ${qr.size} ${qr.size}`, class: 'qr', 'aria-hidden': 'true' }, [
    svgEl('rect', { width: qr.size, height: qr.size, rx: 1.5, fill: QR_LIGHT }),
    svgEl('path', { d: qr.dots, fill: QR_DARK }),
    svgEl('path', { d: qr.eyesOuter, fill: QR_DARK, 'fill-rule': 'evenodd' }),
    svgEl('path', { d: qr.eyesInner, fill: QR_ACCENT }),
    ...(qr.logo ? [svgEl('image', { href: LOGO, ...qr.logo })] : []),
  ]);
  return el('a', { className: 'qr-link', href: uri, 'aria-label': STRINGS.openWallet }, [svg]);
}

function copyButton(pr, invoiceText, status) {
  const label = el('span', { textContent: STRINGS.copyInvoice });
  let reset = null;
  return el('button', {
    type: 'button',
    className: 'button-secondary',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(pr);
      } catch {
        // No clipboard access: select the invoice so it can be copied by hand
        window.getSelection()?.selectAllChildren(invoiceText);
        status.textContent = STRINGS.copyManual;
        return;
      }
      label.textContent = STRINGS.copied;
      clearTimeout(reset);
      reset = setTimeout(() => { label.textContent = STRINGS.copyInvoice; }, COPIED_RESET_MS);
    },
  }, [icon('copy'), label]);
}

function readyView({ lnAddress, subtotal, quote }) {
  const sats = quote?.rate ? STRINGS.approxSats(formatSats(quote.sats)) : (quote?.error ? STRINGS.satsUnavailable : STRINGS.satsLoading);
  const rate = quote?.rate ? STRINGS.rateLine(formatPrice(quote.rate)) : '';
  return [
    el('p', { className: 'pay-lead' }, [el('strong', { textContent: STRINGS.payWith }), ` ${STRINGS.payTo(lnAddress)}`]),
    el('div', { className: 'pay-amount' }, [
      el('strong', { className: 'pay-sats', textContent: sats }),
      sentence('muted', [formatPrice(subtotal), rate].filter(Boolean).join(' · ')),
    ]),
    el('ol', { className: 'pay-steps' }, STRINGS.paySteps.map((text) => el('li', { textContent: text }))),
    el('button', { type: 'submit', className: 'button-primary button-block button-large', form: 'checkout-form', id: 'pay-button' },
      [icon('bolt'), STRINGS.payButton]),
    el('p', { className: 'pay-hint', id: 'pay-hint' }),
    el('p', { className: 'pay-privacy muted' }, [icon('info'), STRINGS.privacyNote]),
  ];
}

function invoiceParts({ order, invoice, onCancel, onWebln }) {
  const status = el('p', { className: 'pay-error', role: 'alert' });
  const countdown = el('p', { className: 'muted small' });
  const waiting = el('p', { className: 'waiting' }, [el('span', { className: 'spinner', 'aria-hidden': 'true' }), STRINGS.waiting]);
  const webln = window.webln ? el('button', { type: 'button', className: 'button-secondary', onclick: onWebln }, [icon('bolt'), STRINGS.payWithExtension]) : null;
  const invoiceText = el('code', { className: 'invoice-text', textContent: invoice.pr });
  const nodes = [
    focusTarget('p', { className: 'order-id', textContent: STRINGS.orderNumber(order.id) }),
    qrCode(invoice.pr),
    el('p', { className: 'pay-sats', textContent: formatSats(order.sats) }),
    sentence('muted', `${formatPrice(order.subtotal)} ${order.currency}`),
    sentence('', STRINGS.scanToPay),
    el('div', { className: 'invoice-actions' }, [
      copyButton(invoice.pr, invoiceText, status),
      el('a', { className: 'button-secondary', href: `lightning:${invoice.pr}` }, [icon('wallet'), STRINGS.openWallet]),
      ...(webln ? [webln] : []),
    ]),
    invoiceText, waiting, countdown, status,
    sentence('muted small', STRINGS.keepOrderId(order.id)),
    el('button', { type: 'button', className: 'link-button', onclick: onCancel }, [icon('arrowLeft'), STRINGS.editData]),
  ];
  return { nodes, status, countdown, waiting, webln };
}

function messageView({ iconName, title, lead, action, tone = '' }) {
  return [
    el('div', { className: `pay-result ${tone}` }, [icon(iconName, 'icon pay-result-icon'), focusTarget('h3', { textContent: title })]),
    ...lead.map((text) => sentence('', text)),
    ...(action ? [action] : []),
  ];
}

const errorDetail = (detail) => el('details', { className: 'error-detail' }, [
  el('summary', { textContent: STRINGS.technicalDetail }),
  el('p', { textContent: detail }),
]);

/** Live countdown until the invoice expires; returns the interval id. */
function startCountdown(node, expiresAt) {
  const tick = () => { node.textContent = STRINGS.expiresIn(formatCountdown(expiresAt - Date.now())); };
  tick();
  return setInterval(tick, TICK_MS);
}

/** What checkout-page.js can still change on a shown invoice. */
function invoiceControls(parts) {
  return {
    fail: (message) => { parts.status.textContent = message; },
    weblnBusy: (busy) => { if (parts.webln) parts.webln.disabled = busy; },
    cannotConfirm: (onClaim) => parts.waiting.replaceChildren(
      el('span', { textContent: STRINGS.cannotConfirm }),
      actionButton(STRINGS.alreadyPaid, onClaim, 'button-secondary'),
    ),
  };
}

/** Final states: paid, paid by the buyer's word, unconfirmed, expired. */
function resultStates(result) {
  return {
    paid: ({ order, email }) => result({
      iconName: 'check', title: STRINGS.paidTitle, tone: 'is-success',
      lead: [STRINGS.paidLead(order.id), STRINGS.paidNext(email)], action: keepShopping(),
    }),
    claimed: ({ order, email }) => result({
      iconName: 'check', title: STRINGS.claimedTitle, tone: 'is-success',
      lead: [STRINGS.claimedLead(order.id), STRINGS.paidNext(email)], action: keepShopping(),
    }),
    unconfirmed: ({ order, email, onRetry }) => result({
      iconName: 'info', title: STRINGS.unconfirmedTitle,
      lead: [STRINGS.unconfirmedLead(order.id, email), STRINGS.unconfirmedRetry], action: actionButton(STRINGS.retry, onRetry),
    }),
    expired: ({ onRetry }) => result({
      iconName: 'info', title: STRINGS.expiredTitle, lead: [STRINGS.expiredLead], action: actionButton(STRINGS.retry, onRetry),
    }),
  };
}

/** Renders the payment states into `container` (#payment-body) and announces them in `liveRegion`. */
export function createPaymentPanel(container, { lnAddress, liveRegion }) {
  let timer = null;
  const show = (children, announcement = '') => {
    const hadFocus = container.contains(document.activeElement);
    clearInterval(timer);
    timer = null;
    container.replaceChildren(...children);
    liveRegion.textContent = announcement;
    if (hadFocus) container.querySelector('[data-autofocus]')?.focus();
  };

  return {
    ready: ({ subtotal, quote, hint }) => {
      show(readyView({ lnAddress, subtotal, quote }));
      container.querySelector('#pay-hint').textContent = hint ?? '';
    },
    setHint: (hint) => {
      const node = container.querySelector('#pay-hint');
      if (node) node.textContent = hint ?? '';
    },
    closed: () => show([sentence('pay-error', STRINGS.paymentClosed)]),
    working: (message) => show([focusTarget('p', { className: 'waiting' }, [
      el('span', { className: 'spinner', 'aria-hidden': 'true' }), message,
    ])], message),
    invoice: (options) => {
      const parts = invoiceParts(options);
      show(parts.nodes, STRINGS.invoiceReady(options.order.id, formatSats(options.order.sats)));
      timer = startCountdown(parts.countdown, options.invoice.expiresAt);
      return invoiceControls(parts);
    },
    ...resultStates((options) => show(messageView(options), options.title)),
    error: ({ message, detail, onRetry }) => show([
      ...messageView({ iconName: 'info', title: STRINGS.errorTitle, tone: 'is-error', lead: [message] }),
      ...(detail ? [errorDetail(detail)] : []),
      actionButton(STRINGS.tryAgain, onRetry),
    ], `${STRINGS.errorTitle}: ${message}`),
  };
}
