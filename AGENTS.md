# AGENTS.md

Instructions for coding agents (Claude Code, Codex, Cursor, Aider and similar) working
in this repository. Humans are welcome to read it too; nothing here is addressed only to
a machine.

Read [`docs/SPEC.md`](docs/SPEC.md) before changing anything: §10 describes the store,
its payment flow and its security rules. `README.md` is the operator's guide.

## Everything written here is in English

Source, identifiers, comments, documentation, test names and fixtures, commit messages,
branch names, pull request titles and bodies, issue titles and bodies, review comments,
and replies to review comments, including replies to automated reviewers. All of it,
always, in English.

Conversation with the maintainer may happen in Spanish. The artifacts do not: a comment
on a pull request is an artifact, and so is a reply to a reviewer. Mostro is worked on
across several languages, and a thread nobody outside one of them can follow is a
decision taken in private in a public place.

The exceptions are texts written for a Spanish-speaking reader, and only the text
itself:

- the Spanish user-interface catalogue, `src/store/strings/es.js`, which exists to be
  translated (the English catalogue, `src/store/strings/en.js`, is the source);
- the `es` values of translated texts in `catalog.json`;
- the messages the store receives over Nostr (`src/store/order.js`), which the store
  operator reads in Spanish.

Their keys, and every comment around them, stay in English.

If you are prompted in another language, answer the person in that language, but write
English into the repository, the pull request and the issue tracker.

## What this project is

The Mostro t-shirt store at `store.mostro.network`, plus an internal viewer
(`viewer.html`) to preview designs on every shirt colour. It is a static site on GitHub
Pages: no backend, no database, no accounts, no build step. Everything is configured in
`catalog.json`.

```text
browser ──► GitHub Pages                 pages, catalog.json, src/, designs/
        ──► api.yadio.io                  BTC price in the store currency (ARS)
        ──► LN address (LNURL-pay)        invoice whose comment is the order number
        ──► pay.mostro.foundation         payment status (LUD-21 verify, or the LNbits status route)
        ──► Nostr relays (wss)            the order, as a NIP-17 gift wrap to the store's npub
```

Properties everything else serves. None is negotiable in a patch:

- **The wallet is the source of truth.** The "Payment received!" screen runs in the
  buyer's browser and anyone can message the store's npub. The store ships only what it
  sees settled in its wallet. Nothing in the page may present itself as proof of payment
  to the store.
- **Buyer data travels only encrypted to the store.** Address and contact details go in
  the NIP-17 message and nowhere else: not in the invoice comment, not to Yadio, not to
  the Lightning server. In the browser they live only in the tab (`sessionStorage`),
  never in `localStorage`, and are deleted when the order completes.
- **No tracking.** No cookies, analytics or third-party scripts. Every page has a
  Content-Security-Policy and `referrer: no-referrer`.
- **The buyer pays exactly what the page showed.** The invoice is checked before it is
  shown: exact amount in millisatoshis, Bitcoin mainnet, a sane date and expiry, and a
  callback on the LN address's own host.
- **An invoice in flight is never lost.** Nothing may reload, cancel or forget an
  invoice the buyer may be paying; a payment confirmed late still completes its order.

## Stack

Plain HTML, CSS and ES modules. No framework, no bundler, no build step, nothing to
install to run the site. Do not introduce a framework or a build tool to save typing.
The only third-party code is vendored in `src/vendor/` (nostr-tools and
qrcode-generator, pinned), rebuilt reproducibly from `scripts/vendor/`.
The browser tests are the one exception to "nothing to install": they need `npm ci`
(playwright-core, pinned) and Chromium.

| Path | Purpose |
|---|---|
| `index.html`, `product.html`, `checkout.html` | The store: collection, product page, checkout |
| `viewer.html` | The internal viewer: every shirt, drafts included, in any colour |
| `<id>.html` (generated) | One page per product on sale: `product.html` with that product's title, text and preview tags; never edit by hand |
| `robots.txt`, `sitemap.xml` (generated) | For search engines; the sitemap lists the collection and every product page |
| `favicon.ico`, `apple-touch-icon.png` | The tab and home-screen icons, from the Mostro logo (`designs/characters/mostro.png`); at the root, where clients ask for them without reading the HTML |
| `assets/og/` (drawn at deploy, not committed) | The link preview images, 1200 × 630: `store.jpg` and `<id>.jpg` per product |
| `catalog.json` | Shirts, series, colours, prices, sizes, LN address, the store's npub and relays, product-page details |
| `css/` | `base.css` (tokens, buttons), `store.css`, `viewer.css` |
| `src/catalog.js` | Validation and normalisation of `catalog.json` |
| `src/render.js`, `src/shirt.js`, `src/shading.js`, `src/text.js`, `src/layouts.js`, `src/color.js` | The shirt renderer, shared by the store and the viewer |
| `src/loader.js`, `src/dom.js` | Loading the catalogue, fonts and images; `el()` / `svgEl()`, the DOM without `innerHTML` |
| `src/i18n.js` | Which language to show, and `localizeJson` for the catalogue's translated texts |
| `src/store/` (pure) | `config`, `products`, `cart`, `cart-store`, `persist`, `money`, `bech32`, `bolt11`, `lnurl`, `payment`, `order`, `checkout-form`, `query`, `qr`, `nostr-order`, `strings` |
| `src/store/` (DOM) | `boot`, `lang`, `home-page`, `product-page`, `product-card`, `cart-ui`, `size-guide`, `checkout-fields`, `checkout-page`, `payment-ui`, `icons` |
| `src/store/strings/` | The English and Spanish user-interface catalogues |
| `src/viewer/` | The viewer |
| `src/vendor/` | Vendored bundles; never edit them by hand |
| `scripts/serve.py` | The local server, without cache |
| `scripts/vendor/` | The pinned recipe that builds `src/vendor/` |
| `scripts/dev-nostr-key.mjs` | A development Nostr key, written to `.secrets/` |
| `scripts/seo.mjs`, `scripts/seo-pages.mjs` | Write the SEO blocks, the product pages and the sitemap from `catalog.json` |
| `scripts/og-images.mjs`, `scripts/og/`, `scripts/og-cards.mjs` | Draw the preview images in Chromium, with the store's own renderer |
| `tests/` | `node --test` suites, one per pure module |
| `tests/e2e/` | Browser tests (playwright-core): every page, with Yadio, the LN address, the payment status and the relays answered locally; `report.js` joins the coverage of both kinds of test |
| `.github/workflows/pages.yml` | Tests with coverage, the vendor check and the site with its preview images on every pull request; deploy on `main` |
| `docs/SPEC.md` | The specification |

When you add a file, follow the layout above. If the spec and this table disagree, the
spec wins and this file gets fixed.

## Commands

Node 24 and Python 3. The site and the unit tests install nothing; the browser tests need
`npm ci` and `npx playwright-core install --only-shell chromium` once (`CHROMIUM_PATH` may point at
another Chromium).

| Command | What it does |
|---|---|
| `npm start` | The site at `http://localhost:8000` (viewer at `/viewer.html`) |
| `npm test` | Every suite under `tests/` |
| `npm run coverage` | The same, failing under 100% of lines, functions or branches of what they load in `src/` |
| `npm run test:e2e` | Every page in Chromium (`tests/e2e/*.e2e.js`); no request leaves the machine |
| `npm run coverage:all` | Both, then the line coverage of every file in `src/` by either; fails under 100% |
| `npm run seo` | Rewrites the SEO blocks of `index.html` and `product.html`, every `<id>.html` and `sitemap.xml` |
| `npm run og-images` | Draws the preview images into `assets/og/` (ignored by git) to look at them; `-- _site` draws them into the site, as the deploy does |
| `sh scripts/vendor/build.sh` | Rebuild `src/vendor/` from `scripts/vendor/` |
| `node scripts/dev-nostr-key.mjs` | Create a development key in `.secrets/` (never overwrites one) |

CI runs `npm run coverage`, checks that `src/vendor/` is exactly what the recipe builds,
runs `npm run coverage:all` in Chromium, and draws the preview images into the site it
publishes. Run both coverage commands before opening or updating a pull request, and
report the real result.

## How code is written here

- **Tests first.** Write the test, watch it fail, then implement. Tests are named for the
  behaviour they pin, not for the function they call.
- **Pure where it can be.** Decisions (prices, validation, invoices, order texts, what is
  in the cart) live in pure modules with unit tests, held at 100% of lines, branches and
  functions. Node reports coverage only for files a test loads, so a new module without a
  test is invisible to the threshold: write its test first.
- **DOM modules are covered in the browser.** They only render and wire events, and
  `tests/e2e/` drives them; CI holds the unit and browser tests together at 100% of the
  lines of `src/`. A change to a DOM module needs a browser scenario. A branch that can
  never run is removed, not tested.
- **Small files, organised by domain.** 200 to 400 lines is typical, 800 the limit.
  Extract rather than append.
- **Immutable data.** Return new values; do not mutate what you were handed.
- **Errors are explicit.** No silent `catch`, except a best-effort step whose comment
  says why it may fail.
- **Configuration lives in `catalog.json`.** No magic numbers; name constants.
- **Comments say why.** The what is in the code.

## Things that bite

- **Testing the checkout by hand is real.** (The browser tests are not: their harness
  answers every outside service and blocks the rest.) It asks the configured LN address for real invoices
  and sends real orders to the store's npub. Point `store.nostr.npub` at a development
  key on a local branch (`node scripts/dev-nostr-key.mjs`), never commit that change to
  `main`, and never pay an invoice or send an order without the maintainer's go-ahead.
- **Everything from outside is untrusted.** `catalog.json`, LNURL answers, BOLT11
  invoices, Yadio, relay answers and everything the buyer types. Validate before use.
  Write text with `textContent` or `el()`, never `innerHTML`.
- **The invoice checks in `lnurl.js` and `bolt11.js` stay strict.** Callback host pinned
  to the LN address, exact amount, mainnet, timestamp within 10 minutes, expiry between
  60 seconds and 24 hours, a `verify` URL only on the callback's origin. Never relax one
  to make a wallet or a test work.
- **Buyer text in the order message is flattened** to one line per field, without control
  or bidi characters, so nobody can fake a line such as "✅ paid". Keep it that way.
- **The Content-Security-Policy is a meta tag in each page.** A new API or LN address
  domain goes in `connect-src` of `index.html`, `product.html` and `checkout.html`.
  Never add `'unsafe-inline'`, `'unsafe-eval'` or a wildcard host.
- **Two catalogues.** A new user-facing string needs an English and a Spanish entry with
  the same key. Static text in the HTML carries `data-i18n="key"` and ships in English.
  The one exception is the notice for a page whose scripts never started (`.boot-notice`):
  no script is left to translate it, so it carries both languages itself. Translatable texts in `catalog.json` are `{ "en": …, "es": … }`. The tests fail if the
  catalogues differ in shape or if Spanish is left in the English one.
- **Published product ids never change.** They are in links, in saved carts and in the names
  of the product pages.
- **Product pages are generated.** A link preview never runs JavaScript, so each product on
  sale has a static page of its own (`<id>.html`) with its tags and image. After changing
  `catalog.json`, `product.html` or the head of `index.html`, run `npm run seo`;
  `tests/seo.test.js` fails when the pages or the sitemap are out of date. Edit
  `product.html`, never an `<id>.html`.
- **Preview images are never committed.** The deploy draws them from the catalog it
  publishes (the `site` job), so they cannot go out of date. Do not add `assets/og/` back to
  the repository.
- **Page names and query parameters are part of those links.** Renaming one breaks every
  link already shared; the pull request says so, and adds a redirect when the old links matter.
- **Storage keys are a contract.** `mostro-store:cart` and `mostro-store:lang` in
  `localStorage`, `mostro-store:checkout` in `sessionStorage`. Changing a format needs a
  migration or a tolerant reader; every read already survives corrupt or blocked
  storage.
- **`src/vendor/` is generated.** To upgrade, change the version in
  `scripts/vendor/package.json` and run `sh scripts/vendor/build.sh`; CI fails if the
  committed bundle differs.
- **The QR must scan.** Finder centres stay dark and the logo never covers an alignment
  pattern. After touching `qr.js`, decode the result across QR versions.
- **No secrets in the repository.** `.secrets/` is ignored and stays that way. No nsec,
  macaroon or API key in code, tests, fixtures or pull requests.

## Git and GitHub

- Branch from `main`; never commit to it directly.
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`,
  `perf:`, `ci:`. The subject says what changed; the body says why it needed to.
- One concern per pull request. A catalogue change and a feature belong in separate pull
  requests.
- A pull request describes the change, the reasoning, and a test plan a reviewer can
  run. Mark what you could not verify; an unverified step said plainly is worth more
  than a checked box that was not. Never claim a check passed without running it.
- Answer review comments, including Codex and CodeRabbit. Fix what is real, and say
  briefly why for what is not; a finding you disagree with still deserves a reply.
- In English. See the top of this file.

## Guidance for agents

- Read before you edit. Match the conventions of the surrounding code instead of
  importing habits from other projects.
- Stay within the scope you were asked for. Surface adjacent problems rather than fixing
  them unprompted.
- Say what you did not verify. A change that passes `node --test` has not been seen in a
  browser, against a real LN address or against real relays.
- Never weaken a validation rule, an invoice check, the CSP or a test to make something
  go green.
