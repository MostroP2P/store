#!/usr/bin/env sh
# Rebuilds src/vendor/ from the exact versions pinned in scripts/vendor/package-lock.json.
# The site itself has no build step: the result is committed and served as is.
set -eu

cd "$(dirname "$0")"
OUT=../../src/vendor

npm ci --ignore-scripts --no-audit --no-fund
npx esbuild nostr-entry.js --bundle --format=esm --minify --target=es2022 --legal-comments=eof \
  --outfile="$OUT/nostr-tools.js"
cp node_modules/qrcode-generator/dist/qrcode.mjs "$OUT/qrcode-generator.js"
cp node_modules/nostr-tools/LICENSE "$OUT/nostr-tools.LICENSE"
echo "src/vendor/ actualizado"
