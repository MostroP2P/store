# Third-party libraries

The site has no build step: these libraries are stored already bundled and served as they are. There are no CDNs at runtime.

| File | Source | License | Used for |
|---|---|---|---|
| `nostr-tools.js` | [nostr-tools](https://github.com/nbd-wtf/nostr-tools) 2.25.2, plus `@noble/*` and `@scure/base`, bundled with esbuild | Unlicense (`nostr-tools.LICENSE`); `@noble` and `@scure` MIT (notices at the end of the file) | Sending the order encrypted over Nostr (NIP-17) |
| `qrcode-generator.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4, `dist/qrcode.mjs` | MIT (file header) | The Lightning invoice QR |

`nostr-tools.js` only includes what `scripts/vendor/nostr-entry.js` imports: keys, `wrapEvent`/`unwrapEvent` (NIP-17), NIP-19 and `SimplePool`.

## Updating

1. Change the versions in `scripts/vendor/package.json`. Use versions published at least two weeks ago.
2. Run `npm install --package-lock-only --ignore-scripts` inside `scripts/vendor/`.
3. Run `sh scripts/vendor/build.sh`.
4. Run `npm test` and try the checkout.

`package-lock.json` pins the hash of every package, so the result is reproducible.
