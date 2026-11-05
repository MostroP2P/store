// Store settings (pure): the "store" section of catalog.json — price, sizes, Lightning address and Nostr inbox.

import { decodeBech32 } from './bech32.js';

const DEFAULT_CURRENCY = 'ARS';
const CURRENCY = /^[A-Z]{3}$/;
const LN_ADDRESS = /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const NPUB_HRP = 'npub';
const NPUB_WORDS = 52;
const MEASURES = ['width', 'length'];

/** An npub with a valid bech32 checksum and a 32-byte key (a typo would send orders nowhere). */
function isNpub(value) {
  try {
    const { hrp, words } = decodeBech32(value);
    return hrp === NPUB_HRP && words.length === NPUB_WORDS && value === value.toLowerCase();
  } catch {
    return false;
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isPositive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const error = (message) => ({ level: 'error', message });
const warning = (message) => ({ level: 'warning', message });

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const isLocalHost = (host) => host === 'localhost' || host.endsWith('.localhost') || IPV4.test(host) || host.startsWith('[');

/** A public Nostr relay the browser can use from an https page (wss://, no localhost or IP literals). */
export function isRelayUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'wss:' && !isLocalHost(url.hostname);
  } catch {
    return false;
  }
}

function normalizeSize(entry, index, known) {
  if (!isObject(entry) || !isText(entry.id)) return { problems: [warning(`Size #${index + 1}: missing "id"; ignored.`)] };
  if (known.includes(entry.id)) return { problems: [warning(`Size "${entry.id}" repeated: the second one is ignored.`)] };
  const problems = MEASURES
    .filter((key) => entry[key] !== undefined && !isPositive(entry[key]))
    .map((key) => warning(`Size "${entry.id}": invalid "${key}" "${entry[key]}" (centimeters > 0).`));
  const measure = (key) => (isPositive(entry[key]) ? entry[key] : null);
  return { size: { id: entry.id, width: measure('width'), length: measure('length') }, problems };
}

function normalizeSizes(sizes) {
  if (!Array.isArray(sizes)) return { sizes: [], problems: [] };
  return sizes.reduce((acc, entry, index) => {
    const result = normalizeSize(entry, index, acc.sizes.map((s) => s.id));
    return {
      sizes: result.size ? [...acc.sizes, result.size] : acc.sizes,
      problems: [...acc.problems, ...result.problems],
    };
  }, { sizes: [], problems: [] });
}

/** A value from `allowed`, or the first allowed one (with a warning when the value was given but unknown). */
function pickDefault(value, allowed, label) {
  if (value === undefined) return { value: allowed[0], problems: [] };
  if (allowed.includes(value)) return { value, problems: [] };
  return { value: allowed[0], problems: [warning(`"store.${label}": unknown value "${value}"; using "${allowed[0]}".`)] };
}

function normalizeCurrency(currency) {
  if (currency === undefined) return { currency: DEFAULT_CURRENCY, problems: [] };
  const code = String(currency).toUpperCase();
  if (CURRENCY.test(code)) return { currency: code, problems: [] };
  return { currency: DEFAULT_CURRENCY, problems: [warning(`"store.currency": invalid value "${currency}" (a 3-letter code); using ${DEFAULT_CURRENCY}.`)] };
}

function normalizeLnAddress(address) {
  const value = typeof address === 'string' ? address.trim().toLowerCase() : '';
  if (LN_ADDRESS.test(value)) return { lnAddress: value, problems: [] };
  return {
    lnAddress: null,
    problems: [error(`"store.lnAddress": invalid value "${address}" (for example store@pay.mostro.foundation): without it the store cannot get paid.`)],
  };
}

function normalizeRelays(relays) {
  const list = Array.isArray(relays) ? relays : [];
  return list.reduce((acc, relay) => {
    if (!isRelayUrl(relay)) return { ...acc, problems: [...acc.problems, warning(`Invalid relay "${relay}" (it must start with wss://); ignored.`)] };
    if (acc.relays.includes(relay)) return { ...acc, problems: [...acc.problems, warning(`Relay "${relay}" repeated; ignored.`)] };
    return { ...acc, relays: [...acc.relays, relay] };
  }, { relays: [], problems: [] });
}

function normalizeNostr(nostr) {
  const npub = isObject(nostr) && typeof nostr.npub === 'string' ? nostr.npub.trim() : '';
  if (!isNpub(npub)) {
    return { nostr: null, problems: [error(`"store.nostr.npub": invalid value "${npub}": the store npub (npub1…) is needed to receive orders.`)] };
  }
  const { relays, problems } = normalizeRelays(nostr.relays);
  if (relays.length === 0) {
    return { nostr: null, problems: [...problems, error('"store.nostr.relays" has no valid wss:// relay: without one, orders cannot arrive.')] };
  }
  return { nostr: { npub, relays }, problems };
}

function normalizeDetails(details) {
  if (details === undefined) return { details: [], problems: [] };
  const list = Array.isArray(details) ? details : [details];
  return list.reduce((acc, entry, index) => (
    isObject(entry) && isText(entry.title) && isText(entry.text)
      ? { ...acc, details: [...acc.details, { title: entry.title.trim(), text: entry.text.trim() }] }
      : { ...acc, problems: [...acc.problems, warning(`"store.details" #${index + 1}: needs "title" and "text"; ignored.`)] }
  ), { details: [], problems: [] });
}

/**
 * Validates the "store" section. Returns { config, problems }.
 * config is null when the store cannot open at all (no section, no price or no sizes).
 * A bad lnAddress or nostr only turns that part off (null): products are still shown, checkout is closed.
 */
export function normalizeStoreConfig(raw, colorIds) {
  if (!isObject(raw)) return { config: null, problems: [error('catalog.json has no "store" section: the store cannot open.')] };
  if (!isPositive(raw.price)) {
    return { config: null, problems: [error(`"store.price": invalid value "${raw.price}": it must be a number above 0.`)] };
  }
  const sizes = normalizeSizes(raw.sizes);
  if (sizes.sizes.length === 0) {
    return { config: null, problems: [...sizes.problems, error('"store.sizes" has no valid size.')] };
  }
  const currency = normalizeCurrency(raw.currency);
  const lnAddress = normalizeLnAddress(raw.lnAddress);
  const nostr = normalizeNostr(raw.nostr);
  const defaultSize = pickDefault(raw.defaultSize, sizes.sizes.map((s) => s.id), 'defaultSize');
  const defaultColor = pickDefault(raw.defaultColor, colorIds, 'defaultColor');
  const details = normalizeDetails(raw.details);

  return {
    config: {
      currency: currency.currency,
      price: raw.price,
      lnAddress: lnAddress.lnAddress,
      sizes: sizes.sizes,
      defaultSize: defaultSize.value,
      defaultColor: defaultColor.value,
      nostr: nostr.nostr,
      details: details.details,
    },
    problems: [
      ...sizes.problems,
      ...currency.problems,
      ...lnAddress.problems,
      ...nostr.problems,
      ...defaultSize.problems,
      ...defaultColor.problems,
      ...details.problems,
    ],
  };
}
