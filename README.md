# Remeras Mostro

La tienda de remeras de Mostro (`store.mostro.network`) y el visor para decidir qué remeras mandar a hacer. Es un sitio estático: no tiene base de datos, build ni backend.

```bash
npm start      # tienda: http://localhost:8000 · visor: http://localhost:8000/visor.html (sin caché, no hace falta npm install)
npm test       # tests unitarios
```

## La tienda

- **`index.html`:** la colección.
- **`producto.html`:** elegís color y talle (con guía de talles). **Agregar al carrito** suma la remera; **Comprar** la suma y va directo al checkout.
- **Carrito:** el botón arriba a la derecha abre "Tu carrito". Ahí podés sumar o restar, sacar una remera, vaciar el carrito o ir al checkout.
- **`checkout.html`:** pide dónde recibir el pedido y los datos de contacto, y cobra por Lightning.

Cómo funciona el pago:

1. El precio está en pesos (`store.price`, $30.000) y se convierte a sats con la cotización de [Yadio](https://api.yadio.io/exrates/BTC).
2. Se pide una factura a la LN address (`store.lnAddress`, hoy `dev@pay.mostro.foundation`). El comentario del pago lleva el número de pedido (`MS-XXXXXX`).
3. El pedido completo, con dirección y contacto, se manda **cifrado por Nostr (NIP-17)** a la npub de la tienda (`store.nostr.npub`) desde una clave descartable. El comprador no necesita Nostr.
4. El navegador muestra el QR y espera el pago. Al confirmarse, vacía el carrito y le avisa a la tienda con un segundo mensaje.

Todo se configura en la sección `store` de `catalog.json`: precio, moneda, talles con sus medidas, LN address, npub, relays y los textos de envío y pago. Para poner una remera a la venta, agregale `"status": "published"` (o a toda la serie). El detalle está en [docs/SPEC.md §10](docs/SPEC.md).

### Leer los pedidos de prueba

`catalog.json` apunta a una npub de **desarrollo**. Su clave no está en el repo: `.secrets/` está en `.gitignore`, así que solo la tiene quien la generó. Para probar con una propia:

1. Corré `node scripts/dev-nostr-key.mjs`. Guarda la clave en `.secrets/store-nostr-dev.txt` (nunca sobreescribe una existente) e imprime la npub.
2. Poné esa npub en `store.nostr.npub`, solo en tu branch de pruebas.
3. Importá el `secret_hex` en un cliente Nostr con NIP-17 (0xchat, Amethyst, Coracle…) para leer los pedidos.

**Antes de vender de verdad:** cambiá `store.nostr.npub` por la npub de la tienda y `store.lnAddress` por la dirección definitiva.

### Confirmación automática del pago

LNbits ya responde `GET /api/v1/payments/<hash>` sin clave, con `{"paid": true|false}`, pero el Caddy de `pay.mostro.foundation` no expone esa ruta. Hasta que se agregue (la receta está en [SPEC §10.5](docs/SPEC.md)):

- El pago se cobra igual.
- La página avisa que no puede confirmarlo y muestra **"Ya pagué"**. Al tocarlo, se cierra el pedido y te llega un DM para que verifiques el pago en la billetera.
- Con una extensión WebLN, el pago sí se confirma solo.

**Antes de despachar un pedido, verificá siempre el pago en la billetera** (payment hash y comentario `Pedido MS-…`): un DM se puede falsificar. Si cambiás el dominio de la LN address, agregalo también al CSP de las páginas de la tienda ([SPEC §10.7](docs/SPEC.md)).

## El visor (`visor.html`)

Muestra todas las remeras del catálogo, incluidos los borradores, en cualquier color, y deja descargar el PNG.

- **Agregar una remera de una serie:** sumá `{ "image": "designs/stickers/…png", "text": "Tu mensaje" }` en `items` de la serie, en `catalog.json`.
- **Agregar un diseño completo:** dejá el PNG transparente en `designs/` y sumalo en `designs` del catálogo.
- **Cambiar la fuente:** copiá el archivo a `assets/fonts/` y cambiá `"font"` en el `style` de la serie.
- **Calibrar el área de impresión:** abrí `http://localhost:8000/visor.html?debug`.

## Publicar en store.mostro.network

`.github/workflows/pages.yml` corre los tests y publica el sitio en GitHub Pages en cada push a `main`. Los pull requests solo corren los tests. Se publican las páginas `*.html`, `css/`, `catalog.json`, `src/`, `assets/` y `designs/`.

Configuración (una sola vez):

1. **Settings → Pages → Build and deployment → Source:** elegir **GitHub Actions**.
2. **DNS de `mostro.network`:** crear un registro `CNAME` de `store` → `mostrop2p.github.io`. Si el repo no está en la organización MostroP2P, apuntarlo a `<usuario>.github.io`.
3. **Settings → Pages → Custom domain:** poner `store.mostro.network`. Cuando GitHub valide el DNS, tildar **Enforce HTTPS**.
4. **Recomendado:** verificar `mostro.network` en la organización (**Settings → Pages → Verified domains**), así nadie más puede tomar el subdominio.

> Con el deploy por Actions, GitHub ignora el archivo `CNAME`: el dominio se configura solo en Settings (paso 3).

Las librerías de terceros (nostr-tools y qrcode-generator) se guardan ya armadas en `src/vendor/`. Cómo se actualizan está en [src/vendor/README.md](src/vendor/README.md).
