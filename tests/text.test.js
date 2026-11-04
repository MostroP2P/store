import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapText, balanceLines, fitText } from '../src/text.js';

// Every character is 10px wide
const measure10 = (str) => str.length * 10;
// Every character is half the font size wide
const measureAt = (size) => (str) => str.length * size * 0.5;

const fitDefaults = {
  maxWidth: 500,
  maxHeight: 500,
  maxLines: 2,
  maxFontSize: 96,
  minFontSize: 28,
  lineHeight: 1,
  measureAt,
};

test('wrapText keeps the text on one line when it fits', () => {
  assert.deepEqual(wrapText('love at first sat', 1000, measure10), ['love at first sat']);
});

test('wrapText breaks greedily at word boundaries', () => {
  assert.deepEqual(wrapText('love at first sat', 100, measure10), ['love at', 'first sat']);
});

test('wrapText honors manual line breaks', () => {
  assert.deepEqual(wrapText('GM\nfrens', 1000, measure10), ['GM', 'frens']);
});

test('wrapText leaves a word wider than the line on its own line', () => {
  assert.deepEqual(wrapText('a supercalifragilistic b', 100, measure10), ['a', 'supercalifragilistic', 'b']);
});

test('wrapText collapses repeated whitespace', () => {
  assert.deepEqual(wrapText('  hello   world ', 1000, measure10), ['hello world']);
});

test('balanceLines evens out the line lengths', () => {
  assert.deepEqual(wrapText('love at first sat', 130, measure10), ['love at first', 'sat']);
  assert.deepEqual(balanceLines('love at first sat', 130, measure10), ['love at', 'first sat']);
});

test('balanceLines leaves single lines alone', () => {
  assert.deepEqual(balanceLines('GM', 500, measure10), ['GM']);
});

test('fitText uses the largest size when the text already fits', () => {
  const result = fitText({ ...fitDefaults, text: 'GM' });
  assert.equal(result.fontSize, 96);
  assert.deepEqual(result.lines, ['GM']);
  assert.equal(result.overflow, false);
});

test('fitText shrinks the font until the text fits in maxLines', () => {
  const result = fitText({ ...fitDefaults, text: 'love at first sat', maxWidth: 300 });
  assert.equal(result.fontSize, 66);
  assert.deepEqual(result.lines, ['love at', 'first sat']);
  assert.equal(result.overflow, false);
});

test('fitText respects the available height', () => {
  const result = fitText({ ...fitDefaults, text: 'GM', maxHeight: 50 });
  assert.equal(result.fontSize, 50);
});

test('fitText always tries the minimum size even when the step skips it', () => {
  const result = fitText({ ...fitDefaults, text: 'GM', maxFontSize: 31, minFontSize: 28, maxHeight: 28.5 });
  assert.equal(result.fontSize, 28);
  assert.equal(result.overflow, false);
});

test('fitText flags overflow when even the minimum size does not fit', () => {
  const result = fitText({ ...fitDefaults, text: 'x'.repeat(100), maxWidth: 100 });
  assert.equal(result.fontSize, 28);
  assert.equal(result.overflow, true);
});

test('fitText reports line height and total height', () => {
  const result = fitText({ ...fitDefaults, text: 'GM\nfrens', lineHeight: 1.25 });
  assert.equal(result.lineHeightPx, result.fontSize * 1.25);
  assert.equal(result.height, result.lineHeightPx * 2);
});

test('fitText returns no lines for empty text', () => {
  const result = fitText({ ...fitDefaults, text: '   ' });
  assert.deepEqual(result.lines, []);
  assert.equal(result.height, 0);
  assert.equal(result.overflow, false);
});
