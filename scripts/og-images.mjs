// Draws the link preview images in Chromium (playwright-core): assets/og/<id>.jpg for every product on sale,
// in its default color, and assets/og/store.jpg. Run it after adding a shirt or changing its look:
//   npm run og-images            (needs `npm ci` and `npx playwright-core install --only-shell chromium`)
// The pages that point at them come from `npm run seo`.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startSite } from '../tests/e2e/server.js';
import { ogImagesNeeded, ogImage, OG_IMAGE } from './seo-pages.mjs';

const ROOT = new URL('..', import.meta.url);

const raw = JSON.parse(await readFile(new URL('catalog.json', ROOT), 'utf8'));
const names = ogImagesNeeded(raw);
const site = await startSite();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: OG_IMAGE });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site.url}/scripts/og/card.html`);
  await mkdir(new URL('assets/og/', ROOT), { recursive: true });
  for (const name of names) {
    const dataUrl = await page.evaluate((card) => window.drawCard(card), name);
    await writeFile(new URL(ogImage(name), ROOT), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    console.log(`wrote ${ogImage(name)}`);
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
  await site.close();
}
