// The tab and home-screen icons. Browsers, crawlers and feed readers ask for /favicon.ico without reading
// any HTML, so the icons live at the root of the site; every page also declares them, and the deploy has
// to publish them, or the site answers 404 for its own logo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT));

const FAVICON = 'favicon.ico';
const TOUCH_ICON = 'apple-touch-icon.png';
const FAVICON_SIZES = [16, 32, 48];
const TOUCH_ICON_SIZE = 180;
const ICO_TYPE_ICON = 1;
const PNG_COLOR_RGB = 2;
const PNG_COLOR_PALETTE = 3;

/** The width and height of every image in an .ico file (a stored 0 means 256). */
function icoSizes(buffer) {
  assert.equal(buffer.readUInt16LE(0), 0, 'reserved');
  assert.equal(buffer.readUInt16LE(2), ICO_TYPE_ICON, 'an icon, not a cursor');
  const count = buffer.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    return [buffer[entry] || 256, buffer[entry + 1] || 256];
  });
}

/** Width, height and colour type from a PNG's IHDR, and the types of all its chunks. */
function pngInfo(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('latin1'), 'PNG');
  const chunks = [];
  for (let offset = 8; offset < buffer.length; offset += 12 + buffer.readUInt32BE(offset)) {
    chunks.push(buffer.subarray(offset + 4, offset + 8).toString('latin1'));
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorType: buffer[25], chunks };
}

test('every page, the generated product pages included, declares the Mostro logo icons and no other', async () => {
  const pages = (await readdir(ROOT)).filter((name) => name.endsWith('.html'));
  assert.ok(pages.includes('index.html') && pages.includes('viewer.html'));
  for (const page of pages) {
    const html = (await read(page)).toString('utf8');
    const icons = [...html.matchAll(/<link rel="(icon|apple-touch-icon)" href="([^"]*)">/g)].map((match) => match.slice(1));
    assert.deepEqual(icons, [['icon', FAVICON], ['apple-touch-icon', TOUCH_ICON]], page);
  }
});

test('favicon.ico holds square images for the tab, at 16, 32 and 48 pixels', async () => {
  assert.deepEqual(icoSizes(await read(FAVICON)), FAVICON_SIZES.map((size) => [size, size]));
});

test('the home-screen icon is a square 180-pixel PNG without transparency, which iOS would paint black', async () => {
  const { width, height, colorType, chunks } = pngInfo(await read(TOUCH_ICON));
  assert.deepEqual([width, height], [TOUCH_ICON_SIZE, TOUCH_ICON_SIZE]);
  assert.ok([PNG_COLOR_RGB, PNG_COLOR_PALETTE].includes(colorType), `colour type ${colorType} has an alpha channel`);
  assert.equal(chunks.includes('tRNS'), false, 'a transparent palette entry');
});

test('the deploy publishes both icons at the root of the site', async () => {
  const workflow = (await read('.github/workflows/pages.yml')).toString('utf8');
  const copy = /^\s*cp -r (.*) _site\/$/m.exec(workflow)?.[1].split(/\s+/) ?? [];
  assert.ok(copy.includes(FAVICON), copy.join(' '));
  assert.ok(copy.includes(TOUCH_ICON), copy.join(' '));
});
