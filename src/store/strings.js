// Store texts, one table per language (strings/en.js, es.js, fr.js, it.js, pt.js), all with the keys of the
// English one (tests/store/strings.test.js checks it). lang.js picks the table of the page language.

import { EN } from './strings/en.js';
import { ES } from './strings/es.js';
import { FR } from './strings/fr.js';
import { IT } from './strings/it.js';
import { PT } from './strings/pt.js';

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const STRINGS = deepFreeze({ en: EN, es: ES, fr: FR, it: IT, pt: PT });
