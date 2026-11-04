import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luminance, computeLevels, boxBlur, buildShadingMaps } from '../src/shading.js';

const rgba = (pixels) => Uint8ClampedArray.from(pixels.flat());
const gray = (v, a = 255) => [v, v, v, a];
const channel = (data, pixel) => data[pixel * 4];

test('luminance uses Rec. 601 weights', () => {
  assert.equal(Math.round(luminance(255, 255, 255)), 255);
  assert.equal(Math.round(luminance(255, 0, 0)), 76);
});

test('computeLevels takes percentiles over opaque pixels only', () => {
  const opaque = Array.from({ length: 100 }, (_, v) => gray(v));
  const transparent = Array.from({ length: 50 }, () => gray(255, 0));
  assert.deepEqual(computeLevels(rgba([...opaque, ...transparent])), { lo: 0, med: 49, hi: 98 });
});

test('computeLevels keeps hi above lo for a flat image', () => {
  assert.deepEqual(computeLevels(rgba([gray(20), gray(20), gray(20)])), { lo: 20, med: 20, hi: 21 });
});

test('computeLevels falls back to the full range when nothing is opaque', () => {
  assert.deepEqual(computeLevels(rgba([gray(20, 0)])), { lo: 0, med: 128, hi: 255 });
});

test('boxBlur spreads a spike to its neighbors', () => {
  const blurred = boxBlur(Float32Array.from([0, 0, 9, 0, 0]), 5, 1, 1);
  assert.deepEqual(Array.from(blurred), [0, 3, 3, 3, 0]);
});

test('boxBlur keeps flat regions flat and does not modify its input', () => {
  const input = Float32Array.from([5, 5, 5, 5, 5, 5]);
  const blurred = boxBlur(input, 3, 2, 2);
  assert.deepEqual(Array.from(blurred), [5, 5, 5, 5, 5, 5]);
  assert.notEqual(blurred, input);
});

test('boxBlur with radius 0 returns an unchanged copy', () => {
  const input = Float32Array.from([1, 2, 3]);
  const blurred = boxBlur(input, 3, 1, 0);
  assert.deepEqual(Array.from(blurred), [1, 2, 3]);
  assert.notEqual(blurred, input);
});

test('buildShadingMaps darkens folds and lights up highlights', () => {
  const data = rgba([gray(10), gray(20), gray(30)]);
  const { shade, highlight } = buildShadingMaps(data, 3, 1, { blur: 0, shadowFloor: 0.5, highlight: 0.2 });
  assert.deepEqual([0, 1, 2].map((p) => channel(shade, p)), [128, 191, 255]);
  assert.deepEqual([0, 1, 2].map((p) => channel(highlight, p)), [0, 0, 51]);
  assert.equal(shade[3], 255);
  assert.equal(highlight[3], 255);
});

test('buildShadingMaps treats transparent pixels as the median tone', () => {
  const data = rgba([gray(10), gray(20), gray(30), gray(0, 0)]);
  const { shade } = buildShadingMaps(data, 4, 1, { blur: 0, shadowFloor: 0.5, highlight: 0.2 });
  assert.equal(channel(shade, 3), channel(shade, 1));
});
