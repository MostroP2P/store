# Mostro Store

La tienda de remeras de Mostro, en **[store.mostro.network](https://store.mostro.network)**, y el visor interno para decidir qué remeras mandar a hacer.

Es un sitio estático: no tiene base de datos, servidor, cuentas de usuario ni build. Todo se configura en un archivo, `catalog.json`.

- **El cobro** es en bitcoin, por Lightning, a una LN address.
- **Los pedidos** llegan cifrados por Nostr (NIP-17) a la cuenta de la tienda.
- **La dirección del comprador** no se guarda en ningún servidor.
- **Idiomas:** inglés por defecto, o español si el navegador está en español. El botón **EN/ES** del header cambia el idioma.

## Índice

1. [Probarlo en tu máquina](#1-probarlo-en-tu-máquina)
2. [Cómo compra un cliente](#2-cómo-compra-un-cliente)
3. [Cómo te llegan los pedidos (Nostr)](#3-cómo-te-llegan-los-pedidos-nostr)
4. [Cómo te llegan los pagos (Lightning)](#4-cómo-te-llegan-los-pagos-lightning)
5. [Qué hacer con cada pedido](#5-qué-hacer-con-cada-pedido)
6. [Configuración: `catalog.json`](#6-configuración-catalogjson)
7. [Agregar o cambiar remeras](#7-agregar-o-cambiar-remeras)
8. [Privacidad y seguridad](#8-privacidad-y-seguridad)
9. [Desarrollo](#9-desarrollo)
10. [Publicar en store.mostro.network](#10-publicar-en-storemostronetwork)
11. [Pendientes](#11-pendientes)

---

## 1. Probarlo en tu máquina

Hace falta Python 3, para el servidor local, y Node 24, para los tests. No hay dependencias, así que no hace falta `npm install`.

```bash
npm start              # tienda: http://localhost:8000 · visor: http://localhost:8000/visor.html
npm test               # tests unitarios
npm run coverage       # tests + cobertura (mínimo 80 %)
```

`npm start` usa `scripts/serve.py`, un servidor sin caché, así que los cambios en `catalog.json` o en las imágenes se ven al recargar.

> ⚠️ **Probar el checkout manda pedidos de verdad.** Llegan a la npub configurada y se piden facturas reales a la LN address. Para probar sin llenarle la bandeja a la tienda, usá una clave de desarrollo ([§9](#9-desarrollo)).

## 2. Cómo compra un cliente

La tienda se ve en **inglés**, o en **español** si el navegador del comprador está en español (cuenta el primer idioma de su lista que sea inglés o español). El botón **EN/ES** del header cambia de idioma y lo recuerda en ese navegador. Mientras hay una factura en curso el botón queda deshabilitado, para que la recarga no la pierda.

1. **Colección** (`index.html`): ve todas las remeras a la venta, agrupadas por serie.
2. **Producto** (`producto.html`): elige el color y el talle. "Guía de talles" muestra la tabla de medidas.
   - **Agregar al carrito** suma la remera. El botón muestra cuántas de esa variante lleva, por ejemplo "(1)".
   - **Comprar** la suma y va directo al checkout.
3. **Carrito**: el botón de arriba a la derecha aparece con la cantidad de remeras.
   - En el panel "Tu carrito" puede sumar o restar cada remera, sacarla, **Vaciar carrito** o ir al **Checkout**.
   - El carrito queda guardado en el navegador, aunque cierre la página.
4. **Checkout** (`checkout.html`): completa dónde quiere recibir el pedido y sus datos de contacto, y toca **Pagar con Lightning**. La página:
   1. convierte el total en pesos a sats con la cotización de [Yadio](https://api.yadio.io/exrates/BTC);
   2. pide una factura a la LN address de la tienda;
   3. manda el pedido cifrado a la tienda por Nostr;
   4. muestra el QR, con botones para copiar la factura, abrir la wallet o pagar con una extensión WebLN.
5. **Confirmación**: cuando la página ve el pago, muestra "¡Pago recibido!" con el número de pedido, y saca esas remeras del carrito.
   - La página consulta el estado del pago cada 3 segundos ([§4](#4-cómo-te-llegan-los-pagos-lightning)).
   - Si esa consulta falla 3 veces seguidas, ofrece **"Ya pagué"**, que cierra el pedido y le avisa a la tienda.

Si la factura vence, el comprador puede generar otra. Cada intento es un pedido nuevo, con otro número.

## 3. Cómo te llegan los pedidos (Nostr)

Los pedidos llegan como **mensajes privados de Nostr (NIP-17)** a la cuenta de la tienda:

```
npub1st0re749d5d02mwnf2c0vcj566p85y5wpnaz65llr8wt49cyp6kqe44n9m
```

Está configurada en `catalog.json`, en `store.nostr.npub`.

**Para leerlos**, entrá con la clave privada de esa cuenta (nsec) en un cliente que soporte NIP-17, como 0xchat o Amethyst.

Cada pedido llega como un mensaje con asunto `Pedido MS-XXXXXX`:

```
🛒 Pedido MS-7K3F2Q — Pendiente de pago

Remeras:
• 2 × Love at first sat — Negro, talle L — $60.000
• 1 × Hold my invoice — Azul, talle M — $30.000

Total: $90.000 ARS = 67.072 sats
1 BTC = $134.185.377 ARS (Yadio)
Payment hash: 3c02c8e4…

Envío a:
Ana Pérez
Av. Siempreviva 742, piso 3, depto B
CP 1234, Springfield, Buenos Aires

Contacto:
Email: ana@example.com
Teléfono: 11 2233 4455
Idioma: español

Instrucciones: Tocar timbre dos veces
```

Los mensajes a la tienda están siempre en español. La línea `Idioma` dice en qué idioma compró la persona (`inglés` o `español`), para contestarle en ese idioma; el nombre del color también viene en ese idioma.

En la misma conversación puede llegar un segundo mensaje:

- **`✅ Pedido MS-… pagado`**: la página vio el pago confirmado.
- **`⚠️ Pedido MS-…: el comprador dice que ya pagó`**: tocó "Ya pagué", porque la página no pudo confirmarlo.

Si no llega ninguno de los dos, mirá igual la billetera: el comprador pudo haber pagado y cerrado la página sin tocar "Ya pagué".

**Algunas cosas a saber:**

- **No se puede responder por Nostr.** Cada pedido sale de una clave descartable, para que el comprador no necesite Nostr. Al comprador escribile por email o teléfono, con los datos del pedido.
- **Relays.** Los pedidos se publican en los relays de `store.nostr.relays` (`relay.mostro.network`, `nos.lol`, `relay.damus.io`) y en los relays de mensajes privados de la tienda, si los publicó.
  - Hacen falta al menos 2 relays que acepten cada pedido. Si no, la página no muestra la factura.
- **Recomendado: publicá los relays de DM de la tienda (kind 10050).** Hoy la npub no tiene esa lista, y muchos clientes solo buscan mensajes privados ahí.
  - Desde la cuenta de la tienda, configurá en tu cliente esos mismos tres relays como relays de mensajes privados.
  - La tienda los encuentra sola y manda los pedidos ahí.

## 4. Cómo te llegan los pagos (Lightning)

Los pagos van a la LN address de `store.lnAddress`, que es **`store@pay.mostro.foundation`**, un LNbits.

- Acepta entre 1.000 y 1.000.000 sats por pedido: con la cotización actual, unas 44 remeras como máximo.
- Acepta comentarios de hasta 100 caracteres; el del pedido ocupa unos 40.

- **Monto:** el precio en pesos (`store.price`, hoy $30.000 por remera) convertido a sats en el momento de pagar, redondeado hacia arriba.
- **Comentario del pago:** `Pedido MS-XXXXXX · store.mostro.network`. Es la forma de saber a qué pedido corresponde cada pago, y nunca lleva datos personales.
- **Verificaciones de la página:** antes de mostrar la factura, chequea que sea de mainnet, que sea exactamente por el monto pedido, que tenga una fecha y un vencimiento razonables, y que la haya emitido el mismo servidor de la LN address.

### Confirmación automática del pago

Está activa desde el 4/11/2026.

- LNbits responde, sin pedir clave, si una factura se pagó: `GET /api/v1/payments/<payment_hash>` devuelve solo `{"paid": true|false}`.
- La página lo consulta cada 3 segundos y, cuando llega el pago, muestra "¡Pago recibido!" sola.
- Si se paga con una extensión WebLN (por ejemplo Alby), la confirmación no depende de esta consulta.

Para que funcione, el Caddy de `pay.mostro.foundation` deja pasar esa única ruta además de las de LNURL. Está en el servidor `lnbits`, en `/etc/caddy/Caddyfile`:

```caddy
	@paymentStatus {
		method GET
		path_regexp ^/api/v1/payments/[0-9a-f]{64}$
	}
	handle @paymentStatus {
		reverse_proxy 127.0.0.1:5000
	}
```

**Es seguro:**

- Sin clave, LNbits solo contesta si la factura está pagada: no muestra montos, comentarios ni saldo.
- El hash de una factura solo lo conocen el comprador y la tienda.
- Solo pasa `GET` con exactamente 64 caracteres hexadecimales. El resto de la API de LNbits (crear facturas, pagar, ver la billetera) sigue devolviendo 404.

**Si la consulta falla** (por Caddy, LNbits o la red), la página sigue intentando. A las 3 fallas seguidas ofrece **"Ya pagué"**: el pedido se cierra y la tienda recibe un aviso para verificar el pago en la billetera.

**Para verificar la ruta:**

```bash
curl -i -H 'Origin: https://store.mostro.network' \
  https://pay.mostro.foundation/api/v1/payments/0000000000000000000000000000000000000000000000000000000000000000
```

- **Funciona:** responde `404` con `{"detail":"Payment does not exist."}` y el header `access-control-allow-origin: *`. Contesta LNbits.
- **Está bloqueada:** responde `404` con el cuerpo vacío. Contesta Caddy.

**Para deshacerla**, en el servidor:

```bash
cp /etc/caddy/Caddyfile.bak-20261104-store-status /etc/caddy/Caddyfile && systemctl reload caddy
```

## 5. Qué hacer con cada pedido

> **La billetera manda, no los mensajes.** Cualquiera puede mandarle un mensaje a la npub de la tienda, y la pantalla "¡Pago recibido!" corre en el navegador del comprador. Solo despachá lo que veas cobrado en la billetera.

1. **Leé el pedido.** Buscá el DM `Pedido MS-XXXXXX` en el cliente Nostr de la tienda.
2. **Buscá el pago en LNbits**, con el mismo comentario `Pedido MS-XXXXXX` y el mismo payment hash.
3. **Verificá que esté cobrado y que el monto alcance** para esas remeras al precio del catálogo, con la cotización de ese momento.
4. **Escribile al comprador** al email o teléfono del pedido para coordinar el envío, en el idioma de la línea `Idioma`. El texto actual dice "Envío: a coordinar".
5. **Si hay un DM sin pago**, el comprador no pagó, o pagó otra factura del mismo carrito (cada intento genera un número nuevo). En ese caso no se despacha.

## 6. Configuración: `catalog.json`

### Sección `store`

```json
"store": {
  "currency": "ARS",
  "price": 30000,
  "lnAddress": "store@pay.mostro.foundation",
  "defaultColor": "black",
  "defaultSize": "L",
  "sizes": [
    { "id": "S", "width": 49, "length": 69 },
    { "id": "M", "width": 51, "length": 71 }
  ],
  "nostr": {
    "npub": "npub1st0re749d5d02mwnf2c0vcj566p85y5wpnaz65llr8wt49cyp6kqe44n9m",
    "relays": ["wss://relay.mostro.network", "wss://nos.lol", "wss://relay.damus.io"]
  },
  "details": [
    { "title": { "en": "Shipping", "es": "Envío" }, "text": { "en": "We ship anywhere in Argentina…", "es": "Enviamos a todo el país…" } }
  ]
}
```

| Campo | Qué es |
|---|---|
| `currency` | Moneda de los precios. Se convierte a sats con Yadio. |
| `price` | Precio por defecto de cada remera. |
| `lnAddress` | Dónde se cobra. Si cambia de dominio, actualizá el CSP (ver abajo). |
| `defaultColor` | Color que se muestra primero. |
| `defaultSize` | Talle que se muestra primero. |
| `sizes` | Talles. `width` es el ancho de axila a axila y `length` el largo de hombro a ruedo, ambos en cm, para la guía de talles. |
| `nostr.npub` | Cuenta que recibe los pedidos. Tiene que ser una npub válida: si no, el checkout queda cerrado. |
| `nostr.relays` | Relays `wss://` donde se publican los pedidos. |
| `details` | Los acordeones de la página de producto: envío, pago, privacidad… |

Si `lnAddress` o `nostr` son inválidos, las remeras se ven igual, pero no se puede pagar.

**Si la LN address cambia de dominio**, hay que agregarlo al `connect-src` del `Content-Security-Policy` en `index.html`, `producto.html` y `checkout.html`. Si no, el navegador bloquea el pedido de la factura.

### Textos en inglés y español

Todo texto que ve el comprador en `catalog.json` puede ir en los dos idiomas, como un objeto con `en` y `es`:

```json
{ "id": "black", "name": { "en": "Black", "es": "Negro" }, "hex": "#1a1a1a" }
```

- **Dónde:** nombres de colores, `description` y `name` de diseños, series e ítems, y `title` / `text` de `store.details`.
- **Un texto igual en los dos idiomas** puede quedar como string, por ejemplo las frases de las remeras ("Love at first sat").
- **Si falta una traducción** (o está vacía), se usa la inglesa, y si tampoco está, la otra.
- **Solo valen las claves `en` y `es`.** Un objeto con otras claves no se toma como traducción, y el nombre cae al `id`.
- Un test (`tests/i18n.test.js`) abre `catalog.json` en los dos idiomas y falla si queda algo en español en la versión en inglés.
- El visor muestra el catálogo en español.

### Campos de cada remera

| Campo | Qué es |
|---|---|
| `status` | `"published"` la pone a la venta. Sin este campo queda como borrador: solo se ve en el visor, con la etiqueta "Borrador". Una serie se lo pasa a sus remeras. |
| `price` | Precio propio. Si falta, se usa `store.price`. |
| `description` | Texto que aparece bajo el nombre, en la página del producto. |
| `id` | Fijalo antes de publicar, y no lo cambies después: se usa en los links y en los carritos guardados. |
| `colors` | Colores en los que se vende. Si falta, se vende en todos. |

## 7. Agregar o cambiar remeras

El visor (`visor.html`) muestra todas las remeras del catálogo, incluidos los borradores, en cualquier color, y deja descargar el PNG. Sirve para decidir qué publicar.

- **Agregar una remera a una serie:** sumá `{ "id": "mostro-quotes-…", "image": "designs/stickers/…png", "text": "Tu mensaje" }` en `items`.
- **Agregar un diseño completo:** dejá el PNG transparente en `designs/` y sumalo en `designs`.
- **Ponerla a la venta:** agregale `"status": "published"`.
- **Cambiar la fuente de una serie:** copiá el archivo a `assets/fonts/` y cambiá `"font"` en el `style` de la serie.
- **Calibrar el área de impresión:** abrí `/visor.html?debug`.

El formato completo del catálogo está en [docs/SPEC.md](docs/SPEC.md) (§4 y §10).

## 8. Privacidad y seguridad

- **La dirección del comprador** solo viaja cifrada a la npub de la tienda.
  - Ni Yadio ni el servidor Lightning la ven: el pago solo lleva el número de pedido.
  - En el navegador se guarda solo en esa pestaña (`sessionStorage`), y se borra al cerrarla, al terminar el pedido o con "Limpiar datos guardados".
- **Sin cookies, analytics ni scripts de terceros.** Cada página tiene Content-Security-Policy y `referrer: no-referrer`. Las consultas a APIs tienen un timeout de 10 s.
- **El texto del pedido** se limpia antes de mandarlo, para que nadie pueda inyectar líneas falsas como "✅ pagado" en los datos de envío.
- **Las librerías de terceros** se guardan en `src/vendor/`: nostr-tools y qrcode-generator, con versiones fijas. La CI las vuelve a armar desde `scripts/vendor/` y falla si difieren de lo commiteado.
- **Claves:** el repo no guarda ninguna. `.secrets/` está en `.gitignore` y nunca se publica.

## 9. Desarrollo

```
index.html, producto.html, checkout.html   tienda
visor.html                                 visor
catalog.json                               remeras, precios, talles, pago y npub
css/                                       base.css (colores, botones), store.css, viewer.css
src/                                       render de remeras, compartido por visor y tienda
src/i18n.js                                idioma de la página y traducciones de catalog.json
src/store/                                 tienda: carrito, checkout, LNURL, BOLT11, Nostr, QR…
src/viewer/                                visor
src/vendor/                                librerías de terceros ya armadas (ver su README)
scripts/serve.py                           servidor local sin caché
scripts/vendor/                            receta reproducible de src/vendor/
scripts/dev-nostr-key.mjs                  clave Nostr de desarrollo
tests/                                     tests unitarios (node --test)
docs/SPEC.md                               diseño completo
```

Las reglas del repo:

- Los módulos que no tocan el DOM tienen tests con cobertura de 80 % o más (hoy, alrededor de 99 %).
- Los textos de la tienda están en `src/store/strings/en.js` y `src/store/strings/es.js`, con las mismas claves: un test falla si a un idioma le falta algo o si queda español en el inglés.
- Los textos fijos de los HTML llevan `data-i18n="clave"` (o `data-i18n-attr="aria-label:clave"`). El HTML trae el inglés, y `src/store/lang.js` lo cambia al idioma de la página.

### Probar el checkout sin molestar a la tienda

Para que los pedidos de prueba no lleguen a la npub real, usá una clave propia:

1. Corré `node scripts/dev-nostr-key.mjs`. Guarda la clave en `.secrets/store-nostr-dev.txt` (nunca sobreescribe una existente) e imprime una npub.
2. Poné esa npub en `store.nostr.npub`, **solo en tu copia local o en un branch de pruebas**. No la subas a `main`.
3. Importá el `secret_hex` del archivo en un cliente con NIP-17 para leer tus pedidos.

Las facturas se piden igual a la LN address configurada. Quedan sin pagar y vencen solas.

### Actualizar las librerías de terceros

Ver [src/vendor/README.md](src/vendor/README.md). En resumen: cambiar las versiones en `scripts/vendor/package.json` y correr `sh scripts/vendor/build.sh`.

## 10. Publicar en store.mostro.network

`.github/workflows/pages.yml` corre en cada push a `main`:

1. corre los tests con cobertura;
2. verifica que `src/vendor/` sea idéntico a lo que arma `scripts/vendor/`;
3. publica en GitHub Pages las páginas `*.html`, `css/`, `catalog.json`, `src/`, `assets/` y `designs/`.

En los pull requests solo corren los dos primeros pasos, sin publicar.

Configuración (una sola vez, ya hecha):

1. **Settings → Pages → Build and deployment → Source:** elegir **GitHub Actions**.
2. **DNS de `mostro.network`:** crear un registro `CNAME` de `store` → `mostrop2p.github.io`.
3. **Settings → Pages → Custom domain:** poner `store.mostro.network` y tildar **Enforce HTTPS**.
4. **Recomendado:** verificar `mostro.network` en la organización (**Settings → Pages → Verified domains**), así nadie más puede tomar el subdominio.

> Con el deploy por Actions, GitHub ignora el archivo `CNAME`: el dominio se configura solo en Settings.

## 11. Pendientes

- [ ] **Relays de DM de la tienda:** publicar el kind 10050 desde la npub de la tienda ([§3](#3-cómo-te-llegan-los-pedidos-nostr)).
- [ ] **Medidas reales de cada talle** en `store.sizes`: las actuales son aproximadas.
- [ ] **Texto y costo de envío** en `store.details`: hoy dice "a coordinar".
- [ ] **Un pago real** con una wallet de celular después del deploy.
