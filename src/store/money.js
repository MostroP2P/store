// Prices (pure): pesos and sats formatting, fiat → sats conversion and the Yadio exchange rate.

export const YADIO_URL = 'https://api.yadio.io/exrates/BTC';

const SATS_PER_BTC = 100_000_000;
// Float noise such as 22357.000000000004 must not cost the buyer an extra sat
const ROUNDING_EPSILON = 1e-6;
const NUMBER_FORMAT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** 134185376.71 → "134.185.377" */
export const formatNumber = (value) => NUMBER_FORMAT.format(value);

/** 30000 → "$30.000" */
export const formatPrice = (amount) => `$${formatNumber(amount)}`;

/** 22358 → "22.358 sats" */
export const formatSats = (sats) => `${formatNumber(sats)} ${sats === 1 ? 'sat' : 'sats'}`;

/** Sats for a fiat amount at `unitsPerBtc` (fiat price of 1 BTC), rounded up to a whole sat. */
export function satsFor(amount, unitsPerBtc) {
  if (typeof unitsPerBtc !== 'number' || !Number.isFinite(unitsPerBtc) || unitsPerBtc <= 0) {
    throw new Error(`invalid rate ${unitsPerBtc}`);
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw new Error(`invalid amount ${amount}`);
  return Math.ceil((amount * SATS_PER_BTC) / unitsPerBtc - ROUNDING_EPSILON);
}

/** Price of 1 BTC in `currency` from https://api.yadio.io/exrates/BTC ({ BTC: { ARS: 134185376.71, … } }). */
export function parseYadioRate(json, currency) {
  const rate = json?.BTC?.[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Yadio no devolvió la cotización BTC/${currency}.`);
  }
  return rate;
}
