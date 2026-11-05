import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeLines, lineCoverage, mergeEntries } from './e2e/lines.js';

const SOURCE = [
  '// a comment',
  'export function used(x) {',
  '  if (x) {',
  '    return 1;',
  '  }',
  '',
  '  /* block',
  '     comment */',
  '  return 2;',
  '}',
  'export function unused() {',
  '  return 3;',
  '}',
].join('\n');

const offset = (line) => SOURCE.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
// The script ran; used() ran with x falsy (its "if" block did not); unused() never ran
const FUNCTIONS = [
  { ranges: [{ startOffset: 0, endOffset: SOURCE.length, count: 1 }] },
  { ranges: [
    { startOffset: offset(2), endOffset: offset(11) - 1, count: 1 },
    { startOffset: offset(3) + 8, endOffset: offset(6) - 1, count: 0 },
  ] },
  { ranges: [{ startOffset: offset(11), endOffset: SOURCE.length, count: 0 }] },
];

test('codeLines skips blank lines and comments', () => {
  assert.deepEqual(codeLines(SOURCE), [2, 3, 4, 5, 9, 10, 11, 12, 13]);
});

test('lineCoverage marks the lines where code ran, an inner range overriding the outer one', () => {
  const { lines, covered } = lineCoverage(SOURCE, FUNCTIONS);
  assert.equal(lines.length, 9);
  assert.deepEqual(covered, [2, 3, 9, 10]);
});

test('mergeEntries joins the lines covered by several pages', () => {
  const ranAll = [{ ranges: [{ startOffset: 0, endOffset: SOURCE.length, count: 1 }] }];
  const files = mergeEntries([
    { path: '/src/a.js', source: SOURCE, functions: FUNCTIONS },
    { path: '/src/a.js', source: SOURCE, functions: ranAll },
  ]);
  assert.equal(files.get('/src/a.js').covered.size, 9);
});
