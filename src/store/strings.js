// Store texts, one table per language (strings/en.js, strings/es.js), with the same keys in both
// (tests/store/strings.test.js checks it). lang.js picks the table of the page language.

import { EN } from './strings/en.js';
import { ES } from './strings/es.js';

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const STRINGS = deepFreeze({ en: EN, es: ES });
