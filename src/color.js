// Color helpers (pure): hex parsing, WCAG luminance/contrast and automatic text color.

export const TEXT_LIGHT = '#ffffff';
export const TEXT_DARK = '#111111';

const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const LUMINANCE_PRECISION = 1e6;
const CONTRAST_PRECISION = 100;

/** Parses "#rrggbb" into { r, g, b }, or returns null when the value is not a 6-digit hex color. */
export function parseHex(value) {
  if (typeof value !== 'string') return null;
  const match = HEX_PATTERN.exec(value);
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return { r, g, b };
}

export const isHexColor = (value) => parseHex(value) !== null;

const toLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, from 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }) {
  const value = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return Math.round(value * LUMINANCE_PRECISION) / LUMINANCE_PRECISION;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  const ratio = (light + 0.05) / (dark + 0.05);
  return Math.round(ratio * CONTRAST_PRECISION) / CONTRAST_PRECISION;
}

/** Light or dark text, whichever contrasts more with the shirt color. */
export function autoTextColor(shirtHex) {
  const shirt = parseHex(shirtHex);
  if (!shirt) return TEXT_LIGHT;
  const light = contrastRatio(parseHex(TEXT_LIGHT), shirt);
  const dark = contrastRatio(parseHex(TEXT_DARK), shirt);
  return light >= dark ? TEXT_LIGHT : TEXT_DARK;
}
