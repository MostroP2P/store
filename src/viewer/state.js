// View state <-> URL hash (pure). Example: #color=red&filter=mostro-quotes&shirt=mostro-invaders

import { ALL_GROUP_ID } from '../catalog.js';

export const DEFAULT_FILTER = ALL_GROUP_ID;

const CUSTOM_HEX = /^#?([0-9a-f]{6})$/i;

const customHex = (value) => {
  const match = CUSTOM_HEX.exec(value ?? '');
  return match ? match[1].toLowerCase() : null;
};

const pick = (value, allowed, fallback) => (value !== null && allowed.includes(value) ? value : fallback);

function parseColor(value, colorIds) {
  if (value !== null && colorIds.includes(value)) return value;
  const hex = customHex(value);
  return hex ? `#${hex}` : colorIds[0];
}

/** Reads the hash, dropping any value that does not exist in the catalog. */
export function parseHash(hash, { colorIds, productIds, filterIds }) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  return {
    color: parseColor(params.get('color'), colorIds),
    filter: pick(params.get('filter'), [DEFAULT_FILTER, ...filterIds], DEFAULT_FILTER),
    shirt: pick(params.get('shirt'), productIds, null),
  };
}

/** Builds the hash (without "#"), leaving out default values. */
export function toHash({ color, filter, shirt }) {
  const params = new URLSearchParams({ color: color.replace(/^#/, '') });
  if (filter && filter !== DEFAULT_FILTER) params.set('filter', filter);
  if (shirt) params.set('shirt', shirt);
  return params.toString();
}

/** Color id or custom "#rrggbb" → { key (for file names), hex, isCustom }. */
export function resolveColor(value, colors) {
  const known = colors.find((color) => color.id === value);
  if (known) return { key: known.id, hex: known.hex, isCustom: false };
  const hex = customHex(value);
  if (hex) return { key: hex, hex: `#${hex}`, isCustom: true };
  return { key: colors[0].id, hex: colors[0].hex, isCustom: false };
}
