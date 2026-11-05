# Mostro T-shirts: spec (viewer + store)

A minimal web system to see how each design looks on a T-shirt, choosing the T-shirt color from the page, and to sell them.
No database, no build and no backend. The whole catalogue lives in a single `catalog.json`.

- **Viewer** (`viewer.html`): used to decide which T-shirts to produce.
- **Store** (`index.html`, at `store.mostro.network`): collection, product, cart and checkout with Lightning payment (see §10).

---

## 1. Goals

1. See each design on a T-shirt, in the T-shirt color you choose, or in any free color.
2. Keep **the design separate from the T-shirt**: the T-shirt is a base image and the design is composited on top when it is displayed.
3. Support **series**: T-shirts of the same type, built from *image + message*. To add a new T-shirt, one line in the JSON is enough.
4. Download the mockup as a PNG.
5. Let the store reuse the catalogue and the render as they are.

### Out of scope (for now)

- Shipping cost calculated on the page: it is arranged by email after payment.
- Stock, coupons and an order admin panel.
- T-shirt back, sleeves, several T-shirt models.
- Editing the catalogue from the web (the JSON is edited by hand).
- Database, login, backend and bundler.

---

## 2. How to use it

```bash
cd /disco/dev/tshirts
npm start              # local server without cache → store at http://localhost:8000, viewer at /viewer.html
npm test               # unit tests (node --test, no dependencies)
npm run coverage       # unit tests + coverage (100 % of the pure modules)
npm run test:e2e       # browser tests (playwright-core, needs npm ci and Chromium)
npm run coverage:all   # both, and the line coverage of every file in src/
```

> An HTTP server is needed because the browser does not allow `fetch('catalog.json')` from `file://`.
> `npm start` uses `scripts/serve.py`: the same as `python3 -m http.server`, but without cache, so changes to stickers or to the catalogue show up with just a reload. `package.json` exists only to provide these shortcuts: there are no dependencies, so `npm install` is not needed.

With `?debug` in the viewer URL (`http://localhost:8000/viewer.html?debug`) the print area is drawn in red, to calibrate it.

### Add a T-shirt to a series

1. Copy the image to `designs/stickers/`.
2. Add a line to the series `items`:
   ```json
   { "image": "designs/stickers/mostro-hodl-512.png", "text": "HODL" }
   ```
3. Reload the page.

### Add a full design (like invaders)

1. Copy the PNG with a transparent background to `designs/`.
2. Add an entry to `designs`:
   ```json
   { "id": "mostro-invaders", "name": "Mostro Invaders", "image": "designs/invaders-design.png" }
   ```

### Change the font of a series

1. Copy the font file (`.ttf`, `.otf`, `.woff` or `.woff2`) to `assets/fonts/`.
2. Change **one line**: `"font": "assets/fonts/OtraFuente.ttf"` in the `style` of the series.

The font loads by itself from the file; it does not have to be declared anywhere else.

---

## 3. File structure

```
tshirts/
├── index.html                  store: collection
├── product.html                store: one T-shirt (color, size, cart, buy)
├── checkout.html               store: summary, shipping details and Lightning payment
├── viewer.html                 viewer: all the T-shirts, in any color
├── <id>.html                   one page per T-shirt on sale, generated from product.html (§10.9)
├── robots.txt, sitemap.xml     for search engines (the sitemap is generated)
├── favicon.ico                 tab icon: the Mostro logo at 16, 32 and 48 px, at the root because clients ask for it there
├── apple-touch-icon.png        home-screen icon: the logo at 180 × 180 on the store's background, opaque
├── css/                        base.css (colors and buttons), store.css, viewer.css
├── catalog.json                ← the only file you edit: T-shirts, prices, sizes, payment
├── package.json                npm shortcuts; playwright-core is the only (development) dependency
├── src/
│   ├── render.js               composes a T-shirt: color + design + text
│   ├── shirt.js                prepares the base and paints it a color (canvas)
│   ├── shading.js              shadow and highlight maps (pure)
│   ├── catalog.js              validates and normalizes catalog.json (pure)
│   ├── layouts.js              position of image and text (pure)
│   ├── text.js                 line breaking and font size (pure)
│   ├── color.js                hex, luminance, automatic text color (pure)
│   ├── loader.js               loads catalogue, fonts and images (viewer and store)
│   ├── dom.js                  el() / svgEl(): DOM without innerHTML
│   ├── i18n.js                 page language and catalog.json translations (pure)
│   ├── viewer/                 viewer: app.js, ui.js, state.js, strings.js
│   ├── store/                  store (see §10.2)
│   └── vendor/                 prebuilt nostr-tools and qrcode-generator (see the README there)
├── scripts/
│   ├── serve.py                local server without cache
│   └── vendor/                 reproducible recipe for src/vendor/
├── tests/                      one *.test.js per pure module (tests/store/, tests/viewer/)
├── assets/
│   ├── mostro-logo.png         Mostro in the store header (50×72, 1.5 KB; from designs/characters/mostro.png)
│   ├── shirts/t-shirt.png      base T-shirt (black, transparent background)
│   └── fonts/                  fonts for the messages + their license
├── designs/
│   ├── invaders-design.png     full designs
│   ├── stickers/               Mostro images for the series
│   └── characters/             source art of the characters (mostro, serbero, …)
└── docs/
    ├── SPEC.md
    └── references/             example mockups (t-shirt-1.png, t-shirt-2.png)
```

It uses native ES modules (`<script type="module">`), with no bundler.
The modules marked *pure* do not touch the DOM, so they are tested with Node and the store reuses them unchanged.

---

## 4. `catalog.json` format

```json
{
  "base": {
    "image": "assets/shirts/t-shirt.png",
    "printArea": { "x": 335, "y": 195, "width": 530, "height": 700 },
    "shading": { "blur": 7, "shadowFloor": 0.66, "highlight": 0.16 }
  },

  "colors": [
    { "id": "black",  "name": { "en": "Black", "es": "Negro" },  "hex": "#1a1a1a" },
    { "id": "white",  "name": { "en": "White", "es": "Blanco" }, "hex": "#f0f0ec" },
    { "id": "red",    "name": { "en": "Red", "es": "Rojo" },     "hex": "#c81e28" }
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
      "name": { "en": "Mostro says…", "es": "Mostro dice…" },
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

Texts the buyer sees can be `{ "en": …, "es": … }` (see §10.8); a text that reads the same in both languages, such as the quotes on the shirts, stays a plain string.

### Fields

| Field | Required | Description |
|---|---|---|
| `base.image` | yes | PNG of the T-shirt with a transparent background. Its shape (alpha channel) and its folds are used. |
| `base.printArea` | yes | Print rectangle, in pixels of the base image. Every design is placed inside this rectangle. |
| `base.shading` | no | Fine adjustment of the shading (see §5). |
| `colors[]` | yes | T-shirt colors of the selector. `id` unique and stable, `hex` in `#rrggbb` format. |
| `designs[]` | no | Full designs: an image that fills the print area. `id` required. |
| `designs[].colors` | no | **Recommended** colors. If the chosen color is not in the list, the card shows a "not recommended" badge, but the T-shirt is still displayed. |
| `series[]` | no | Groups of T-shirts of the same type (image + message) that share a `style`. |
| `series[].style` | no | Common style of the series (table below). |
| `series[].items[]` | yes | One T-shirt per item: `image` (required), `text`, and optionally `id`, `name`, `colors` and `style` (overrides values of the series style). |

### Style of a series (`style`)

| Key | Default | Description |
|---|---|---|
| `font` | `sans-serif` | Path to a font file or name of a system font. |
| `textColor` | `auto` | `auto` (white or black depending on the contrast with the T-shirt) or a fixed hex. |
| `uppercase` | `true` | Turns the text into uppercase. |
| `imageWidth` | `0.6` | Width of the image as a fraction of the print area. |
| `textPosition` | `below` | `below` or `above` the image. |
| `gap` | `24` | Gap in px between the image and the text. |
| `maxLines` | `2` | Maximum number of lines of the message. |
| `maxFontSize` / `minFontSize` | `96` / `28` | Range in which the font size is adjusted. |
| `lineHeight` | `1.05` | Line spacing, as a multiple of the font size. |

### Normalization rules

- **Automatic IDs:** the items of a series may omit `id`. It is generated as `{serie.id}-{slug(text)}`, for example `mostro-quotes-love-at-first-sat`. If there is no text, the file name is used.
- **Automatic name:** if `name` is missing, the `text` is used.
- **Manual line breaks:** `\n` in `text` forces where the line breaks.
- **Style inheritance:** system defaults → `series.style` → `item.style`.
- **Unknown fields are ignored.** This way `price`, `sizes`, etc. (§10) can be added without breaking anything.
- **Paths:** relative to the project root.

### Validation (on load)

- If the JSON is malformed or the base T-shirt is missing, an error is shown and nothing is drawn.
- Repeated IDs, invalid hex values, items without `image` or recommended colors that do not exist produce a warning in a banner. Valid items are still shown.
- If an image or a font does not load, that card shows the problem instead of breaking the gallery.

---

## 5. How the T-shirt is painted in another color

The base T-shirt is **black**, so multiplying a color on top is not enough (any color multiplied by black gives black).
The technique was validated with a prototype in 6 colors, and it keeps the folds and the drape of the fabric well.

**Preparation** (once, on load):

1. Compute the luminance `L` of each opaque pixel of the base and its percentiles: p1 = `LO`, p50 = `MED`, p99 = `HI`. In the current base: LO≈7, MED≈19, HI≈31.
2. Blur `L` with a *box blur* of radius `blur` (≈ 7 px) to remove the noisy texture of the weave. Transparent pixels are filled with `MED` beforehand, so the edge of the T-shirt does not get darker.
3. **Shadow map:** `shadowFloor + (1 - shadowFloor) · norm(L, LO, HI)`. It is a light gray, darker in the folds.
4. **Highlight map:** `highlight · norm(L, MED, HI)`. It is black, with light only where the fabric shines.

**Painting** (every time the color changes):

1. Fill with the chosen color.
2. `multiply` with the shadow map.
3. `screen` with the highlight map (so the folds are visible in dark colors too).
4. `destination-in` with the base (its alpha cuts out the silhouette).
5. Draw the design according to the layout.

If the base T-shirt is changed in the future (for example, a better quality white one), the algorithm keeps working because it normalizes by percentiles.

---

## 6. Layouts

### `image` (full designs)

The image is scaled with *contain* inside `printArea`, centered horizontally and aligned to the top, as in the references.

### `image-text` (series)

- The image takes `imageWidth × printArea.width`, at most 75 % of the height of the area, and is centered.
- The text goes below or above, separated by `gap`.
- **Automatic fit:** the size goes down in steps of 2 from `maxFontSize` until the text fits in `maxLines` lines and in the available height. The lines are **balanced** (for example "LOVE AT / FIRST SAT" instead of "LOVE AT FIRST / SAT"). If it still does not fit at `minFontSize`, it is drawn anyway and the card shows a "text too long" badge.
- **`auto` color:** white or almost black is chosen, whichever has more contrast (WCAG) with the T-shirt color.

---

## 7. Interface

- **Global color selector:** one circle for each color in the JSON, plus a free color picker. Changing it redraws all the cards.
- **Filters:** an "all" filter, a "designs" filter and one tab per series.
- **Gallery:** one card per T-shirt, with its name and, where applicable, the "not recommended" or "text too long" badges.
- **Detail:** clicking opens the T-shirt at full resolution (1199×1312), with the color selector and a **download PNG** button, which saves `{id}-{color}.png`.
- **Shareable URL:** the state lives in the hash, for example `#color=red&shirt=mostro-quotes-love-at-first-sat`.
- **Responsive:** the grid adapts to the width and ends up with 2 columns on a phone.

---

## 8. Quality and tests

- **Unit tests (`npm test`):** they cover all the pure modules: `catalog`, `text`, `layouts`, `color`, `shading` and `state`. Text measurement is injected, so it is tested without a canvas.
- **Coverage (`npm run coverage`):** 100 % of lines, branches and functions of the pure modules; CI fails below that.
- **Visual verification:** all the colors, both layouts, the download and the URL hash are checked.
- **Browser tests (`npm run test:e2e`, `tests/e2e/`):** playwright-core drives Chromium through the store (language, collection, product, size guide, cart, checkout, Lightning and WebLN payments, expiry, the "I've paid" fallback, every error) and the viewer. A harness answers Yadio, the LN address, the payment status and the Nostr relays, and blocks every other request, so no real invoice or order is made; the tests decrypt the order the store receives with a test key. The V8 coverage of each page is saved before every navigation (the Navigation API pauses it), and `npm run coverage:all` joins it with the unit tests': 100 % of the lines of `src/`, enforced in CI.

---

## 9. Implementation plan

| Phase | Deliverable | Verification |
|---|---|---|
| 1 | Pure modules with tests (TDD) | `npm test` green, coverage ≥ 80 % |
| 2 | `shirt.js` + `render.js`: T-shirt color, layouts, fonts | visual, against the prototype and the references |
| 3 | UI: gallery, filters, free color, detail, download, hash, `?debug` | browser (desktop and mobile) |
| 4 | Calibrate `printArea` and `shading` | comparison with `docs/references/` |

---

## 10. The store (`store.mostro.network`)

Same catalogue and same render as the viewer. Everything runs in the browser: there is no backend.

### 10.1 Flow

| Page | What it does |
|---|---|
| `index.html` | Collection, one section per series. Each card shows the T-shirt in its default color, the name, the price and the available colors. |
| `<id>.html?color=…&size=…` (or `product.html?id=…`) | Like kinoto.com.ar/item/…: color (circles), size (list) plus **Size guide** (table from `store.sizes`) and price. **Add to cart** shows how many of that variant are in the cart, for example "(1)". **Buy now** adds it and goes to checkout. Below, the accordions from `store.details` and "You may also like". The URL stores color and size. |
| Cart | The button appears at the top right when the cart is not empty, with the quantity. The "Your cart" panel shows each line with color, size, − quantity +, price, line total (if there is more than one) and **Remove from cart**. At the bottom: subtotal, shipping (to be arranged), total, **Checkout** and **Empty cart**. It is saved in `localStorage` (`mostro-store:cart`) and synchronized between tabs. |
| `checkout.html` | Order summary, **Where should we deliver your order?** (street, number, floor, apartment, postal code, city, province), instructions (up to 500 characters) and personal information (first name, last name, email, phone). The data is saved only in that tab (`sessionStorage`, `mostro-store:checkout`), so it survives a reload. It is deleted when the tab is closed, when the order is finished or when **Clear saved details** is tapped. On the right, the payment method: Lightning. |

### 10.2 Modules (`src/store/`)

| Pure (with tests) | What for |
|---|---|
| `config.js` | Validates the `store` section of `catalog.json`. |
| `products.js` | Published T-shirts, final price, colors, related items, sections. |
| `cart.js`, `cart-store.js`, `persist.js` | Immutable cart, saving and synchronization; `localStorage` without exceptions. |
| `money.js` | Format by language (`$30.000` in Spanish, `ARS 30,000` in English) and sats, ARS → sats conversion, Yadio exchange rate. |
| `bolt11.js` | Decodes invoices: amount, payment hash, expiry (with checksum). |
| `lnurl.js` | LNURL-pay (LUD-06/12/16): requests the invoice and verifies the exact amount. |
| `payment.js` | Waits for the payment (polling), countdown, proof of payment with the preimage. |
| `order.js` | Order number `MS-XXXXXX`, payment comment and DM texts (always in Spanish, with the buyer's language). |
| `checkout-form.js` | Fields, validation (returns `required`, `tooLong` or `invalid`; the text comes from `strings`), provinces, saved data. |
| `query.js` | URL of the product page. |
| `qr.js` | QR with rounded modules and the Mostro logo, based on the one in donate. It has adjustments so it decodes in all versions. |
| `nostr-order.js` | NIP-17 DM to the store: the store's relays (kind 10050) and publishing. |
| `strings.js` | Store texts: `strings/en.js` and `strings/es.js`, with the same keys. |
| `../i18n.js` | Which language to show (`pickLanguage`) and `localizeJson`, which leaves `catalog.json` in one language. |

The DOM modules are `boot.js`, `cart-ui.js`, `product-card.js`, `home-page.js`, `product-page.js`, `size-guide.js`, `checkout-fields.js`, `checkout-page.js`, `payment-ui.js`, `icons.js` and `lang.js` (page language, fixed texts and the EN/ES button).

### 10.3 Catalogue fields

```json
{
  "store": {
    "currency": "ARS",
    "price": 30000,
    "lnAddress": "store@pay.mostro.foundation",
    "defaultColor": "black",
    "defaultSize": "L",
    "sizes": [{ "id": "S", "width": 49, "length": 69 }],
    "nostr": { "npub": "npub1…", "relays": ["wss://relay.mostro.network", "wss://nos.lol", "wss://relay.damus.io"] },
    "details": [{ "title": { "en": "Shipping", "es": "Envío" }, "text": { "en": "…", "es": "…" } }]
  },
  "designs": [{ "id": "mostro-invaders", "status": "published", "price": 35000, "description": "…" }]
}
```

- **`status`** can be `draft` (the default: only visible in the viewer, with a draft badge) or `published` (on sale). A series passes it down to its items, and each item can change it.
- **`price`** is optional per T-shirt; if it is missing, `store.price` is used. The currency is `store.currency`, and it is converted to sats at payment time.
- **`sizes`** carries `width` (armpit to armpit) and `length` (shoulder to hem), in cm, for the size guide. If a measurement is missing, "—" is shown.
- **`details`** are the accordions of the product page.
- **Translated texts:** any text can be `{ "en": …, "es": … }` (see §10.8).
- If `lnAddress` or `nostr` are invalid, the T-shirts are still displayed but checkout stays closed.

> ⚠️ Published items have a fixed `id` (`mostro-quotes-love-at-first-sat`, …). If you change a text, the ID does not change, and saved links and carts keep working.

### 10.4 Payment and order

1. **Exchange rate.** `https://api.yadio.io/exrates/BTC` is queried for the price of 1 BTC in ARS. The sats are computed as `⌈ARS × 10⁸ / rate⌉`.
2. **Order number.** `MS-` plus 6 characters in Crockford base32, without I, L, O or U.
3. **Invoice (LNURL-pay).** `GET https://pay.mostro.foundation/.well-known/lnurlp/store`, then `callback?amount=<msat>&comment=Pedido MS-… · store.mostro.network`. The comment carries only the order number, never personal data. The invoice is verified:
   - the callback must be on the same host as the LN address;
   - the invoice is for mainnet and for **exactly** the requested amount;
   - its timestamp differs from the current time by at most 10 minutes, and it expires between 1 minute and 24 hours later;
   - `verify` is accepted only if it is on the same origin as the callback.
4. **Encrypted order (NIP-17).** The full text (T-shirts, total, exchange rate, payment hash, address and contact) goes as a gift wrap (kind 1059) to `store.nostr.npub`.
   - It is signed by a throwaway key created for this checkout: the buyer does not need Nostr.
   - It is published to the store's DM relays (its kind 10050, if it exists) plus `store.nostr.relays`.
   - At least 2 relays must accept it (or 1, if only one is configured). Otherwise the invoice is not shown and the buyer can retry.
5. **QR.** Same style as donate, with buttons to copy, open the wallet and pay with WebLN if there is an extension. It shows the expiry countdown.
6. **Confirmation.** Every 3 s the browser queries `verify` (LUD-21) or, on LNbits, `GET /api/v1/payments/<hash>`. With WebLN, `sha256(preimage) == payment hash` is enough.
   - If 3 queries in a row fail, the page says it cannot confirm the payment and offers **I've paid**. This also applies if the endpoint used to respond and stopped.
   - When it is tapped, the order is closed and the store receives "⚠️ … el comprador dice que ya pagó, verificá el pago en la billetera" (in Spanish: "the buyer says they already paid, check the payment in the wallet").
7. **Paid.** The purchased T-shirts are removed from the cart (anything added afterwards, for example from another tab, stays), the shipping details are deleted, the order number is shown, and a second DM, "✅ Pedido … pagado" (Spanish for "Order … paid"), is sent in the same conversation.

Edge cases:

- **Expired invoice.** The buyer generates another one, which is a new order. If the last query failed, the page does not say the invoice expired: it asks the buyer not to pay again if they already paid.
- **"Change my details".** It cancels the invoice. Before discarding it, its status is queried one last time, in case it was paid just before.
- **Cart change.** If the contents change while the invoice is being prepared or shown (also from another tab), it is cancelled. Each step of the preparation checks that the attempt is still current, so an invoice is never built for an old cart.

> The "Payment received!" screen is informational. The source of truth is the wallet: only orders whose payment appears in LNbits with the comment `Pedido MS-…` are dispatched.

### 10.5 Automatic confirmation (Caddy route)

LNbits answers `GET /api/v1/payments/<payment_hash>` **without a key**, and in that case it returns only `{"paid": true|false}`. Its LNURLp extension does not offer LUD-21.

Since 2026-11-04, the Caddy of `pay.mostro.foundation` (server `lnbits`, `/etc/caddy/Caddyfile`) lets that single route through, in addition to the LNURL ones. It accepts only `GET` with a hash of 64 hexadecimal characters:

```caddy
	@paymentStatus {
		method GET
		path_regexp ^/api/v1/payments/[0-9a-f]{64}$
	}
	handle @paymentStatus {
		reverse_proxy 127.0.0.1:5000
	}
```

Checks of the change:

- `/.well-known/lnurlp/*` still responds.
- With a nonexistent hash, the route returns the LNbits JSON 404, with `access-control-allow-origin: *`.
- With a real unpaid invoice it returns `{"paid":false}`, also from a store page with its CSP.
- The rest of `/api` still returns the Caddy 404.

The backup is at `/etc/caddy/Caddyfile.bak-20261104-store-status`. No API of our own and no macaroon are needed: the browser handles no key.

### 10.6 Reading the orders

- **Development:** the key of a test npub lives only on the machine of whoever created it (`.secrets/` is in `.gitignore`).
  - To get your own, run `node scripts/dev-nostr-key.mjs`. It saves the key in `.secrets/store-nostr-dev.txt` and prints the npub.
  - Put that npub in `store.nostr.npub`, only in your test branch.
  - Import `secret_hex` into a client with NIP-17 (0xchat, Amethyst, Coracle…) to read the test orders.
- **Production:** `store.nostr.npub` is the store's npub: `npub1st0re749d5d02mwnf2c0vcj566p85y5wpnaz65llr8wt49cyp6kqe44n9m`.
  - The orders are read by signing in with its nsec in a client with NIP-17.
  - That npub should publish its kind 10050 with the relays of `store.nostr.relays`. Many clients look for DMs only there, and the store also publishes the orders to that list.
- **Reconcile:** match the "Pedido MS-XXXXXX" DM with the LNbits payment that has the same comment and the same payment hash.

### 10.7 Security and privacy

- **No injected HTML.** The whole DOM is built with `textContent`. Every page has a CSP (`script-src 'self'`, no inline) and `referrer: no-referrer`.
- **`connect-src` allows only** `api.yadio.io`, `pay.mostro.foundation` and `wss:` relays. **If the domain of the LN address changes, it must be added to the CSP** of `index.html`, `product.html` and `checkout.html`.
- **Bounded network requests.** All requests to APIs have a 10 s timeout and send no cookies or referrer. The store's relays (kind 10050) are limited to 6, and are never `localhost` or IPs.
- **Shipping details.** They are saved only in the tab (`sessionStorage`), so they are not lost if the page is reloaded. They are deleted when the tab is closed, when the order is finished or with "Clear saved details". If the tab stays open for more than 7 days, they are not restored on reload and are deleted. They are never left in `localStorage`.
- **DM text.** Each field goes on a single line, without control or direction (bidi) characters. This way the buyer cannot forge lines such as "✅ pagado" ("paid").
- **The wallet rules.** A DM can be forged, because anyone can write to the npub. Before dispatching:
  1. look up in LNbits the payment with that payment hash (and the comment `Pedido MS-…`);
  2. verify that it has been collected;
  3. verify that the amount covers the T-shirts at the catalogue price, with the exchange rate of that moment.
- **`src/vendor/`.** CI rebuilds it with `scripts/vendor/build.sh` and fails if it differs from what is committed.

### 10.8 Languages

- **Which one is shown.** `pickLanguage` takes the saved choice (`localStorage`, `mostro-store:lang`). If there is none, the first language of `navigator.languages` that is `en` or `es` (`es-AR`, `es_AR` and `es-419` count as `es`). If there is none, English.
- **EN/ES button.** It is in the header and shows the other language. It saves the choice and reloads the page: the cart (`localStorage`) and the checkout data (`sessionStorage`) survive. In checkout it is disabled from the moment the invoice is requested, so the reload does not lose it, and it stays that way on the confirmation screen, so the order number on screen is not lost. If the browser does not allow saving, the button does not appear.
- **Store texts.** `src/store/strings/en.js` and `es.js`. `lang.js` exports `T`, the table of the page language. A test compares the shape of the tables (same keys, lists of the same length, functions with the same arguments) and checks that the English one has no Spanish.
- **Fixed HTML texts.** They carry `data-i18n="key"` for the text or `data-i18n-attr="attribute:key"` for attributes (`aria-label`, `content`). The HTML ships in English with `<html lang="en">`. `translatePage` changes the texts and `lang`, and adds the class `i18n-ready`. Until then the CSS hides them (`visibility: hidden`), so a Spanish-speaking visitor does not see them jump from English.
- **Page that does not start.** Each store page loads about thirty modules, and if one fails to load (the network changed, the connection dropped) none of them runs: the buyer would see an empty page. So every store page carries, first in its `<main>`, a notice (`.boot-notice`) that says so and offers a link to the page itself to reload it. No script is left to show or translate it, so the CSS shows it, over the page's main, when `i18n-ready` is still missing after `--boot-notice-delay` (8 seconds, enough for a slow phone connection), and it says it in English and in Spanish, with no `data-i18n`. A page that starts never shows it and does not move: it sits out of the flow until then. If `store.css` is what failed, the notice shows without styles.
- **Catalogue.** `localizeJson(catalog, lang)` replaces each `{ "en": …, "es": … }` with the text in that language, before validating. If a translation is missing, English is used, and if that is missing too, the other one. The viewer always uses English.
- **Prices.** Spanish: `$30.000`. English: `ARS 30,000`, so they are not read as dollars.
- **Orders.** The DM to the store is always in Spanish (`Pedido MS-…`, `$30.000`) and adds `Idioma: inglés` or `Idioma: español` ("Language: English" or "Language: Spanish"), so the store can answer the buyer in their language. Color names come in the buyer's language.
- **Technical messages** (the "Technical detail" of an error: LNURL, invoice, Yadio, relays) are in English in both languages.

### 10.9 SEO and link previews

- **One page per product.** Link previews (Telegram, WhatsApp, X, Nostr clients) read the HTML and never run JavaScript, so a query string (`product.html?id=…`) cannot give each product its own preview. `npm run seo` (`scripts/seo.mjs`, pure logic in `scripts/seo-pages.mjs`) writes `<id>.html` for every product on sale: `product.html` with `data-product="<id>"`, the product's title, name, description and price in the HTML, and its own tags. `product-page.js` takes the product from `data-product`; `product.html?id=…` still works and moves to `<id>.html?color=…&size=…` with `history.replaceState`, so the address bar always holds the address worth sharing. The store links to those pages (`productHref`).
- **Tags** (as in MostroP2P/community): description, canonical URL, `theme-color`, Open Graph (`og:type` `product` with `product:price:*`, `og:image` 1200 × 630 with its alt text, `og:locale` `en_US` and `es_AR`), Twitter `summary_large_image` (`@MostroP2P`) and JSON-LD: `Product` with an `Offer` on each product page, `WebSite` with the Mostro P2P publisher on the collection. They live between `<!-- SEO: generated … -->` and `<!-- /SEO -->`; `product.html` itself is `noindex`, since every product has its page. JSON-LD is a data block, so the `script-src 'self'` policy does not block it; catalog text is escaped, and `<` in the JSON is written `\u003c`.
- **Images.** `scripts/og-images.mjs` draws `assets/og/<id>.jpg` and `assets/og/store.jpg` (1200 × 630, JPEG, 50–85 KB) in Chromium through `scripts/og/card.html`, with the store's own renderer: the shirt in its default color, the name, the price and the domain. They are not committed: the `site` job of `.github/workflows/pages.yml` draws them into the site it publishes (`npm run og-images -- _site`), from the same `catalog.json`, so they cannot fall behind it. A preview shows the default color, whatever color the shared link had. The store card shows three set shirts while they are on sale; the slot of one that is not goes to the next shirt on sale that is not on the card already, and fewer shirts on sale fill fewer slots (`scripts/og-cards.mjs`).
- **Search engines.** `robots.txt` allows everything and points at `sitemap.xml` (the collection and every product page). `checkout.html`, `product.html` and `viewer.html` are `noindex`.
- **Kept in step.** `tests/seo.test.js` fails when a page or the sitemap is out of date, when a page points at an image the deploy does not draw, or when a product page was left behind by a product no longer on sale (`npm run seo` deletes it). An id that would take the name of a store page (`index`, `product`, `checkout`, `viewer`, `404`) or of the store's image (`store`), or is not lowercase letters, digits and hyphens starting with a letter or digit, is refused.

### 10.10 Pending

- Real measurements for each size: the ones in `catalog.json` are approximate.
- Shipping policy and cost (today it says "To be arranged").
- Publish the kind 10050 (DM relays) from the store's npub.
- Optional hardening:
  - a second exchange-rate source, to detect an anomalous Yadio price;
  - pin the pubkey of the store's node and verify the invoice signature;
  - pin the GitHub Actions by SHA.
