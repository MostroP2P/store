import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containRect, layoutImageText, MAX_IMAGE_SHARE } from '../src/layouts.js';

const AREA = { x: 100, y: 50, width: 400, height: 600 };
const measureAt = (size) => (str) => str.length * size * 0.5;
const STYLE = {
  imageWidth: 0.5,
  textPosition: 'below',
  gap: 20,
  maxLines: 2,
  maxFontSize: 60,
  minFontSize: 20,
  lineHeight: 1,
};

test('containRect fits a tall image by height and centers it horizontally', () => {
  assert.deepEqual(containRect({ width: 100, height: 300 }, AREA), { x: 200, y: 50, width: 200, height: 600 });
});

test('containRect fits a wide image by width and aligns it to the top', () => {
  assert.deepEqual(containRect({ width: 800, height: 400 }, AREA), { x: 100, y: 50, width: 400, height: 200 });
});

test('containRect can center the image vertically', () => {
  const rect = containRect({ width: 800, height: 400 }, AREA, { align: 'center' });
  assert.equal(rect.y, 250);
});

test('layoutImageText puts the image on top and the text below it', () => {
  const layout = layoutImageText({ area: AREA, imageSize: { width: 512, height: 512 }, text: 'GM', style: STYLE, measureAt });
  assert.deepEqual(layout.image, { x: 200, y: 50, width: 200, height: 200 });
  assert.equal(layout.text.x, 300);
  assert.equal(layout.text.y, 270);
  assert.equal(layout.text.fontSize, 60);
  assert.deepEqual(layout.text.lines, ['GM']);
});

test('layoutImageText puts the text above the image when asked', () => {
  const style = { ...STYLE, textPosition: 'above' };
  const layout = layoutImageText({ area: AREA, imageSize: { width: 512, height: 512 }, text: 'GM', style, measureAt });
  assert.equal(layout.text.y, 50);
  assert.equal(layout.image.y, 130);
});

test('layoutImageText caps the image height to a share of the area', () => {
  const layout = layoutImageText({ area: AREA, imageSize: { width: 100, height: 1000 }, text: 'GM', style: STYLE, measureAt });
  assert.equal(layout.image.height, AREA.height * MAX_IMAGE_SHARE);
  assert.equal(layout.image.width, 45);
  assert.equal(layout.image.x, 277.5);
});

test('layoutImageText gives the text only the height left under the image', () => {
  const style = { ...STYLE, imageWidth: 1, maxFontSize: 400, maxLines: 4 };
  const layout = layoutImageText({ area: AREA, imageSize: { width: 512, height: 512 }, text: 'stack sats stay humble', style, measureAt });
  const available = AREA.height - layout.image.height - STYLE.gap;
  assert.ok(layout.text.height <= available, `${layout.text.height} > ${available}`);
  assert.equal(layout.text.overflow, false);
});

test('layoutImageText without text returns only the image', () => {
  const layout = layoutImageText({ area: AREA, imageSize: { width: 512, height: 512 }, text: '', style: STYLE, measureAt });
  assert.equal(layout.text, null);
  assert.equal(layout.image.y, 50);
});
