// Store home (index.html): the collection, one section per series.

import { el } from '../dom.js';
import { startPage } from './boot.js';
import { mountCart } from './cart-ui.js';
import { productCard } from './product-card.js';
import { groupSections } from './products.js';
import { STRINGS } from './strings.js';

function renderCollection(store) {
  const container = document.getElementById('collection');
  const sections = groupSections(store.products, store.catalog.groups, STRINGS.designs);
  if (sections.length === 0) {
    container.replaceChildren(el('p', { className: 'muted', textContent: STRINGS.noProducts }));
    return;
  }
  container.replaceChildren(...sections.map((section) => el('section', {
    className: 'collection-section', 'aria-labelledby': `section-${section.id}`,
  }, [
    el('h2', { className: 'section-title', id: `section-${section.id}`, textContent: section.name }),
    el('div', { className: 'product-grid' }, section.products.map((product) => productCard(store, product))),
  ])));
}

startPage((store) => {
  mountCart(store);
  renderCollection(store);
});
