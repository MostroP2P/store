// Languages (pure): which one a visitor sees and how catalog.json carries its translations.
// English by default; Spanish when the browser asks for it first; a choice made with the switch wins.

export const SUPPORTED_LANGS = Object.freeze(['en', 'es']);
export const DEFAULT_LANG = 'en';

const isSupported = (lang) => SUPPORTED_LANGS.includes(lang);
const isFilled = (text) => typeof text === 'string' && text.trim() !== '';
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** "es-AR", "es_AR", "es;q=0.8" → "es" */
const baseLanguage = (tag) => (typeof tag === 'string' ? tag.trim().toLowerCase().split(/[-_;]/)[0] : '');

/**
 * Language to show: `saved` (chosen with the switch) when supported, else the first supported
 * language in `browserLanguages` (navigator.languages), else English.
 */
export function pickLanguage(saved, browserLanguages) {
  if (isSupported(saved)) return saved;
  const preferred = Array.isArray(browserLanguages) ? browserLanguages : [];
  return preferred.map(baseLanguage).find(isSupported) ?? DEFAULT_LANG;
}

/** { "en": "Black", "es": "Negro" }: only supported language keys, each one a string. */
function isTranslation(value) {
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([key, text]) => isSupported(key) && typeof text === 'string');
}

/**
 * Copy of `value` (catalog.json) with every translated text ({ "en": …, "es": … }) replaced by the
 * one in `lang`; a missing or empty translation falls back to English, then to the other language.
 */
export function localizeJson(value, lang) {
  if (Array.isArray(value)) return value.map((item) => localizeJson(item, lang));
  if (!isObject(value)) return value;
  if (isTranslation(value)) return [lang, DEFAULT_LANG, ...SUPPORTED_LANGS].map((key) => value[key]).find(isFilled) ?? '';
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeJson(item, lang)]));
}
