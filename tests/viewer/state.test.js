import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, toHash, resolveColor, DEFAULT_FILTER } from '../../src/viewer/state.js';

const COLORS = [
  { id: 'black', name: 'Negro', hex: '#1a1a1a' },
  { id: 'red', name: 'Rojo', hex: '#c81e28' },
];
const KNOWN = {
  colorIds: COLORS.map((c) => c.id),
  productIds: ['a', 'b'],
  filterIds: ['designs', 'mostro-quotes'],
};

test('parseHash returns defaults for an empty hash', () => {
  assert.deepEqual(parseHash('', KNOWN), { color: 'black', filter: DEFAULT_FILTER, shirt: null });
});

test('parseHash reads a known color, filter and shirt', () => {
  assert.deepEqual(parseHash('#color=red&filter=mostro-quotes&shirt=b', KNOWN), {
    color: 'red',
    filter: 'mostro-quotes',
    shirt: 'b',
  });
});

test('parseHash accepts a custom hex color with or without #', () => {
  assert.equal(parseHash('#color=ff00aa', KNOWN).color, '#ff00aa');
  assert.equal(parseHash('#color=%23FF00AA', KNOWN).color, '#ff00aa');
});

test('parseHash ignores unknown values', () => {
  assert.deepEqual(parseHash('#color=purple&filter=nope&shirt=zzz', KNOWN), {
    color: 'black',
    filter: DEFAULT_FILTER,
    shirt: null,
  });
});

test('toHash omits default values and strips # from custom colors', () => {
  assert.equal(toHash({ color: 'black', filter: DEFAULT_FILTER, shirt: null }), 'color=black');
  assert.equal(toHash({ color: '#ff00aa', filter: 'designs', shirt: 'a' }), 'color=ff00aa&filter=designs&shirt=a');
});

test('toHash and parseHash round-trip', () => {
  const state = { color: 'red', filter: 'mostro-quotes', shirt: 'a' };
  assert.deepEqual(parseHash(`#${toHash(state)}`, KNOWN), state);
});

test('resolveColor returns the catalog color for a known id', () => {
  assert.deepEqual(resolveColor('red', COLORS), { key: 'red', hex: '#c81e28', isCustom: false });
});

test('resolveColor returns a custom color for a hex value', () => {
  assert.deepEqual(resolveColor('#ff00aa', COLORS), { key: 'ff00aa', hex: '#ff00aa', isCustom: true });
});

test('resolveColor falls back to the first catalog color', () => {
  assert.deepEqual(resolveColor('nope', COLORS), { key: 'black', hex: '#1a1a1a', isCustom: false });
});
