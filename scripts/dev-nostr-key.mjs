// Creates a development Nostr key for the store inbox, so you can read test orders in a NIP-17 client.
// Usage: node scripts/dev-nostr-key.mjs   (never overwrites an existing key)
// Then put the printed npub in catalog.json → store.nostr.npub, only on your machine or test branch.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSecretKey, getPublicKey, npubEncode } from '../src/vendor/nostr-tools.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, '.secrets/store-nostr-dev.txt');

if (existsSync(FILE)) {
  process.stdout.write(`${FILE} already exists: not overwritten.\n`);
  process.exit(0);
}

const secret = generateSecretKey();
const npub = npubEncode(getPublicKey(secret));
mkdirSync(dirname(FILE), { recursive: true, mode: 0o700 });
writeFileSync(FILE, [
  '# Nostr key of a DEV store inbox (test orders). Never commit it: .secrets/ is in .gitignore.',
  '# Import secret_hex in a NIP-17 client (0xchat, Amethyst, Coracle…) to read the orders.',
  `secret_hex=${Buffer.from(secret).toString('hex')}`,
  `npub=${npub}`,
  '',
].join('\n'), { mode: 0o600 });
process.stdout.write(`Key saved to ${FILE}\nPut this npub in catalog.json → store.nostr.npub:\n${npub}\n`);
