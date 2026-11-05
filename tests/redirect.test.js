import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyTarget, parseRenames } from '../src/redirect.js';

test('an old page sends the visitor to its new name, with the query and the hash', () => {
  assert.equal(legacyTarget('viewer.html', '?debug', '#shirt=love&color=red', {}), 'viewer.html?debug#shirt=love&color=red');
  assert.equal(legacyTarget('viewer.html', '', '', {}), 'viewer.html');
});

test('renamed query parameters are carried over to their new name', () => {
  assert.equal(
    legacyTarget('product.html', '?id=love&color=red&talle=M', '', { talle: 'size' }),
    'product.html?id=love&color=red&size=M',
  );
  assert.equal(legacyTarget('product.html', '?id=love', '', { talle: 'size' }), 'product.html?id=love');
});

test('a parameter already under its new name is not overwritten by the old one', () => {
  assert.equal(legacyTarget('product.html', '?talle=M&size=S', '', { talle: 'size' }), 'product.html?size=S');
});

test('only plain page names are accepted as targets', () => {
  ['https://evil.example/', '//evil.example', 'javascript:alert(1)', '../product.html', '', undefined].forEach((target) => {
    assert.throws(() => legacyTarget(target, '', '', {}), /target/, target);
  });
});

test('parseRenames reads "old:new" pairs and ignores malformed ones', () => {
  assert.deepEqual(parseRenames('talle:size'), { talle: 'size' });
  assert.deepEqual(parseRenames('a:b c:d'), { a: 'b', c: 'd' });
  assert.deepEqual(parseRenames('nope :x y:'), {});
  assert.deepEqual(parseRenames(undefined), {});
});
