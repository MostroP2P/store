# Mostro Store

The Mostro T-shirt store, at **[store.mostro.network](https://store.mostro.network)**, and the internal viewer used to decide which T-shirts to print.

It is a static site: no database, server, user accounts or build. Everything is configured in one file, `catalog.json`.

- **Payment** is in bitcoin, over Lightning, to an LN address.
- **Orders** reach the store account encrypted over Nostr (NIP-17).
- **The buyer's address** is not stored on any server.
- **Languages:** English by default, or Spanish if the browser is in Spanish. The **EN/ES** button in the header switches the language.

## Contents

1. [Try it on your machine](#1-try-it-on-your-machine)
2. [How a customer buys](#2-how-a-customer-buys)
3. [How orders reach you (Nostr)](#3-how-orders-reach-you-nostr)
4. [How payments reach you (Lightning)](#4-how-payments-reach-you-lightning)
5. [What to do with each order](#5-what-to-do-with-each-order)
6. [Configuration: `catalog.json`](#6-configuration-catalogjson)
7. [Add or change T-shirts](#7-add-or-change-t-shirts)
8. [Privacy and security](#8-privacy-and-security)
9. [Development](#9-development)
10. [Publish to store.mostro.network](#10-publish-to-storemostronetwork)
11. [To do](#11-to-do)

---

## 1. Try it on your machine

You need Python 3 for the local server and Node 24 for the tests. There are no dependencies, so there is no need to run `npm install`.

```bash
npm start              # store: http://localhost:8000 · viewer: http://localhost:8000/visor.html
npm test               # unit tests
npm run coverage       # tests + coverage (80 % minimum)
```

`npm start` uses `scripts/serve.py`, a server with no cache, so changes to `catalog.json` or to the images show up on reload.

> ⚠️ **Testing the checkout sends real orders.** They reach the configured npub and real invoices are requested from the LN address. To test without filling the store's inbox, use a development key ([§9](#9-development)).

## 2. How a customer buys

The store shows in **English**, or in **Spanish** if the buyer's browser is in Spanish (the first language in its list that is English or Spanish counts). The **EN/ES** button in the header switches the language and remembers it in that browser. While an invoice is in progress the button is disabled, so a reload does not lose it.

1. **Collection** (`index.html`): the buyer sees all the T-shirts for sale, grouped by series.
2. **Product** (`producto.html`): the buyer picks the color and the size. "Size guide" shows the measurements table.
   - **Add to cart** adds the T-shirt. The button shows how many of that variant are in the cart, for example "Add to cart (1)".
   - **Buy now** adds it and goes straight to the checkout.
3. **Cart**: the button at the top right shows the number of T-shirts.
   - In the "Your cart" panel the buyer can add or remove each T-shirt, delete it, use **Empty cart**, or go to **Checkout**.
   - The cart is saved in the browser, even if the buyer closes the page.
4. **Checkout** (`checkout.html`): the buyer fills in where to receive the order and their contact details, then taps **Pay with Lightning**. The page:
   1. converts the total in pesos to sats using the [Yadio](https://api.yadio.io/exrates/BTC) exchange rate;
   2. requests an invoice from the store's LN address;
   3. sends the encrypted order to the store over Nostr;
   4. shows the QR, with buttons to copy the invoice, open the wallet or pay with a WebLN extension.
5. **Confirmation**: when the page sees the payment, it shows "Payment received!" with the order number, and removes those T-shirts from the cart.
   - The page checks the payment status every 3 seconds ([§4](#4-how-payments-reach-you-lightning)).
   - If that check fails 3 times in a row, it offers **"I've paid"**, which closes the order and notifies the store.

If the invoice expires, the buyer can create another one. Each attempt is a new order, with a different number.

## 3. How orders reach you (Nostr)

Orders arrive as **Nostr private messages (NIP-17)** to the store account:

```
npub1st0re749d5d02mwnf2c0vcj566p85y5wpnaz65llr8wt49cyp6kqe44n9m
```

It is set in `catalog.json`, in `store.nostr.npub`.

**To read them**, log in with the private key of that account (nsec) in **0xchat** or **Amethyst**. Orders arrive from an unknown key, so they may show up in the requests or unknown senders section, not in the main inbox.

> ⚠️ **Do not use Nostrich to read the orders.** It understands NIP-17, but it discards messages from accounts without a profile: it shows them neither in "Requests" nor in "Hidden requests" (see `splitInbox` in `apps/web/lib/chat-inbox.ts` of [nostrich-client](https://github.com/nostrichOS/nostrich-client)). Each order is sent from a disposable key without a profile, so it never shows up, even if the push notification arrives.

Each order arrives as a message with the subject `Pedido MS-XXXXXX`:

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

Messages to the store are always in Spanish, by design. The `Idioma` line says which language the buyer used (`inglés` or `español`), so you can reply in that language. The color name also comes in that language.

A second message can arrive in the same conversation:

- **`✅ Pedido MS-… pagado`**: the page saw the payment confirmed.
- **`⚠️ Pedido MS-…: el comprador dice que ya pagó`**: the buyer tapped "I've paid" because the page could not confirm the payment.

If neither arrives, check the wallet anyway: the buyer may have paid and closed the page without tapping "I've paid".

**Some things to know:**

- **You cannot reply over Nostr.** Each order is sent from a disposable key, so the buyer does not need Nostr. Write to the buyer by email or phone, using the order details.
- **Relays.** Orders are published to the relays in `store.nostr.relays` (`relay.mostro.network`, `nos.lol`, `relay.damus.io`) and to the store's private message relays, if it has published them.
  - At least 2 relays must accept each order. Otherwise the page does not show the invoice.
- **Recommended: publish the store's DM relays (kind 10050).** Today the npub does not have that list, and many clients only look for private messages there.
  - From the store account, set those same three relays as private message relays in your client.
  - The store finds them on its own and sends the orders there.

## 4. How payments reach you (Lightning)

Payments go to the LN address in `store.lnAddress`, which is **`store@pay.mostro.foundation`**, an LNbits instance.

- It accepts between 1,000 and 1,000,000 sats per order: at the current rate, about 44 T-shirts at most.
- It accepts comments of up to 100 characters; the order comment takes about 40.

- **Amount:** the price in pesos (`store.price`, today $30.000 per T-shirt) converted to sats at the time of payment, rounded up.
- **Payment comment:** `Pedido MS-XXXXXX · store.mostro.network`. This is how you tell which order each payment belongs to, and it never carries personal data.
- **Checks made by the page:** before showing the invoice, it checks that it is a mainnet invoice, that it is for exactly the requested amount, that it has a reasonable date and expiry, and that it was issued by the same server as the LN address.

### Automatic payment confirmation

It has been active since 4/11/2026.

- LNbits answers, without a key, whether an invoice was paid: `GET /api/v1/payments/<payment_hash>` returns only `{"paid": true|false}`.
- The page checks it every 3 seconds and, when the payment arrives, shows "Payment received!" by itself.
- If the buyer pays with a WebLN extension (for example Alby), the confirmation does not depend on this check.

For this to work, the Caddy of `pay.mostro.foundation` lets that single route through, in addition to the LNURL ones. It is on the `lnbits` server, in `/etc/caddy/Caddyfile`:

```caddy
	@paymentStatus {
		method GET
		path_regexp ^/api/v1/payments/[0-9a-f]{64}$
	}
	handle @paymentStatus {
		reverse_proxy 127.0.0.1:5000
	}
```

**It is safe:**

- Without a key, LNbits only answers whether the invoice is paid: it does not show amounts, comments or balance.
- Only the buyer and the store know the hash of an invoice.
- Only `GET` with exactly 64 hexadecimal characters gets through. The rest of the LNbits API (create invoices, pay, view the wallet) still returns 404.

**If the check fails** (because of Caddy, LNbits or the network), the page keeps trying. After 3 failures in a row it offers **"I've paid"**: the order is closed and the store gets a notice to verify the payment in the wallet.

**To verify the route:**

```bash
curl -i -H 'Origin: https://store.mostro.network' \
  https://pay.mostro.foundation/api/v1/payments/0000000000000000000000000000000000000000000000000000000000000000
```

- **It works:** it returns `404` with `{"detail":"Payment does not exist."}` and the header `access-control-allow-origin: *`. LNbits is answering.
- **It is blocked:** it returns `404` with an empty body. Caddy is answering.

**To undo it**, on the server:

```bash
cp /etc/caddy/Caddyfile.bak-20261104-store-status /etc/caddy/Caddyfile && systemctl reload caddy
```

## 5. What to do with each order

> **The wallet is the source of truth, not the messages.** Anyone can send a message to the store's npub, and the "Payment received!" screen runs in the buyer's browser. Only ship what you see paid in the wallet.

1. **Read the order.** Look for the DM `Pedido MS-XXXXXX` in the store's Nostr client.
2. **Find the payment in LNbits**, with the same `Pedido MS-XXXXXX` comment and the same payment hash.
3. **Check that it is paid and that the amount covers** those T-shirts at the catalog price, at the exchange rate of that moment.
4. **Write to the buyer** at the email or phone in the order to arrange shipping, in the language of the `Idioma` line. The current text says "Shipping: to be arranged".
5. **If there is a DM with no payment**, the buyer did not pay, or paid another invoice for the same cart (each attempt generates a new number). In that case, do not ship.

## 6. Configuration: `catalog.json`

### The `store` section

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

| Field | What it is |
|---|---|
| `currency` | Currency of the prices. It is converted to sats with Yadio. |
| `price` | Default price of each T-shirt. |
| `lnAddress` | Where payments are received. If it changes domain, update the CSP (see below). |
| `defaultColor` | Color shown first. |
| `defaultSize` | Size shown first. |
| `sizes` | Sizes. `width` is the width from armpit to armpit and `length` the length from shoulder to hem, both in cm, for the size guide. |
| `nostr.npub` | Account that receives the orders. It must be a valid npub: otherwise the checkout stays closed. |
| `nostr.relays` | `wss://` relays where the orders are published. |
| `details` | The accordions on the product page: shipping, payment, privacy… |

If `lnAddress` or `nostr` are invalid, the T-shirts still show, but nobody can pay.

**If the LN address changes domain**, add it to the `connect-src` of the `Content-Security-Policy` in `index.html`, `producto.html` and `checkout.html`. Otherwise the browser blocks the invoice request.

### Texts in English and Spanish

Every text the buyer sees in `catalog.json` can be given in both languages, as an object with `en` and `es`:

```json
{ "id": "black", "name": { "en": "Black", "es": "Negro" }, "hex": "#1a1a1a" }
```

- **Where:** color names, `description` and `name` of designs, series and items, and `title` / `text` of `store.details`.
- **A text that is the same in both languages** can stay as a string, for example the phrases on the T-shirts ("Love at first sat").
- **If a translation is missing** (or empty), the English one is used, and if that is missing too, the other one.
- **Only the keys `en` and `es` count.** An object with other keys is not taken as a translation, and the name falls back to the `id`.
- A test (`tests/i18n.test.js`) opens `catalog.json` in both languages and fails if anything is left in Spanish in the English version.
- The viewer shows the catalog in Spanish.

### Fields of each T-shirt

| Field | What it is |
|---|---|
| `status` | `"published"` puts it on sale. Without this field it stays as a draft: it only shows in the viewer, with a draft label. A series passes it on to its T-shirts. |
| `price` | Its own price. If missing, `store.price` is used. |
| `description` | Text shown under the name, on the product page. |
| `id` | Set it before publishing, and do not change it afterwards: it is used in links and in saved carts. |
| `colors` | Colors it is sold in. If missing, it is sold in all of them. |

## 7. Add or change T-shirts

The viewer (`visor.html`) shows all the T-shirts in the catalog, drafts included, in any color, and lets you download the PNG. Use it to decide what to publish.

- **Add a T-shirt to a series:** add `{ "id": "mostro-quotes-…", "image": "designs/stickers/…png", "text": "Tu mensaje" }` to `items`.
- **Add a whole design:** put the transparent PNG in `designs/` and add it to `designs`.
- **Put it on sale:** add `"status": "published"` to it.
- **Change the font of a series:** copy the file to `assets/fonts/` and change `"font"` in the series `style`.
- **Calibrate the print area:** open `/visor.html?debug`.

The full catalog format is in [docs/SPEC.md](docs/SPEC.md) (§4 and §10).

## 8. Privacy and security

- **The buyer's address** only travels encrypted to the store's npub.
  - Neither Yadio nor the Lightning server see it: the payment only carries the order number.
  - In the browser it is stored only in that tab (`sessionStorage`), and it is deleted when the tab is closed, when the order ends, or with "Clear saved details".
- **No cookies, analytics or third-party scripts.** Each page has a Content-Security-Policy and `referrer: no-referrer`. Requests to APIs have a 10 s timeout.
- **The order text** is sanitized before it is sent, so nobody can inject fake lines such as "✅ pagado" into the shipping data.
- **Third-party libraries** are kept in `src/vendor/`: nostr-tools and qrcode-generator, with pinned versions. CI rebuilds them from `scripts/vendor/` and fails if they differ from what is committed.
- **Keys:** the repo stores none. `.secrets/` is in `.gitignore` and is never published.

## 9. Development

```
index.html, producto.html, checkout.html   store
visor.html                                 viewer
catalog.json                               T-shirts, prices, sizes, payment and npub
css/                                       base.css (colors, buttons), store.css, viewer.css
src/                                       T-shirt rendering, shared by viewer and store
src/i18n.js                                page language and catalog.json translations
src/store/                                 store: cart, checkout, LNURL, BOLT11, Nostr, QR…
src/viewer/                                viewer
src/vendor/                                prebuilt third-party libraries (see its README)
scripts/serve.py                           local server with no cache
scripts/vendor/                            reproducible recipe for src/vendor/
scripts/dev-nostr-key.mjs                  development Nostr key
tests/                                     unit tests (node --test)
docs/SPEC.md                               full design
```

The repo rules:

- Modules that do not touch the DOM have tests with 80 % coverage or more (today, around 99 %).
- The store texts are in `src/store/strings/en.js` and `src/store/strings/es.js`, with the same keys: a test fails if one language is missing something or if Spanish is left in the English one.
- Fixed texts in the HTML files carry `data-i18n="key"` (or `data-i18n-attr="aria-label:key"`). The HTML holds the English, and `src/store/lang.js` changes it to the page language.

### Test the checkout without bothering the store

So that test orders do not reach the real npub, use your own key:

1. Run `node scripts/dev-nostr-key.mjs`. It saves the key in `.secrets/store-nostr-dev.txt` (it never overwrites an existing one) and prints an npub.
2. Put that npub in `store.nostr.npub`, **only in your local copy or in a test branch**. Do not push it to `main`.
3. Import the `secret_hex` from the file into a NIP-17 client to read your orders.

Invoices are still requested from the configured LN address. They stay unpaid and expire on their own.

### Update the third-party libraries

See [src/vendor/README.md](src/vendor/README.md). In short: change the versions in `scripts/vendor/package.json` and run `sh scripts/vendor/build.sh`.

## 10. Publish to store.mostro.network

`.github/workflows/pages.yml` runs on every push to `main`:

1. it runs the tests with coverage;
2. it checks that `src/vendor/` is identical to what `scripts/vendor/` builds;
3. it publishes the `*.html` pages, `css/`, `catalog.json`, `src/`, `assets/` and `designs/` to GitHub Pages.

On pull requests only the first two steps run, without publishing.

Setup (one time only, already done):

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. **DNS of `mostro.network`:** create a `CNAME` record from `store` to `mostrop2p.github.io`.
3. **Settings → Pages → Custom domain:** enter `store.mostro.network` and check **Enforce HTTPS**.
4. **Recommended:** verify `mostro.network` in the organization (**Settings → Pages → Verified domains**), so nobody else can take the subdomain.

> With deployment through Actions, GitHub ignores the `CNAME` file: the domain is configured only in Settings.

## 11. To do

- [ ] **Store DM relays:** publish the kind 10050 from the store's npub ([§3](#3-how-orders-reach-you-nostr)).
- [ ] **Real measurements for each size** in `store.sizes`: the current ones are approximate.
- [ ] **Shipping text and cost** in `store.details`: it currently says "to be arranged".
- [ ] **One real payment** with a mobile wallet after the deploy.
