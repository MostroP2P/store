// The viewer in a real browser: every shirt, filters, colors, the detail with its PNG download, and the
// problems it reports about catalog.json. Run with `npm run test:e2e`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launchBrowser, openShop, saveCoverage } from './harness.js';

const INVADERS = 'mostro-invaders';
const CATALOG = new URL('../../catalog.json', import.meta.url);

let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => {
  await browser?.close();
  await saveCoverage('viewer');
});

async function withViewer(options, scenario, pageOptions = {}) {
  const shop = await openShop(browser, options);
  try {
    const page = await shop.page('viewer.html', pageOptions);
    await scenario(page, shop);
    assert.deepEqual(shop.get('pageErrors'), []);
  } finally {
    await shop.close();
  }
}

const catalog = async () => JSON.parse(await readFile(CATALOG, 'utf8'));
const visibleCards = (page) => page.locator('.card:visible').count();
const problems = (page) => page.locator('#problems li').allTextContents();

test('every shirt, filtered by group and painted in any color', () => withViewer({}, async (page) => {
  await page.waitForSelector('.card');
  assert.equal(await visibleCards(page), 10);
  await page.click('#filters .filter:text("Designs")');
  assert.equal(await visibleCards(page), 1);
  await page.click('#filters .filter:text("Mostro says…")');
  assert.equal(await visibleCards(page), 9);
  await page.click('#filters .filter:text("All")');
  assert.equal(await visibleCards(page), 10);

  await page.click('#swatches .swatch[title="White"]');
  assert.match(page.url(), /color=white/);
  await page.$eval('#swatches input[type="color"]', (input) => {
    input.value = '#ff0000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(page.url(), /color=%23ff0000|color=#ff0000|color=ff0000/i);
}));

test('the detail: badges, PNG download, close, and the URL hash', () => withViewer({}, async (page) => {
  await page.waitForSelector('.card');
  await page.click('#swatches .swatch[title="Red"]');
  await page.click(`.card:has(.card-name:text("Mostro Invaders"))`);
  await page.waitForSelector('dialog.detail[open]');
  assert.equal(await page.textContent('#detail-title'), 'Mostro Invaders');
  assert.match(await page.textContent('#detail-badges'), /Not recommended in this color/);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#detail-download')]);
  assert.equal(download.suggestedFilename(), `${INVADERS}-red.png`);

  await page.click('dialog.detail .icon-button');
  // Closing the detail takes the shirt out of the URL (on the dialog's close event)
  await page.waitForURL((url) => !url.hash.includes('shirt='));

  await page.evaluate((id) => { window.location.hash = `#shirt=${id}&color=black`; }, INVADERS);
  await page.waitForSelector('dialog.detail[open]');
  assert.equal(await page.textContent('#detail-badges'), '');

  // A canvas that cannot be exported says so instead of failing silently
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function toBlob(callback) { callback(null); }; });
  await page.click('#detail-download');
  await page.waitForSelector('#detail-badges .badge-error');
  assert.match(await page.textContent('#detail-badges'), /Could not download the PNG: the canvas is empty/);
}));

test('?debug draws the print area, to calibrate it', () => withViewer({}, async (page, shop) => {
  await page.goto(`${shop.url}/viewer.html?debug#shirt=${INVADERS}`);
  await page.waitForSelector('dialog.detail[open]');
  assert.equal(await page.textContent('#detail-title'), 'Mostro Invaders');
}));

test('the viewer reports what is wrong in catalog.json', async () => {
  const raw = await catalog();
  const broken = {
    ...raw,
    designs: [
      { ...raw.designs[0], colors: [...raw.designs[0].colors, 'purple'] },
      { id: 'ghost', name: 'Ghost', image: 'designs/missing.png', status: 'draft' },
    ],
    series: [{
      ...raw.series[0],
      style: { ...raw.series[0].style, font: 'assets/fonts/Missing.ttf' },
      items: [
        ...raw.series[0].items,
        { id: 'too-long', image: raw.series[0].items[0].image, text: 'A sentence far too long to fit on the shirt at any size', style: { maxLines: 1, minFontSize: 90 } },
      ],
    }],
  };
  await withViewer({ catalogBody: JSON.stringify(broken) }, async (page) => {
    await page.waitForSelector('.card');
    const reported = (await problems(page)).join('\n');
    assert.match(reported, /unknown recommended color "purple"/);
    assert.match(reported, /Could not load the font: assets\/fonts\/Missing\.ttf/);
    const ghost = page.locator('.card:has(.card-name:text("Ghost")) .badges');
    assert.match(await ghost.textContent(), /Image not found: designs\/missing\.png/);
    assert.match(await ghost.textContent(), /Draft: not in the store/);
    assert.match(await page.locator('.card:has(.card-name:text("A sentence far too long")) .badges').textContent(), /Text too long/);
  });
});

test('the viewer explains when it cannot start', async () => {
  const raw = await catalog();
  const cases = [
    [{ files: { '/catalog.json': 500 } }, /Could not read catalog\.json: HTTP 500/],
    [{ catalogBody: '[]' }, /The catalog must be a JSON object\./],
    [{ catalogBody: JSON.stringify({ ...raw, base: { ...raw.base, image: 'assets/shirts/missing.png' } }) }, /Could not load the base shirt: assets\/shirts\/missing\.png/],
  ];
  for (const [options, reason] of cases) {
    await withViewer(options, async (page) => {
      await page.waitForSelector('#problems li');
      assert.match((await problems(page)).join('\n'), reason);
    });
  }
  // A canvas the browser refuses to read (e.g. a cross-origin base image) is an unexpected error
  const tainted = () => { CanvasRenderingContext2D.prototype.getImageData = () => { throw new Error('tainted canvas'); }; };
  await withViewer({}, async (page) => {
    await page.waitForSelector('#problems li');
    assert.match((await problems(page)).join('\n'), /Unexpected error while preparing the shirts: tainted canvas/);
  }, { init: tainted });
});
