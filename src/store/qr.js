// Styled QR (pure): rounded modules and finder eyes, and a cleared center for the Mostro logo.
// Based on buildStyledQr from MostroP2P.github.io (src/utils/lightningQr.ts), tuned so every QR version
// decodes: rounded squares instead of dots, solid alignment patterns, no logo over an alignment pattern.

import qrcode from '../vendor/qrcode-generator.js';

/** Modules of white margin around the code inside the SVG viewBox (4 per the QR spec: the page around it is dark). */
export const QUIET_ZONE = 4;
const FINDER_SIZE = 7;
// Data modules: rounded squares filling 90% of the module. Round dots looked the same but some QR
// versions stopped decoding (checked with jsQR across versions 10–21); squares decode in all of them.
const MODULE_SIZE = 0.9;
const MODULE_CORNER = 0.25;
const BIG_CODE_MODULES = 33;
const ALIGNMENT_RADIUS = 2;
const VERSION_32 = 32;
const VERSION_32_STEP = 26;

const round = (value) => Math.round(value * 1000) / 1000;

function roundedRect(x, y, w, h, r) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}`
    + `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`
    + `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

const SIDE = round(MODULE_SIZE - 2 * MODULE_CORNER);
const CORNER = `a${MODULE_CORNER} ${MODULE_CORNER} 0 0 1`;
const MODULE_PATH = `h${SIDE}${CORNER} ${MODULE_CORNER} ${MODULE_CORNER}v${SIDE}${CORNER} -${MODULE_CORNER} ${MODULE_CORNER}`
  + `h-${SIDE}${CORNER} -${MODULE_CORNER} -${MODULE_CORNER}v-${SIDE}${CORNER} ${MODULE_CORNER} -${MODULE_CORNER}z`;
const MODULE_INSET = (1 - MODULE_SIZE) / 2;

/** One dark data module at (x, y), as a rounded square. */
function dot(x, y) {
  return `M${round(x + MODULE_INSET + MODULE_CORNER)} ${round(y + MODULE_INSET)}${MODULE_PATH}`;
}

/**
 * Centers [row, col] of the alignment patterns of a QR `version` (same positions as the ISO 18004 table).
 * Scanners rely on them, so the logo must never hide one.
 */
export function alignmentCenters(version) {
  if (version < 2) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === VERSION_32 ? VERSION_32_STEP : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const last = version * 4 + 10;
  const positions = [6, ...Array.from({ length: count - 1 }, (_, i) => last - (count - 2 - i) * step)];
  const finders = new Set([`6,6`, `6,${last}`, `${last},6`]);
  return positions.flatMap((r) => positions.map((c) => [r, c])).filter(([r, c]) => !finders.has(`${r},${c}`));
}

/** Square of modules cleared for the logo, or null when it would cover an alignment pattern. */
function logoArea(n) {
  const modules = n >= BIG_CODE_MODULES ? 9 : 7;
  const start = Math.floor((n - modules) / 2);
  const end = start + modules - 1;
  const hidesAlignment = alignmentCenters((n - 17) / 4).some(([r, c]) => r + ALIGNMENT_RADIUS >= start
    && r - ALIGNMENT_RADIUS <= end && c + ALIGNMENT_RADIUS >= start && c - ALIGNMENT_RADIUS <= end);
  return hidesAlignment ? null : { modules, start, end };
}

/**
 * SVG paths for `data`. mode 'Alphanumeric' gives a smaller code for upper-cased BOLT11 invoices.
 * Error correction H (default) or Q still scans with the center modules removed for the logo.
 * logoAspect = logo width / height.
 * Returns { size, dots, eyesOuter, eyesInner, logo: { x, y, width, height } | null } in module units
 * (logo is null when it would hide an alignment pattern: the code is then drawn without it).
 */
export function buildStyledQr(data, { mode = 'Byte', errorCorrection = 'H', logoAspect = 1, withLogo = true } = {}) {
  const qr = qrcode(0, errorCorrection);
  qr.addData(data, mode);
  qr.make();

  const n = qr.getModuleCount();
  const area = withLogo ? logoArea(n) : null;
  const alignments = alignmentCenters((n - 17) / 4);
  const inFinder = (x, y) => (x < FINDER_SIZE && y < FINDER_SIZE)
    || (x >= n - FINDER_SIZE && y < FINDER_SIZE)
    || (x < FINDER_SIZE && y >= n - FINDER_SIZE);
  const inLogo = (x, y) => area !== null && x >= area.start && x <= area.end && y >= area.start && y <= area.end;
  const inAlignment = (x, y) => alignments.some(([r, c]) => Math.abs(x - c) <= ALIGNMENT_RADIUS && Math.abs(y - r) <= ALIGNMENT_RADIUS);

  const indexes = Array.from({ length: n }, (_, i) => i);
  const dots = indexes.flatMap((y) => indexes
    .filter((x) => qr.isDark(y, x) && !inFinder(x, y) && !inLogo(x, y) && !inAlignment(x, y))
    .map((x) => dot(x + QUIET_ZONE, y + QUIET_ZONE))).join('');

  const finderOrigins = [[0, 0], [n - FINDER_SIZE, 0], [0, n - FINDER_SIZE]];
  const finders = finderOrigins.map(([fx, fy]) => {
    const x = fx + QUIET_ZONE;
    const y = fy + QUIET_ZONE;
    return roundedRect(x, y, 7, 7, 2.2) + roundedRect(x + 1, y + 1, 5, 5, 1.4);
  });
  // Alignment patterns drawn solid (ring + center) like small eyes: as loose dots, scanners miss them
  const solidAlignments = alignments.map(([r, c]) => {
    const x = c + QUIET_ZONE;
    const y = r + QUIET_ZONE;
    return roundedRect(x - 2, y - 2, 5, 5, 1.2) + roundedRect(x - 1, y - 1, 3, 3, 0.6) + roundedRect(x, y, 1, 1, 0.3);
  });
  const eyesOuter = [...finders, ...solidAlignments].join('');
  const eyesInner = finderOrigins
    .map(([fx, fy]) => roundedRect(fx + QUIET_ZONE + 2, fy + QUIET_ZONE + 2, 3, 3, 1))
    .join('');

  return { size: n + 2 * QUIET_ZONE, dots, eyesOuter, eyesInner, logo: area && logoBox(n, area.modules, logoAspect) };
}

function logoBox(n, modules, logoAspect) {
  const height = modules - 1.4;
  const width = height * logoAspect;
  const center = QUIET_ZONE + n / 2;
  return { x: round(center - width / 2), y: round(center - height / 2), width: round(width), height: round(height) };
}
