# Remeras Mostro: spec (visor + tienda)

Sistema web mínimo para ver cómo queda cada diseño sobre una remera, eligiendo el color de la remera desde la página, y venderlas.
Sin base de datos, sin build y sin backend. Todo el catálogo vive en un único `catalog.json`.

- **Visor** (`visor.html`): sirve para decidir qué remeras mandar a hacer.
- **Tienda** (`index.html`, en `store.mostro.network`): colección, producto, carrito y checkout con pago Lightning (ver §10).

---

## 1. Objetivos

1. Ver cada diseño sobre una remera, con el color de remera que elijas, o un color libre.
2. Mantener **el diseño separado de la remera**: la remera es una imagen base y el diseño se compone encima al momento de mostrarla.
3. Soportar **series**: remeras del mismo tipo, armadas con *imagen + mensaje*. Para agregar una remera nueva alcanza con una línea en el JSON.
4. Descargar el mockup en PNG.
5. Que el catálogo y el render se puedan reusar tal cual en la tienda.

### Fuera de alcance (por ahora)

- Costo de envío calculado en la página: se coordina por email después del pago.
- Stock, cupones y panel de administración de pedidos.
- Espalda de la remera, mangas, varios modelos de remera.
- Editar el catálogo desde la web (el JSON se edita a mano).
- Base de datos, login, backend y bundler.

---

## 2. Cómo se usa

```bash
cd /disco/dev/tshirts
npm start              # servidor local sin caché → tienda en http://localhost:8000, visor en /visor.html
npm test               # tests unitarios (node --test, sin dependencias)
npm run coverage       # tests + cobertura
```

> Hace falta un servidor HTTP porque el navegador no permite hacer `fetch('catalog.json')` desde `file://`.
> `npm start` usa `scripts/serve.py`: igual que `python3 -m http.server`, pero sin caché, así los cambios en stickers o en el catálogo se ven con solo recargar. `package.json` existe solo para tener estos atajos: no hay dependencias, no hace falta `npm install`.

Con `?debug` en la URL del visor (`http://localhost:8000/visor.html?debug`) se dibuja el área de impresión en rojo, para calibrarla.

### Agregar una remera a una serie

1. Copiá la imagen a `designs/stickers/`.
2. Agregá una línea en `items` de la serie:
   ```json
   { "image": "designs/stickers/mostro-hodl-512.png", "text": "HODL" }
   ```
3. Recargá la página.

### Agregar un diseño completo (como invaders)

1. Copiá el PNG con fondo transparente a `designs/`.
2. Agregá una entrada en `designs`:
   ```json
   { "id": "mostro-invaders", "name": "Mostro Invaders", "image": "designs/invaders-design.png" }
   ```

### Cambiar la fuente de una serie

1. Copiá el archivo de la fuente (`.ttf`, `.otf`, `.woff` o `.woff2`) a `assets/fonts/`.
2. Cambiá **una línea**: `"font": "assets/fonts/OtraFuente.ttf"` en el `style` de la serie.

La fuente se carga sola a partir del archivo; no hay que declararla en otro lado.

---

## 3. Estructura de archivos

```
tshirts/
├── index.html                  tienda: colección
├── producto.html               tienda: una remera (color, talle, carrito, comprar)
├── checkout.html               tienda: resumen, datos de envío y pago Lightning
├── visor.html                  visor: todas las remeras, en cualquier color
├── css/                        base.css (colores y botones), store.css, viewer.css
├── catalog.json                ← lo único que se edita: remeras, precios, talles, pago
├── package.json                atajos npm start / test / coverage (sin dependencias)
├── src/
│   ├── render.js               compone una remera: color + diseño + texto
│   ├── shirt.js                prepara la base y la pinta de un color (canvas)
│   ├── shading.js              mapas de sombras y brillos (puro)
│   ├── catalog.js              valida y normaliza catalog.json (puro)
│   ├── layouts.js              posición de imagen y texto (puro)
│   ├── text.js                 corte de líneas y tamaño de letra (puro)
│   ├── color.js                hex, luminancia, color de texto automático (puro)
│   ├── loader.js               carga catálogo, fuentes e imágenes (visor y tienda)
│   ├── dom.js                  el() / svgEl(): DOM sin innerHTML
│   ├── viewer/                 visor: app.js, ui.js, state.js, strings.js
│   ├── store/                  tienda (ver §10.2)
│   └── vendor/                 nostr-tools y qrcode-generator ya armados (ver README ahí)
├── scripts/
│   ├── serve.py                servidor local sin caché
│   └── vendor/                 receta reproducible de src/vendor/
├── tests/                      un *.test.js por cada módulo puro (tests/store/, tests/viewer/)
├── assets/
│   ├── shirts/t-shirt.png      remera base (negra, fondo transparente)
│   └── fonts/                  fuentes de los mensajes + su licencia
├── designs/
│   ├── invaders-design.png     diseños completos
│   ├── stickers/               imágenes de Mostro para las series
│   └── characters/             arte fuente de los personajes (mostro, serbero, …)
└── docs/
    ├── SPEC.md
    └── references/             mockups de ejemplo (t-shirt-1.png, t-shirt-2.png)
```

Usa ES modules nativos (`<script type="module">`), sin bundler.
Los módulos marcados *puro* no tocan el DOM, así que se testean con Node y la tienda los reusa sin cambios.

---

## 4. Formato de `catalog.json`

```json
{
  "base": {
    "image": "assets/shirts/t-shirt.png",
    "printArea": { "x": 335, "y": 195, "width": 530, "height": 700 },
    "shading": { "blur": 7, "shadowFloor": 0.66, "highlight": 0.16 }
  },

  "colors": [
    { "id": "black",  "name": "Negro",       "hex": "#1a1a1a" },
    { "id": "white",  "name": "Blanco",      "hex": "#f0f0ec" },
    { "id": "red",    "name": "Rojo",        "hex": "#c81e28" }
  ],

  "designs": [
    {
      "id": "mostro-invaders",
      "name": "Mostro Invaders",
      "image": "designs/invaders-design.png",
      "colors": ["black", "navy", "gray", "white"]
    }
  ],

  "series": [
    {
      "id": "mostro-quotes",
      "name": "Mostro dice…",
      "style": {
        "font": "assets/fonts/LuckiestGuy-Regular.ttf",
        "textColor": "auto",
        "imageWidth": 0.6,
        "textPosition": "below",
        "maxLines": 2
      },
      "items": [
        { "image": "designs/stickers/mostro-love-512.png", "text": "Love at first sat" },
        { "image": "designs/stickers/mostro-gm-512.png",   "text": "GM", "style": { "textColor": "#7ed321" } }
      ]
    }
  ]
}
```

### Campos

| Campo | Obligatorio | Descripción |
|---|---|---|
| `base.image` | sí | PNG de la remera con fondo transparente. Se usa su forma (canal alfa) y sus pliegues. |
| `base.printArea` | sí | Rectángulo de impresión en píxeles de la imagen base. Todo diseño se ubica dentro de este rectángulo. |
| `base.shading` | no | Ajuste fino del sombreado (ver §5). |
| `colors[]` | sí | Colores de remera del selector. `id` único y estable, `hex` en formato `#rrggbb`. |
| `designs[]` | no | Diseños completos: una imagen que ocupa el área de impresión. `id` obligatorio. |
| `designs[].colors` | no | Colores **recomendados**. Si el color elegido no está en la lista, la tarjeta muestra "no recomendado", pero la remera igual se ve. |
| `series[]` | no | Grupos de remeras del mismo tipo (imagen + mensaje) que comparten un `style`. |
| `series[].style` | no | Estilo común de la serie (tabla de abajo). |
| `series[].items[]` | sí | Una remera por ítem: `image` (obligatorio), `text`, y opcionalmente `id`, `name`, `colors` y `style` (pisa valores del estilo de la serie). |

### Estilo de una serie (`style`)

| Clave | Default | Descripción |
|---|---|---|
| `font` | `sans-serif` | Ruta a un archivo de fuente o nombre de una fuente del sistema. |
| `textColor` | `auto` | `auto` (blanco o negro según el contraste con la remera) o un hex fijo. |
| `uppercase` | `true` | Pasa el texto a mayúsculas. |
| `imageWidth` | `0.6` | Ancho de la imagen como fracción del área de impresión. |
| `textPosition` | `below` | `below` o `above` de la imagen. |
| `gap` | `24` | Separación en px entre la imagen y el texto. |
| `maxLines` | `2` | Máximo de líneas del mensaje. |
| `maxFontSize` / `minFontSize` | `96` / `28` | Rango en el que se ajusta el tamaño de letra. |
| `lineHeight` | `1.05` | Interlineado, como múltiplo del tamaño de letra. |

### Reglas de normalización

- **IDs automáticos:** los ítems de una serie pueden omitir `id`. Se genera como `{serie.id}-{slug(text)}`, por ejemplo `mostro-quotes-love-at-first-sat`. Si no hay texto, se usa el nombre del archivo.
- **Nombre automático:** si falta `name`, se usa el `text`.
- **Saltos de línea manuales:** `\n` en `text` fuerza dónde corta la línea.
- **Herencia del estilo:** defaults del sistema → `series.style` → `item.style`.
- **Campos desconocidos se ignoran.** Así se pueden agregar `price`, `sizes`, etc. (§10) sin romper nada.
- **Rutas:** relativas a la raíz del proyecto.

### Validación (al cargar)

- Si el JSON está mal formado o falta la remera base, se muestra un error y no se dibuja nada.
- IDs repetidos, hex inválidos, ítems sin `image` o colores recomendados inexistentes generan un aviso en un banner. Los ítems válidos se muestran igual.
- Si una imagen o una fuente no carga, esa tarjeta muestra el problema en lugar de romper la galería.

---

## 5. Cómo se pinta la remera de otro color

La remera base es **negra**, así que no alcanza con multiplicar un color encima (cualquier color multiplicado por negro da negro).
La técnica fue validada con un prototipo en 6 colores, y conserva bien los pliegues y la caída de la tela.

**Preparación** (una sola vez al cargar):

1. Calcular la luminancia `L` de cada píxel opaco de la base y sus percentiles: p1 = `LO`, p50 = `MED`, p99 = `HI`. En la base actual: LO≈7, MED≈19, HI≈31.
2. Desenfocar `L` con un *box blur* de radio `blur` (≈ 7 px) para quitar la textura ruidosa del tejido. Los píxeles transparentes se rellenan antes con `MED`, para que el borde de la remera no se oscurezca.
3. **Mapa de sombras:** `shadowFloor + (1 - shadowFloor) · norm(L, LO, HI)`. Es un gris claro, más oscuro en los pliegues.
4. **Mapa de brillos:** `highlight · norm(L, MED, HI)`. Es negro, con luz solo donde la tela brilla.

**Pintado** (cada vez que cambia el color):

1. Rellenar con el color elegido.
2. `multiply` con el mapa de sombras.
3. `screen` con el mapa de brillos (para que los pliegues se vean también en colores oscuros).
4. `destination-in` con la base (su alfa recorta la silueta).
5. Dibujar el diseño según el layout.

Si en el futuro se cambia la remera base (por ejemplo, una blanca de mejor calidad), el algoritmo sigue funcionando porque normaliza por percentiles.

---

## 6. Layouts

### `image` (diseños completos)

La imagen se escala con *contain* dentro de `printArea`, centrada horizontalmente y alineada arriba, como en las referencias.

### `image-text` (series)

- La imagen ocupa `imageWidth × printArea.width`, como máximo el 75 % del alto del área, y va centrada.
- El texto va debajo o arriba, separado por `gap`.
- **Ajuste automático:** el tamaño baja de 2 en 2 desde `maxFontSize` hasta que el texto entra en `maxLines` líneas y en el alto disponible. Las líneas se **balancean** (por ejemplo "LOVE AT / FIRST SAT" en vez de "LOVE AT FIRST / SAT"). Si con `minFontSize` igual no entra, se dibuja igual y la tarjeta avisa "texto muy largo".
- **Color `auto`:** se elige blanco o casi negro, el que tenga más contraste (WCAG) con el color de la remera.

---

## 7. Interfaz

- **Selector de color global:** un círculo por cada color del JSON, más un selector de color libre. Al cambiarlo se redibujan todas las tarjetas.
- **Filtros:** "Todas", "Diseños" y una pestaña por serie.
- **Galería:** una tarjeta por remera, con su nombre y, si corresponde, las marcas "no recomendado" o "texto muy largo".
- **Detalle:** al hacer clic se abre la remera a resolución completa (1199×1312), con el selector de color y el botón **Descargar PNG**, que baja `{id}-{color}.png`.
- **URL compartible:** el estado vive en el hash, por ejemplo `#color=red&shirt=mostro-quotes-love-at-first-sat`.
- **Responsive:** la grilla se adapta al ancho y queda en 2 columnas en el celular.

---

## 8. Calidad y tests

- **Unit tests (`npm test`):** cubren todos los módulos puros: `catalog`, `text`, `layouts`, `color`, `shading` y `state`. La medición de texto se inyecta, así se testea sin canvas.
- **Cobertura (`npm run coverage`):** objetivo ≥ 80 % en los módulos puros. Los módulos de DOM/canvas (`app`, `ui`, `render`, `shirt`) se verifican en el navegador.
- **Verificación visual:** se revisan todos los colores, los dos layouts, la descarga y el hash de la URL.
- **E2E (Playwright):** queda para cuando exista la tienda, porque recién ahí hay un flujo crítico (compra) que lo justifica.

---

## 9. Plan de implementación

| Fase | Entregable | Verificación |
|---|---|---|
| 1 | Módulos puros con tests (TDD) | `npm test` en verde, cobertura ≥ 80 % |
| 2 | `shirt.js` + `render.js`: color de remera, layouts, fuentes | visual contra el prototipo y las referencias |
| 3 | UI: galería, filtros, color libre, detalle, descarga, hash, `?debug` | navegador (desktop y móvil) |
| 4 | Calibrar `printArea` y `shading` | comparación con `docs/references/` |

---

## 10. La tienda (`store.mostro.network`)

Mismo catálogo y mismo render que el visor. Todo corre en el navegador: no hay backend.

### 10.1 Recorrido

| Página | Qué hace |
|---|---|
| `index.html` | Colección, una sección por serie. Cada tarjeta muestra la remera en su color por defecto, el nombre, el precio y los colores disponibles. |
| `producto.html?id=…&color=…&talle=…` | Igual que kinoto.com.ar/item/…: color (círculos), talle (lista) más **Guía de talles** (tabla de `store.sizes`) y precio. **Agregar al carrito** muestra cuántas hay de esa variante, por ejemplo "(1)". **Comprar** la agrega y va al checkout. Debajo, los acordeones de `store.details` y "Te puede interesar". La URL guarda color y talle. |
| Carrito | El botón aparece arriba a la derecha cuando hay algo, con la cantidad. El panel "Tu carrito" muestra cada línea con color, talle, − cantidad +, precio, total de la línea (si hay más de una) y **Sacar del carrito**. Abajo: subtotal, envío (a coordinar), total, **Checkout** y **Vaciar carrito**. Se guarda en `localStorage` (`mostro-store:cart`) y se sincroniza entre pestañas. |
| `checkout.html` | Resumen del pedido, **¿Dónde querés recibir tu pedido?** (calle, número, piso, depto, código postal, localidad, provincia), instrucciones (hasta 500 caracteres) e información personal (nombre, apellido, email, teléfono). Los datos se guardan solo en esa pestaña (`sessionStorage`, `mostro-store:checkout`), así sobreviven a una recarga. Se borran al cerrarla, al terminar el pedido o al tocar **Limpiar datos guardados**. A la derecha, el método de pago: Lightning. |

### 10.2 Módulos (`src/store/`)

| Puros (con tests) | Para qué |
|---|---|
| `config.js` | Valida la sección `store` de `catalog.json`. |
| `products.js` | Remeras publicadas, precio final, colores, relacionadas, secciones. |
| `cart.js`, `cart-store.js`, `persist.js` | Carrito inmutable, guardado y sincronización; `localStorage` sin excepciones. |
| `money.js` | Formato `$30.000` y sats, conversión ARS → sats, cotización de Yadio. |
| `bolt11.js` | Decodifica facturas: monto, payment hash, vencimiento (con checksum). |
| `lnurl.js` | LNURL-pay (LUD-06/12/16): pide la factura y verifica el monto exacto. |
| `payment.js` | Espera el pago (polling), cuenta regresiva, prueba de pago con preimage. |
| `order.js` | Número de pedido `MS-XXXXXX`, comentario del pago y textos del DM. |
| `checkout-form.js` | Campos, validación, provincias, datos guardados. |
| `query.js` | URL de la página de producto. |
| `qr.js` | QR con módulos redondeados y el logo de Mostro, basado en el de donate. Tiene ajustes para que decodifique en todas las versiones. |
| `nostr-order.js` | DM NIP-17 a la tienda: relays de la tienda (kind 10050) y publicación. |

Los módulos de DOM son `boot.js`, `cart-ui.js`, `product-card.js`, `home-page.js`, `product-page.js`, `size-guide.js`, `checkout-fields.js`, `checkout-page.js`, `payment-ui.js` e `icons.js`. Los textos están en `strings.js`.

### 10.3 Campos del catálogo

```json
{
  "store": {
    "currency": "ARS",
    "price": 30000,
    "lnAddress": "dev@pay.mostro.foundation",
    "defaultColor": "black",
    "defaultSize": "L",
    "sizes": [{ "id": "S", "width": 49, "length": 69 }],
    "nostr": { "npub": "npub1…", "relays": ["wss://relay.mostro.network", "wss://nos.lol", "wss://relay.damus.io"] },
    "details": [{ "title": "Envío", "text": "…" }]
  },
  "designs": [{ "id": "mostro-invaders", "status": "published", "price": 35000, "description": "…" }]
}
```

- **`status`** puede ser `draft` (el default: solo se ve en el visor, con la etiqueta "Borrador") o `published` (está a la venta). Una serie se lo pasa a sus ítems, y cada ítem puede cambiarlo.
- **`price`** es opcional por remera; si falta se usa `store.price`. La moneda es `store.currency`, y se convierte a sats al pagar.
- **`sizes`** lleva `width` (ancho de axila a axila) y `length` (largo de hombro a ruedo), en cm, para la guía de talles. Si falta una medida, se muestra "—".
- **`details`** son los acordeones de la página de producto.
- Si `lnAddress` o `nostr` son inválidos, las remeras se ven igual pero el checkout queda cerrado.

> ⚠️ Los ítems publicados tienen el `id` fijo (`mostro-quotes-love-at-first-sat`, …). Si cambiás un texto, el ID no cambia y los links y los carritos guardados siguen funcionando.

### 10.4 Pago y pedido

1. **Cotización.** Se consulta `https://api.yadio.io/exrates/BTC` para el precio de 1 BTC en ARS. Los sats se calculan como `⌈ARS × 10⁸ / cotización⌉`.
2. **Número de pedido.** `MS-` más 6 caracteres en base32 Crockford, sin I, L, O ni U.
3. **Factura (LNURL-pay).** `GET https://pay.mostro.foundation/.well-known/lnurlp/dev`, después `callback?amount=<msat>&comment=Pedido MS-… · store.mostro.network`. El comentario lleva solo el número de pedido, nunca datos personales. La factura se verifica:
   - el callback tiene que estar en el mismo host que la LN address;
   - la factura es de mainnet y por **exactamente** el monto pedido;
   - su fecha tiene una diferencia de 10 minutos como máximo con la hora actual, y vence entre 1 minuto y 24 horas después;
   - `verify` solo se acepta si está en el mismo origen que el callback.
4. **Pedido cifrado (NIP-17).** El texto completo (remeras, total, cotización, payment hash, dirección y contacto) va como gift wrap (kind 1059) a `store.nostr.npub`.
   - Lo firma una clave descartable creada para este checkout: el comprador no necesita Nostr.
   - Se publica en los relays de DM de la tienda (su kind 10050, si existe) más `store.nostr.relays`.
   - Hacen falta al menos 2 relays que lo acepten (o 1, si solo hay uno configurado). Si no, no se muestra la factura y el comprador puede reintentar.
5. **QR.** Mismo estilo que donate, con botones para copiar, abrir la wallet y pagar con WebLN si hay extensión. Muestra la cuenta regresiva del vencimiento.
6. **Confirmación.** Cada 3 s el navegador consulta `verify` (LUD-21) o, en LNbits, `GET /api/v1/payments/<hash>`. Con WebLN alcanza con `sha256(preimage) == payment hash`.
   - Si fallan 3 consultas seguidas (hoy pasa siempre, ver §10.5), la página avisa que no puede confirmar el pago y ofrece **"Ya pagué"**. Vale también si el endpoint respondía antes y dejó de hacerlo.
   - Al tocarlo, se cierra el pedido y la tienda recibe "⚠️ … el comprador dice que ya pagó, verificá el pago en la billetera".
7. **Pagado.** Se sacan del carrito las remeras compradas (lo que se haya agregado después, por ejemplo desde otra pestaña, queda), se borran los datos de envío, se muestra el número de pedido y se manda un segundo DM, "✅ Pedido … pagado", en la misma conversación.

Casos borde:

- **Factura vencida.** El comprador genera otra, que es un pedido nuevo. Si la última consulta falló, la página no dice "venció": le pide que no vuelva a pagar si ya pagó.
- **"Cambiar mis datos".** Cancela la factura. Antes de descartarla se consulta su estado una última vez, por si se pagó justo antes.
- **Cambio de carrito.** Si cambia el contenido mientras se prepara o se muestra la factura (también desde otra pestaña), se cancela. Cada paso del armado verifica que el intento siga vigente, así nunca se arma una factura para un carrito viejo.

> La pantalla "¡Pago recibido!" es informativa. La fuente de verdad es la billetera: solo se despachan los pedidos cuyo pago aparece en LNbits con el comentario `Pedido MS-…`.

### 10.5 Pendiente en el servidor de pagos (confirmación automática)

LNbits ya responde `GET /api/v1/payments/<payment_hash>` **sin clave**, y solo devuelve `{"paid": true|false}`. Su extensión LNURLp no ofrece LUD-21. Hoy el Caddy de `pay.mostro.foundation` solo expone las rutas de LNURL, así que esa consulta da 404 y el navegador sigue esperando. El pago igual llega; lo que falta es el aviso automático. Alcanza con agregar esta ruta:

```caddy
pay.mostro.foundation {
	@paymentStatus {
		method GET
		path_regexp ^/api/v1/payments/[0-9a-f]{64}$
	}
	handle @paymentStatus {
		reverse_proxy localhost:5000   # el mismo upstream de LNbits que ya usan las rutas /lnurlp
	}
	# … resto de la configuración actual
}
```

No hace falta una API propia ni un macaroon: el navegador no maneja ninguna clave.

### 10.6 Leer los pedidos

- **Desarrollo:** la clave de una npub de prueba vive solo en la máquina de quien la creó (`.secrets/` está en `.gitignore`).
  - Para tener la tuya, corré `node scripts/dev-nostr-key.mjs`. Guarda la clave en `.secrets/store-nostr-dev.txt` e imprime la npub.
  - Poné esa npub en `store.nostr.npub`, solo en tu branch de pruebas.
  - Importá `secret_hex` en un cliente con NIP-17 (0xchat, Amethyst, Coracle…) para leer los pedidos de prueba.
- **Producción:** poné la npub real de la tienda en `store.nostr.npub` y sus relays de DM. Lo ideal es que esa npub publique su kind 10050.
- **Conciliar:** el DM "Pedido MS-XXXXXX" con el pago en LNbits que tiene el mismo comentario y el mismo payment hash.

### 10.7 Seguridad y privacidad

- **Sin HTML inyectado.** Todo el DOM se arma con `textContent`. Cada página tiene CSP (`script-src 'self'`, sin inline) y `referrer: no-referrer`.
- **`connect-src` permite solo** `api.yadio.io`, `pay.mostro.foundation` y relays `wss:`. **Si cambia el dominio de la LN address, hay que agregarlo al CSP** de `index.html`, `producto.html` y `checkout.html`.
- **Pedidos de red acotados.** Todos los pedidos a APIs tienen un timeout de 10 s y no mandan cookies ni referrer. Los relays de la tienda (kind 10050) se limitan a 6, y nunca son `localhost` ni IPs.
- **Datos de envío.** Se guardan solo en la pestaña (`sessionStorage`), para no perderlos si se recarga la página. Se borran al cerrar la pestaña, al terminar el pedido o con "Limpiar datos guardados". Si la pestaña queda abierta más de 7 días, al recargar no se restauran y se borran. Nunca quedan en `localStorage`.
- **Texto del DM.** Cada campo va en una sola línea, sin caracteres de control ni de dirección (bidi). Así el comprador no puede falsificar líneas como "✅ pagado".
- **La billetera manda.** Un DM se puede falsificar, porque cualquiera puede escribirle a la npub. Antes de despachar:
  1. buscá en LNbits el pago con ese payment hash (y el comentario `Pedido MS-…`);
  2. verificá que esté cobrado;
  3. verificá que el monto alcance para las remeras al precio del catálogo, con la cotización de ese momento.
- **`src/vendor/`.** CI vuelve a armarlo con `scripts/vendor/build.sh` y falla si difiere de lo commiteado.

### 10.8 Pendientes

- Medidas reales de cada talle: las de `catalog.json` son aproximadas.
- Política y costo de envío (hoy dice "a coordinar").
- npub real y LN address definitiva (por ejemplo `store@pay.mostro.foundation`).
- La ruta de Caddy de §10.5.
- Mockups pre-generados para SEO y vistas previas al compartir.
- Endurecimiento opcional:
  - una segunda fuente de cotización, para detectar un precio de Yadio anómalo;
  - fijar la pubkey del nodo de la tienda y verificar la firma de la factura;
  - fijar las GitHub Actions por SHA.
