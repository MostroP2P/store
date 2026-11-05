// Prices (pure): pesos and sats formatting per language, fiat → sats conversion and the Yadio exchange rate.

export const YADIO_URL = 'https://api.yadio.io/exrates/BTC';

const SATS_PER_BTC = 100_000_000;
// Float noise such as 22357.000000000004 must not cost the buyer an extra sat
const ROUNDING_EPSILON = 1e-6;
// es: "$30.000" (Argentine pesos, as the store always wrote them); en: "ARS 30,000", so pesos are not
// read as dollars. The no-break space keeps the code and the number on one line.
const PRICE_STYLES = Object.freeze({
  es: { locale: 'es-AR', price: (n) => `$${n}`, priceWithCurrency: (n, currency) => `$${n} ${currency}` },
  en: { locale: 'en-US', price: (n, currency) => `${currency}\u00a0${n}`, priceWithCurrency: (n, currency) => `${currency}\u00a0${n}` },
});

/**
 * Number, price and sats formatting in `lang` (unknown languages format like English), prices in `currency`.
 * es: number(134185376.71) → "134.185.377", price(30000) → "$30.000", priceWithCurrency → "$30.000 ARS",
 * sats(22358) → "22.358 sats"; en: "134,185,377", "ARS 30,000", "ARS 30,000", "22,358 sats".
 */
export function moneyFormat(lang, currency) {
  const style = PRICE_STYLES[lang] ?? PRICE_STYLES.en;
  const format = new Intl.NumberFormat(style.locale, { maximumFractionDigits: 0 });
  const number = (value) => format.format(value);
  return Object.freeze({
    number,
    price: (amount) => style.price(number(amount), currency),
    priceWithCurrency: (amount) => style.priceWithCurrency(number(amount), currency),
    sats: (sats) => `${number(sats)} ${sats === 1 ? 'sat' : 'sats'}`,
  });
}

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
    throw new Error(`Yadio did not return the BTC/${currency} rate.`);
  }
  return rate;
}
