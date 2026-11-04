import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, writeJson, removeKey } from '../../src/store/persist.js';

const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
};

const brokenStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

test('readJson parses stored JSON', () => {
  assert.deepEqual(readJson(memoryStorage({ k: '{"a":1}' }), 'k', null), { a: 1 });
});

test('readJson returns the fallback for missing, corrupt or unavailable storage', () => {
  assert.equal(readJson(memoryStorage(), 'k', 'fallback'), 'fallback');
  assert.equal(readJson(memoryStorage({ k: '{nope' }), 'k', 'fallback'), 'fallback');
  assert.equal(readJson(brokenStorage, 'k', 'fallback'), 'fallback');
  assert.equal(readJson(null, 'k', 'fallback'), 'fallback');
});

test('writeJson stores JSON and reports failures instead of throwing', () => {
  const storage = memoryStorage();
  assert.equal(writeJson(storage, 'k', { a: 1 }), true);
  assert.equal(storage.data.get('k'), '{"a":1}');
  assert.equal(writeJson(brokenStorage, 'k', { a: 1 }), false);
  assert.equal(writeJson(null, 'k', { a: 1 }), false);
});

test('removeKey deletes a key and never throws', () => {
  const storage = memoryStorage({ k: '1' });
  removeKey(storage, 'k');
  assert.equal(storage.data.has('k'), false);
  assert.doesNotThrow(() => removeKey(brokenStorage, 'k'));
  assert.doesNotThrow(() => removeKey(null, 'k'));
});
