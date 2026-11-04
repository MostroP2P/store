# Librerías de terceros

El sitio no tiene build: estas librerías se guardan ya armadas y se sirven tal cual. No hay CDNs en tiempo de ejecución.

| Archivo | Origen | Licencia | Para qué |
|---|---|---|---|
| `nostr-tools.js` | [nostr-tools](https://github.com/nbd-wtf/nostr-tools) 2.25.2, más `@noble/*` y `@scure/base`, armado con esbuild | Unlicense (`nostr-tools.LICENSE`); `@noble` y `@scure` MIT (avisos al final del archivo) | Mandar el pedido cifrado por Nostr (NIP-17) |
| `qrcode-generator.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4, `dist/qrcode.mjs` | MIT (encabezado del archivo) | QR de la factura Lightning |

`nostr-tools.js` solo incluye lo que importa `scripts/vendor/nostr-entry.js`: claves, `wrapEvent`/`unwrapEvent` (NIP-17), NIP-19 y `SimplePool`.

## Actualizar

1. Cambiá las versiones en `scripts/vendor/package.json`. Usá versiones con al menos dos semanas de publicadas.
2. Corré `npm install --package-lock-only --ignore-scripts` dentro de `scripts/vendor/`.
3. Corré `sh scripts/vendor/build.sh`.
4. Corré `npm test` y probá el checkout.

El `package-lock.json` fija el hash de cada paquete, así que el resultado es reproducible.
