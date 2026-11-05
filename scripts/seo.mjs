// Writes the SEO files (see seo-pages.mjs): the SEO block of index.html and product.html, one <id>.html per
// product on sale and sitemap.xml, and deletes the page of a product no longer on sale.
// Usage: node scripts/seo.mjs           write them (npm run seo)
//        node scripts/seo.mjs --check   exit 1 if any is out of date (tests/seo.test.js checks the same)

import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { seoFiles, ogImagesNeeded, ogImage, isGeneratedProductPage, publishedProducts } from './seo-pages.mjs';
import { cardFingerprints, repositoryFileHash, FINGERPRINTS } from './og-fingerprint.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const readIfThere = (path) => readFile(path, 'utf8').catch(() => null);

/**
 * For the repository at `root`: { changed: Map(path → content) to write, stale: [pages to delete],
 * missingImages: [names], staleImages: [names whose image no longer matches what it should show] }.
 */
export async function seoPlan(root = ROOT) {
  const raw = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'));
  const pages = {
    'index.html': await readFile(join(root, 'index.html'), 'utf8'),
    'product.html': await readFile(join(root, 'product.html'), 'utf8'),
  };
  const files = seoFiles(raw, pages);
  const current = await Promise.all([...files].map(async ([path, content]) => [path, content, await readIfThere(join(root, path))]));
  const changed = new Map(current.filter(([, content, onDisk]) => content !== onDisk).map(([path, content]) => [path, content]));
  const htmlFiles = (await readdir(root)).filter((name) => name.endsWith('.html') && !files.has(name));
  const generated = await Promise.all(htmlFiles.map(async (name) => [name, isGeneratedProductPage(await readFile(join(root, name), 'utf8'))]));
  const stale = generated.filter(([, isGenerated]) => isGenerated).map(([name]) => name);
  const needed = ogImagesNeeded(raw);
  const missingImages = needed.filter((name) => !existsSync(join(root, ogImage(name))));
  const drawn = JSON.parse(await readIfThere(join(root, FINGERPRINTS)) ?? '{}');
  const expected = await cardFingerprints(publishedProducts(raw), needed, repositoryFileHash(pathToFileURL(`${root}/`)));
  const staleImages = needed.filter((name) => !missingImages.includes(name) && drawn[name] !== expected[name]);
  return { changed, stale, missingImages, staleImages };
}

async function main() {
  const check = process.argv.includes('--check');
  const { changed, stale, missingImages, staleImages } = await seoPlan();
  if (check) {
    const problems = [
      ...[...changed.keys()].map((path) => `out of date: ${path}`),
      ...stale.map((path) => `page of a product no longer on sale: ${path}`),
      ...missingImages.map((name) => `missing preview image: ${ogImage(name)}`),
      ...staleImages.map((name) => `out of date preview image: ${ogImage(name)}`),
    ];
    problems.forEach((problem) => console.error(problem));
    if (problems.length > 0) console.error('Run `npm run seo` (and `npm run og-images` for preview images).');
    process.exitCode = problems.length > 0 ? 1 : 0;
    return;
  }
  await Promise.all([...changed].map(([path, content]) => writeFile(join(ROOT, path), content)));
  await Promise.all(stale.map((path) => unlink(join(ROOT, path))));
  [...changed.keys()].forEach((path) => console.log(`wrote ${path}`));
  stale.forEach((path) => console.log(`deleted ${path}`));
  missingImages.forEach((name) => console.warn(`missing preview image: ${ogImage(name)} (run npm run og-images)`));
  staleImages.forEach((name) => console.warn(`out of date preview image: ${ogImage(name)} (run npm run og-images)`));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
