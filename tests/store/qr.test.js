import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStyledQr, alignmentCenters, QUIET_ZONE } from '../../src/store/qr.js';

// Version 14 at level Q: no alignment pattern under the centered logo
const INVOICE_URI = `LIGHTNING:LNBC${'Q'.repeat(340)}`;

test('builds a square code with a quiet zone, finder eyes and a centered logo', () => {
  const qr = buildStyledQr(INVOICE_URI, { mode: 'Alphanumeric', errorCorrection: 'Q' });
  const modules = qr.size - 2 * QUIET_ZONE;
  assert.ok(modules >= 21 && (modules - 17) % 4 === 0, `invalid QR size ${modules}`);
  assert.ok(qr.dots.length > 1000);
  // 3 finders × 2 rings, plus 3 subpaths (ring + center) per alignment pattern
  const version = (modules - 17) / 4;
  assert.equal((qr.eyesOuter.match(/M/g) ?? []).length, 6 + 3 * alignmentCenters(version).length);
  assert.equal((qr.eyesInner.match(/M/g) ?? []).length, 3);
  const center = qr.size / 2;
  assert.ok(Math.abs(qr.logo.x + qr.logo.width / 2 - center) < 0.01);
  assert.ok(Math.abs(qr.logo.y + qr.logo.height / 2 - center) < 0.01);
});

test('is deterministic', () => {
  assert.deepEqual(buildStyledQr('hola'), buildStyledQr('hola'));
});

test('uses a smaller logo on small codes', () => {
  const small = buildStyledQr('MS-1');
  const big = buildStyledQr(INVOICE_URI, { mode: 'Alphanumeric', errorCorrection: 'Q' });
  assert.ok(small.logo.height < big.logo.height);
});

test('alignmentCenters matches the QR spec table', async () => {
  const { alignmentCenters } = await import('../../src/store/qr.js');
  assert.deepEqual(alignmentCenters(1), []);
  assert.deepEqual(alignmentCenters(2), [[18, 18]]);
  // v7: positions 6, 22, 38 → 9 combinations minus the 3 finder corners
  const v7 = alignmentCenters(7);
  assert.equal(v7.length, 6);
  assert.deepEqual(v7.find(([r, c]) => r === 22 && c === 22), [22, 22]);
  // v12: 6, 32, 58 · v18: 6, 30, 56, 82 · v32 uses the special step 26: 6, 34, 60, 86, 112, 138
  assert.ok(alignmentCenters(12).some(([r, c]) => r === 32 && c === 32));
  assert.deepEqual([...new Set(alignmentCenters(18).map(([r]) => r))].sort((a, b) => a - b), [6, 30, 56, 82]);
  assert.deepEqual([...new Set(alignmentCenters(32).map(([r]) => r))].sort((a, b) => a - b), [6, 34, 60, 86, 112, 138]);
});

test('drops the logo when it would hide an alignment pattern (it breaks scanning)', () => {
  const version = (qr) => (qr.size - 2 * QUIET_ZONE - 17) / 4;
  // ~282 alphanumeric chars at level Q → version 12, whose central alignment pattern sits under the logo
  const v12 = buildStyledQr(`LIGHTNING:LNBC${'Q'.repeat(268)}`, { mode: 'Alphanumeric', errorCorrection: 'Q' });
  assert.equal(version(v12), 12);
  assert.equal(v12.logo, null);
  const v14 = buildStyledQr(`LIGHTNING:LNBC${'Q'.repeat(340)}`, { mode: 'Alphanumeric', errorCorrection: 'Q' });
  assert.equal(version(v14), 14);
  assert.notEqual(v14.logo, null);
});
