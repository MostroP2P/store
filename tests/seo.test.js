import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  seoFiles, productHtml, headTags, withSeoBlock, sitemapXml, publishedProducts, isGeneratedProductPage,
  escapeHtml, ogImagesNeeded, ogImage, SITE_URL,
} from '../scripts/seo-pages.mjs';
import { seoPlan } from '../scripts/seo.mjs';

const ROOT = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, ROOT), 'utf8');
const catalog = async () => JSON.parse(await read('catalog.json'));

const metaContent = (html, key, name) => new RegExp(`<meta ${key}="${name}" content="([^"]*)">`).exec(html)?.[1];
const jsonLdOf = (html) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)[1]);

test('the committed pages and sitemap match catalog.json (run `npm run seo`)', async () => {
  const { changed, stale } = await seoPlan();
  assert.deepEqual([...changed.keys()], [], 'out of date');
  assert.deepEqual(stale, [], 'pages of products no longer on sale');
});

test('every preview image a page points at is one the deploy draws (`npm run og-images`)', async () => {
  const raw = await catalog();
  const files = seoFiles(raw, { 'index.html': await read('index.html'), 'product.html': await read('product.html') });
  const drawn = new Set(ogImagesNeeded(raw).map((name) => `${SITE_URL}/${ogImage(name)}`));
  const image = /<meta (?:property="og:image"|name="twitter:image") content="([^"]*)">/g;
  const pointedAt = [...files.values()].flatMap((html) => [...html.matchAll(image)].map((match) => match[1]));
  assert.equal(pointedAt.length, 2 * (files.size - 1), 'og:image and twitter:image on every page');
  assert.deepEqual(pointedAt.filter((url) => !drawn.has(url)), []);
  assert.equal(drawn.size, files.size - 2, 'the store card and one per product page');
});

test('every product on sale gets a page of its own, with its preview tags', async () => {
  const files = seoFiles(await catalog(), { 'index.html': await read('index.html'), 'product.html': await read('product.html') });
  const page = files.get('mostro-invaders.html');
  assert.match(page, /<html lang="en" data-product="mostro-invaders">/);
  assert.match(page, /<title>Mostro Invaders · Mostro Store<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/store\.mostro\.network\/mostro-invaders\.html">/);
  assert.equal(metaContent(page, 'property', 'og:image'), `${SITE_URL}/assets/og/mostro-invaders.jpg`);
  assert.equal(metaContent(page, 'property', 'og:type'), 'product');
  assert.equal(metaContent(page, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(metaContent(page, 'name', 'description'), 'The Mostros invade the screen, arcade style.');
  assert.match(page, /id="product-price">ARS 30,000</);
  const data = jsonLdOf(page);
  assert.equal(data['@type'], 'Product');
  assert.deepEqual(data.offers, {
    '@type': 'Offer', price: '30000', priceCurrency: 'ARS', availability: 'https://schema.org/InStock', url: `${SITE_URL}/mostro-invaders.html`,
  });
  assert.equal(isGeneratedProductPage(page), true);
  // The generic page stays out of search results; the collection is the site's entry
  assert.equal(metaContent(files.get('product.html'), 'name', 'robots'), 'noindex');
  assert.equal(isGeneratedProductPage(files.get('product.html')), false);
  assert.equal(jsonLdOf(files.get('index.html'))['@type'], 'WebSite');
  assert.match(files.get('sitemap.xml'), /<loc>https:\/\/store\.mostro\.network\/mostro-invaders\.html<\/loc>/);
});

test('catalog text cannot break out of an attribute, an element or the JSON-LD', async () => {
  const template = await read('product.html');
  const product = { id: 'x', name: 'A "quote" </script><b>', description: "It's <b>bold</b> & more", price: 1 };
  const page = productHtml(template, product, 'ARS');
  assert.ok(!page.includes('<b>'));
  assert.match(page, /content="A &quot;quote&quot; &lt;\/script&gt;&lt;b&gt; · Mostro Store"/);
  assert.equal(jsonLdOf(page).name, product.name);
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('a product without its own description gets the store one', async () => {
  const page = productHtml(await read('product.html'), { id: 'x', name: 'X', description: null, price: 1 }, 'ARS');
  assert.equal(metaContent(page, 'name', 'description'), 'A Mostro T-shirt. Pay with Lightning; your details travel encrypted over Nostr.');
  assert.match(page, /<p class="product-lead" id="product-lead" hidden><\/p>/);
});

test('ids that would take the name of a store page, or are not plain, are refused', async () => {
  const raw = await catalog();
  const withId = (id) => ({ ...raw, designs: [{ ...raw.designs[0], id }], series: [] });
  assert.throws(() => publishedProducts(withId('checkout')), /cannot name a page: checkout/);
  assert.throws(() => publishedProducts(withId('Mostro Invaders')), /cannot name a page/);
  // store.jpg is the store's preview image
  assert.throws(() => publishedProducts(withId('store')), /cannot name a page: store/);
  // "-shirt.html" would read as an option to the shell commands that copy the pages
  assert.throws(() => publishedProducts(withId('-shirt')), /cannot name a page: -shirt/);
  assert.throws(() => publishedProducts({}), /catalog\.json has errors/);
  assert.throws(() => publishedProducts({ ...raw, store: null }), /no usable "store" section/);
});

test('a page without the SEO markers is refused, not silently left without tags', () => {
  assert.throws(() => withSeoBlock('<html><head></head></html>', []), /no SEO block/);
  assert.throws(() => productHtml('<!-- SEO: generated --><!-- /SEO -->', { id: 'x', name: 'X', price: 1 }, 'ARS'), /no longer has/);
});

test('headTags leaves out the canonical URL when a page has none, and adds robots when asked', () => {
  const tags = headTags({ title: 'T', description: 'D', url: null, image: 'i', imageAlt: 'a', type: 'website', robots: 'noindex' }).join('\n');
  assert.ok(!tags.includes('canonical'));
  assert.ok(!tags.includes('og:url'));
  assert.match(tags, /<meta name="robots" content="noindex">/);
  assert.ok(!tags.includes('ld+json'));
});

test('the sitemap lists the collection and every product page', () => {
  const xml = sitemapXml([{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]), [`${SITE_URL}/`, `${SITE_URL}/a.html`, `${SITE_URL}/b.html`]);
});
