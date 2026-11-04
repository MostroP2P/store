# Visor de remeras: spec

Sistema web mínimo para ver cómo queda cada diseño sobre una remera, eligiendo el color de la remera desde la página.
Sin base de datos, sin build y sin dependencias de runtime. Todo el catálogo vive en un único `catalog.json`.

**Hoy** sirve para decidir qué remeras mandar a hacer.
**Mañana** será la base de la tienda en `store.mostro.network`, con pago en bitcoin por Lightning (ver §10).

---

## 1. Objetivos

1. Ver cada diseño sobre una remera, con el color de remera que elijas, o un color libre.
2. Mantener **el diseño separado de la remera**: la remera es una imagen base y el diseño se compone encima al momento de mostrarla.
3. Soportar **series**: remeras del mismo tipo, armadas con *imagen + mensaje*. Para agregar una remera nueva alcanza con una línea en el JSON.
4. Descargar el mockup en PNG.
5. Que el catálogo y el render se puedan reusar tal cual en la tienda.

### Fuera de alcance (por ahora)

- La tienda en sí: precios visibles, carrito, pago y envíos. Está diseñada en §10, pero no se implementa todavía.
- Espalda de la remera, mangas, varios modelos de remera.
- Editar el catálogo desde la web (el JSON se edita a mano).
- Base de datos, login, backend y bundler.

---

## 2. Cómo se usa

```bash
cd /disco/dev/tshirts
npm start              # servidor local sin caché → http://localhost:8000
npm test               # tests unitarios (node --test, sin dependencias)
npm run coverage       # tests + cobertura
```

> Hace falta un servidor HTTP porque el navegador no permite hacer `fetch('catalog.json')` desde `file://`.
> `npm start` usa `scripts/serve.py`: igual que `python3 -m http.server`, pero sin caché, así los cambios en stickers o en el catálogo se ven con solo recargar. `package.json` existe solo para tener estos atajos: no hay dependencias, no hace falta `npm install`.

Con `?debug` en la URL (`http://localhost:8000/?debug`) se dibuja el área de impresión en rojo, para calibrarla.

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
├── index.html
├── styles.css
├── catalog.json                ← lo único que se edita para sumar remeras
├── package.json                atajos npm start / test / coverage (sin dependencias)
├── src/
│   ├── app.js                  arranque: carga catálogo, fuentes e imágenes; estado
│   ├── ui.js                   DOM: colores, filtros, galería, detalle, avisos
│   ├── render.js               compone una remera: color + diseño + texto
│   ├── shirt.js                prepara la base y la pinta de un color (canvas)
│   ├── shading.js              mapas de sombras y brillos (puro)
│   ├── catalog.js              valida y normaliza catalog.json (puro)
│   ├── layouts.js              posición de imagen y texto (puro)
│   ├── text.js                 corte de líneas y tamaño de letra (puro)
│   ├── color.js                hex, luminancia, color de texto automático (puro)
│   ├── state.js                estado ↔ hash de la URL (puro)
│   └── strings.js              textos de la interfaz (listo para i18n)
├── tests/                      un *.test.js por cada módulo puro
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

## 10. Camino a la tienda (`store.mostro.network`)

Nada de esto se implementa ahora. Son las decisiones que se toman **hoy** para que el paso a tienda no obligue a rehacer nada.

### 10.1 Qué ya queda listo

- **Catálogo = productos.** Cada remera normalizada (diseño o ítem de serie) ya es un producto con `id`, `name`, `image` y colores. La tienda lee el mismo `catalog.json`.
- **Variante = producto + color + talle.** Los `id` de colores ya son estables (`black`, `navy`, …) y sirven como código de variante.
- **Render reusable.** `catalog`, `shirt`, `render`, `layouts`, `text` y `color` no saben nada de la UI de este visor. La tienda los importa tal cual.
- **Campos nuevos sin romper nada.** El normalizador ignora los campos que no conoce, así que se puede agregar `price` antes de que exista la tienda.
- **Textos centralizados** en `strings.js`, listos para agregar inglés.
- **Sitio estático.** Se publica igual que MostroP2P.github.io, en GitHub Pages con dominio propio, sin servidor.

### 10.2 Campos que se agregarán al catálogo

```json
{
  "store": {
    "lnAddress": "store@pay.mostro.foundation",
    "currency": "USD",
    "sizes": ["S", "M", "L", "XL", "XXL"]
  },
  "designs": [
    {
      "id": "mostro-invaders",
      "status": "published",
      "price": 25,
      "description": "…"
    }
  ]
}
```

- `status`: `draft` (default: solo se ve en el visor) o `published` (aparece en la tienda). Hoy te sirve para marcar qué remeras mandaste a hacer.
- `price`: en la moneda de `store.currency`. Si es `SAT`, el precio es fijo en sats. Si es fiat, se convierte a sats al momento de pagar con una API de cotización (por ejemplo yadio.io).
- `sizes`: global en `store`, con override opcional por producto.

> ⚠️ **Al publicar, fijar el `id` a mano.** El ID automático depende del texto: si cambiás "Love at first sat" por otro mensaje, el ID cambia y se rompen los links y los pedidos viejos que lo referencian.

### 10.3 Pago con Lightning

Se reusa el flujo de `src/components/Donate.astro` y `src/utils/lightningQr.ts` de MostroP2P.github.io. Todo corre en el navegador:

1. `GET https://pay.mostro.foundation/.well-known/lnurlp/store` → parámetros LNURL-pay (LUD-06/LUD-16).
2. `GET callback?amount=<msat>&comment=<pedido>` → factura `pr` + URL `verify` (LUD-21).
3. Se valida que el monto de la factura sea exactamente el pedido y se muestra el QR estilizado con el logo de Mostro (el mismo `buildStyledQr`), más los botones copiar, abrir wallet y WebLN.
4. Se consulta `verify` cada 3 s hasta que `settled: true` → "¡Pago recibido!".

### 10.4 Pendiente de decidir: datos de envío

Un LN address solo recibe el pago y un comentario de ≤ 255 caracteres. Una remera necesita **talle, nombre y dirección de envío**, y hay que poder vincular cada pedido con su pago.

| Opción | Cómo funciona | A favor | En contra |
|---|---|---|---|
| A. Nostr DM | Se genera un ID de pedido en el navegador y va en el `comment` de la factura. Los datos de envío se mandan cifrados (NIP-17) a la npub de la tienda. | Sin backend, privado, coherente con Mostro. | El cliente necesita Nostr, o firmamos con una clave efímera. |
| B. Backend de cobro (BTCPay / LNbits) | Un servidor crea la factura con los datos del pedido como metadata y guarda las órdenes. | Pedidos y pagos quedan vinculados; hay panel de administración. | Hay que operar un servidor y guardar direcciones (datos sensibles). |
| C. Formulario + ID de pedido | El pago lleva el ID de pedido en el `comment` y los datos van por un formulario (email o servicio externo). | Lo más simple. | Dos pasos para el cliente y conciliación manual. |

Se decide cuando se empiece la tienda. En los tres casos el catálogo y el render no cambian.

### 10.5 Mockups para la tienda

- La tienda puede renderizar en el navegador (igual que ahora) o usar PNGs pre-generados, mejores para SEO y para las vistas previas al compartir en redes.
- Para pre-generarlos se puede agregar un botón "Exportar todo" en el visor que baje todos los productos en todos sus colores recomendados.
