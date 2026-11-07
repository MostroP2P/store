import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWER_SCALE, ZOOM_FACTOR, pointOn, scrollToKeep } from '../../src/store/zoom.js';

const RECT = { left: 100, top: 50, width: 400, height: 500 };

test('the enlarged image is drawn at a higher scale than the product page', () => {
  assert.ok(VIEWER_SCALE > 1);
  assert.ok(ZOOM_FACTOR > 1);
});

test('a point on the image is where it falls, as fractions of its width and height', () => {
  assert.deepEqual(pointOn({ x: 200, y: 175 }, RECT), { x: 0.25, y: 0.25 });
  assert.deepEqual(pointOn({ x: 500, y: 550 }, RECT), { x: 1, y: 1 });
});

test('a point off the image counts as its nearest edge', () => {
  assert.deepEqual(pointOn({ x: 90, y: 600 }, RECT), { x: 0, y: 1 });
});

test('an image with no size is taken at its centre', () => {
  assert.deepEqual(pointOn({ x: 10, y: 10 }, { left: 0, top: 0, width: 0, height: 0 }), { x: 0.5, y: 0.5 });
});

test('the scroll puts the same point of the zoomed image back under the anchor', () => {
  const image = { left: 0, top: 0, width: 1000, height: 1250 };
  assert.deepEqual(scrollToKeep({ x: 0.6, y: 0.4 }, image, { x: 300, y: 200 }), { left: 300, top: 300 });
});

test('the scroll counts where the zoomed image starts in the scrolled content', () => {
  const image = { left: 40, top: 10, width: 1000, height: 1250 };
  assert.deepEqual(scrollToKeep({ x: 0.5, y: 0.5 }, image, { x: 200, y: 300 }), { left: 340, top: 335 });
});

test('the scroll never goes before the start of the content', () => {
  const image = { left: 0, top: 0, width: 1000, height: 1250 };
  assert.deepEqual(scrollToKeep({ x: 0.1, y: 0.1 }, image, { x: 300, y: 400 }), { left: 0, top: 0 });
});
