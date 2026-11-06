// Page language (browser): the visitor's choice, else the browser's language, else English (i18n.js).
// T holds the texts of that language. translatePage() fills the static texts of the HTML (data-i18n) and
// mountLanguageSwitch() wires the language picker in the header (saves the choice and reloads the page).

import { pickLanguage, SUPPORTED_LANGS } from '../i18n.js';
import { el } from '../dom.js';
import { browserStorage, readJson, writeJson } from './persist.js';
import { STRINGS } from './strings.js';

export const LANG_STORAGE_KEY = 'mostro-store:lang';
// Static texts stay hidden (CSS) until this class is set, so a visitor in another language never sees them flip from English
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

/**
 * The language picker: #lang-switch, a button with the code of the page language ("EN ▾"), opens a list
 * naming every language in its own name. Only choosing one saves it and reloads the page, so moving through
 * the list never does. Hidden when the choice could not be saved.
 */
export function mountLanguageSwitch(button) {
  const picker = button?.closest('.lang-switch');
  if (!picker || !storage) return;
  const list = picker.querySelector('.lang-list');
  const setOpen = (open) => {
    list.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  // Leaves the page as it is: a disabled picker (checkout locks it while an invoice is in flight or confirmed,
  // and a late confirmation can lock it with the list open), the language already shown, or one not saved
  const choose = (lang) => {
    if (!button.disabled && lang !== LANG && writeJson(storage, LANG_STORAGE_KEY, lang)) window.location.reload();
    else setOpen(false);
  };
  list.replaceChildren(...SUPPORTED_LANGS.map((lang) => el('li', {}, [el('button', {
    type: 'button', lang, textContent: STRINGS[lang].languageName,
    'aria-current': lang === LANG ? 'true' : undefined, onclick: () => choose(lang),
  })])));
  button.querySelector('.lang-switch-code').textContent = LANG.toUpperCase();
  button.setAttribute('aria-label', `${T.language}: ${T.languageName}`);
  button.addEventListener('click', () => setOpen(list.hidden));
  // Closed by Escape (the focus goes back to the button), by a click elsewhere and by tabbing out of it
  picker.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || list.hidden) return;
    setOpen(false);
    button.focus();
  });
  document.addEventListener('click', (event) => {
    if (!picker.contains(event.target)) setOpen(false);
  });
  picker.addEventListener('focusout', (event) => {
    if (!picker.contains(event.relatedTarget)) setOpen(false);
  });
  picker.hidden = false;
}
