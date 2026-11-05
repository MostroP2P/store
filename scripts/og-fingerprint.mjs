// Fingerprints of the preview cards: a hash of everything a card shows (its catalog values, the files it
// reads and the code that draws it). `npm run og-images` saves them in assets/og/fingerprints.json; when one
// no longer matches, that image was drawn from an older catalog, design or renderer and must be redrawn.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { cardInputs, cardFiles } from './og-cards.mjs';

export const FINGERPRINTS = 'assets/og/fingerprints.json';
/** The code that draws a card: a change here can change every image. */
export const RENDERER_FILES = Object.freeze([
  'scripts/og/card.html',
  'scripts/og/card.js',
  'scripts/og-cards.mjs',
  'src/render.js',
  'src/shirt.js',
  'src/shading.js',
  'src/text.js',
  'src/layouts.js',
  'src/color.js',
  'src/store/money.js',
]);

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/**
 * { name: fingerprint } of the cards `names`. `context` is publishedProducts(catalog); `hashFile(path)` gives
 * the hash of a repository file.
 */
export async function cardFingerprints(context, names, hashFile) {
  const renderer = sha256((await Promise.all(RENDERER_FILES.map(hashFile))).join('\n'));
  const entries = await Promise.all(names.map(async (name) => {
    const inputs = cardInputs(name, context);
    const files = Object.fromEntries(await Promise.all(cardFiles(inputs).map(async (path) => [path, await hashFile(path)])));
    return [name, sha256(JSON.stringify({ inputs, files, renderer }))];
  }));
  return Object.fromEntries(entries);
}

/** hashFile for the repository at `root` (a file: URL). */
export const repositoryFileHash = (root) => async (path) => sha256(await readFile(new URL(path, root)));
