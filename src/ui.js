// DOM building blocks for the viewer. Text always goes through textContent (no innerHTML).

import { STRINGS } from './strings.js';

const DEFAULT_PICKER_COLOR = '#888888';
const REVOKE_URL_DELAY_MS = 1000;

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  });
  node.append(...children);
  return node;
}

/** Color buttons + free color picker. Built once; use syncSwatches to reflect the state. */
export function createSwatches(container, colors, onPick) {
  const buttons = colors.map((color) => {
    const button = el('button', {
      type: 'button',
      className: 'swatch',
      title: color.name,
      'aria-label': color.name,
      'aria-pressed': 'false',
      dataset: { color: color.id },
      onclick: () => onPick(color.id),
    });
    button.style.setProperty('--swatch', color.hex);
    return button;
  });
  const picker = el('input', { type: 'color', value: DEFAULT_PICKER_COLOR, oninput: (event) => onPick(event.target.value) });
  const custom = el('label', { className: 'custom-color', title: STRINGS.customColor }, [
    picker,
    el('span', { textContent: STRINGS.customColor }),
  ]);
  container.replaceChildren(...buttons, custom);
}

export function syncSwatches(container, selected) {
  container.querySelectorAll('.swatch').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.color === selected));
  });
  const isCustom = selected.startsWith('#');
  const custom = container.querySelector('.custom-color');
  custom.dataset.active = String(isCustom);
  if (isCustom) custom.querySelector('input').value = selected;
}

export function createFilters(container, filters, onPick) {
  container.replaceChildren(...filters.map((filter) => el('button', {
    type: 'button',
    className: 'filter',
    textContent: filter.label,
    'aria-pressed': 'false',
    dataset: { filter: filter.id },
    onclick: () => onPick(filter.id),
  })));
}

export function syncFilters(container, selected) {
  container.querySelectorAll('.filter').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === selected));
  });
}

/** One card per product. Returns Map<productId, { card, canvas, badges }>. */
export function createCards(container, products, onOpen) {
  const cards = new Map(products.map((product) => {
    const canvas = el('canvas');
    const badges = el('span', { className: 'badges' });
    const card = el('button', { type: 'button', className: 'card', onclick: () => onOpen(product.id) }, [
      el('span', { className: 'stage' }, [canvas]),
      el('span', { className: 'card-name', textContent: product.name }),
      badges,
    ]);
    return [product.id, { card, canvas, badges }];
  }));
  const nodes = [...cards.values()].map(({ card }) => card);
  container.replaceChildren(...(nodes.length ? nodes : [el('p', { className: 'status', textContent: STRINGS.empty })]));
  return cards;
}

/** badges: [{ text, level: 'warning' | 'error' }] */
export function setBadges(container, badges) {
  container.replaceChildren(...badges.map(({ text, level }) => el('span', {
    className: level === 'error' ? 'badge badge-error' : 'badge',
    textContent: text,
  })));
}

/** problems: [{ level, message }] from the catalog or from loading assets. */
export function showProblems(container, problems) {
  if (problems.length === 0) {
    container.replaceChildren();
    return;
  }
  container.replaceChildren(
    el('h2', { textContent: STRINGS.problemsTitle }),
    el('ul', {}, problems.map((p) => el('li', { className: `problem-${p.level}`, textContent: p.message }))),
  );
}

/** Saves the canvas as a PNG file. Rejects if the canvas cannot be exported (e.g. tainted by a cross-origin image). */
export function downloadCanvas(canvas, fileName) {
  return new Promise((resolve, reject) => {
    // toBlob throws synchronously on a tainted canvas: the Promise turns that into a rejection
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('el canvas está vacío'));
        return;
      }
      const url = URL.createObjectURL(blob);
      el('a', { href: url, download: fileName }).click();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_DELAY_MS);
      resolve();
    }, 'image/png');
  });
}
