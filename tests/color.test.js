import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHex,
  isHexColor,
  relativeLuminance,
  contrastRatio,
  autoTextColor,
  TEXT_LIGHT,
  TEXT_DARK,
} from '../src/color.js';

test('parseHex reads #rrggbb in any letter case', () => {
  assert.deepEqual(parseHex('#FF8000'), { r: 255, g: 128, b: 0 });
  assert.deepEqual(parseHex('#0a0b0c'), { r: 10, g: 11, b: 12 });
});

test('parseHex returns null for anything that is not #rrggbb', () => {
  for (const bad of ['ff8000', '#fff', '#gg0000', '#ff80001', '', null, undefined, 42]) {
    assert.equal(parseHex(bad), null, `expected null for ${String(bad)}`);
  }
});

test('isHexColor mirrors parseHex', () => {
  assert.equal(isHexColor('#123abc'), true);
  assert.equal(isHexColor('#123'), false);
});

test('relativeLuminance is 0 for black and 1 for white', () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
});

test('contrastRatio of white on black is 21 and symmetric', () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  assert.equal(contrastRatio(white, black), 21);
  assert.equal(contrastRatio(black, white), 21);
});

test('autoTextColor picks light text on dark shirts', () => {
  for (const hex of ['#1a1a1a', '#1b2340', '#c81e28', '#1e3ca0', '#28783c']) {
    assert.equal(autoTextColor(hex), TEXT_LIGHT, hex);
  }
});

test('autoTextColor picks dark text on light shirts', () => {
  for (const hex of ['#f0f0ec', '#f5cd28', '#f7931a', '#8a8a8a']) {
    assert.equal(autoTextColor(hex), TEXT_DARK, hex);
  }
});

test('autoTextColor falls back to light text for an invalid color', () => {
  assert.equal(autoTextColor('not-a-color'), TEXT_LIGHT);
});
