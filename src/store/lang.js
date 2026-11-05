// Page language (browser): the visitor's choice, else the browser's language, else English (i18n.js).
// T holds the texts of that language. translatePage() fills the static texts of the HTML (data-i18n) and
// mountLanguageSwitch() wires the EN/ES button in the header (saves the choice and reloads the page).

import { pickLanguage, SUPPORTED_LANGS } from '../i18n.js';
import { browserStorage, readJson, writeJson } from './persist.js';
import { STRINGS } from './strings.js';

export const LANG_STORAGE_KEY = 'mostro-store:lang';
// Static texts stay hidden (CSS) until this class is set, so a Spanish visitor never sees them flip from English
const READY_CLASS = 'i18n-ready';

const storage = browserStorage('localStorage');

export const LANG = pickLanguage(readJson(storage, LANG_STORAGE_KEY, null), navigator.languages ?? [navigator.language]);
/** Texts in the page language. */
export const T = STRINGS[LANG];

const textFor = (key) => (typeof T[key] === 'string' ? T[key] : null);

/**
 * <span data-i18n="key"> gets T[key] as its text; data-i18n-attr="aria-label:key content:key2" sets attributes.
 * Unknown keys keep the English text of the HTML.
 */
export function translatePage(doc) {
  doc.documentElement.lang = LANG;
  doc.querySelectorAll('[data-i18n]').forEach((node) => {
    const text = textFor(node.dataset.i18n);
    if (text !== null) node.textContent = text;
  });
  doc.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    node.dataset.i18nAttr.split(/\s+/).filter(Boolean).forEach((pair) => {
      const [attribute, key] = pair.split(':');
      const text = textFor(key);
      if (attribute && text !== null) node.setAttribute(attribute, text);
    });
  });
  doc.documentElement.classList.add(READY_CLASS);
}

/** #lang-switch: shows the other language ("ES" / "EN"); hidden when the choice could not be saved. */
export function mountLanguageSwitch(button) {
  if (!button || !storage) return;
  const other = SUPPORTED_LANGS.find((lang) => lang !== LANG);
  const code = other.toUpperCase();
  button.textContent = code;
  button.lang = other;
  button.title = STRINGS[other].switchLanguage;
  button.setAttribute('aria-label', `${code}: ${STRINGS[other].switchLanguage}`);
  button.addEventListener('click', () => {
    if (writeJson(storage, LANG_STORAGE_KEY, other)) window.location.reload();
  });
  button.hidden = false;
}
