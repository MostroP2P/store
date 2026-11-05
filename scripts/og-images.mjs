// Draws the link preview images in Chromium (playwright-core): assets/og/<id>.jpg for every product on sale,
// in its default color, and assets/og/store.jpg. They are not committed: the deploy draws them into the site
// it publishes, so a preview always shows the catalog that is live.
//   npm run og-images              into assets/og/ of this repository (ignored by git), to look at them
//   npm run og-images -- _site     into _site/assets/og/ (what .github/workflows/pages.yml does)
// Needs `npm ci` and `npx playwright-core install --only-shell chromium`. The pages that point at the
// images come from `npm run seo`.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { startSite } from '../tests/e2e/server.js';
import { ogImagesNeeded, ogImage, OG_IMAGE } from './seo-pages.mjs';

const ROOT = new URL('..', import.meta.url);
const JPEG = 'data:image/jpeg;base64,';

const siteRoot = process.argv[2] ? pathToFileURL(`${resolve(process.argv[2])}/`) : ROOT;
const names = ogImagesNeeded(JSON.parse(await readFile(new URL('catalog.json', ROOT), 'utf8')));
const site = await startSite();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: OG_IMAGE });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site.url}/scripts/og/card.html`);
  await mkdir(new URL('assets/og/', siteRoot), { recursive: true });
  for (const name of names) {
    const dataUrl = await page.evaluate((card) => window.drawCard(card), name);
    if (!dataUrl.startsWith(JPEG)) throw new Error(`the card "${name}" did not come out as a JPEG`);
    const target = new URL(ogImage(name), siteRoot);
    await writeFile(target, Buffer.from(dataUrl.slice(JPEG.length), 'base64'));
    console.log(`wrote ${target.pathname}`);
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
  await site.close();
}
