// "Size guide" dialog: tips, a measuring diagram and the size table from catalog.json (store.sizes).

import { el, svgEl } from '../dom.js';
import { icon } from './icons.js';
import { T } from './lang.js';

// T-shirt outline (viewBox 0 0 200 200) with the two measures marked
const SHIRT_PATH = 'M72 22 40 32 10 72l26 16 14-20v114h100V68l14 20 26-16-30-40-32-10q-28 22-56 0z';

function diagram() {
  const arrow = (x1, y1, x2, y2) => svgEl('line', { x1, y1, x2, y2, class: 'diagram-measure' });
  return svgEl('svg', { class: 'size-diagram', viewBox: '0 0 200 200', role: 'img', 'aria-label': `${T.sizeWidth}, ${T.sizeLength}` }, [
    svgEl('path', { d: SHIRT_PATH, class: 'diagram-shirt' }),
    arrow(52, 96, 148, 96),
    arrow(128, 30, 128, 180),
    svgEl('text', { x: 90, y: 90, class: 'diagram-label', 'text-anchor': 'middle' }, [T.diagramWidth]),
    svgEl('text', { x: 124, y: 150, class: 'diagram-label', 'text-anchor': 'end' }, [T.diagramLength]),
  ]);
}

const measure = (value) => (value === null ? T.noMeasure : T.centimeters(value));

function sizeTable(sizes) {
  const header = el('tr', {}, [T.size, T.sizeWidth, T.sizeLength]
    .map((text) => el('th', { scope: 'col', textContent: text })));
  const rows = sizes.map((size) => el('tr', {}, [
    el('th', { scope: 'row', textContent: size.id }),
    el('td', { textContent: measure(size.width) }),
    el('td', { textContent: measure(size.length) }),
  ]));
  return el('table', { className: 'size-table' }, [el('thead', {}, [header]), el('tbody', {}, rows)]);
}

const tipList = (title, items) => [
  el('h3', { textContent: title }),
  el('ul', { className: 'tip-list' }, items.map((text) => el('li', { textContent: text }))),
];

/** Builds the dialog (appended to body) and returns { open }. */
export function createSizeGuide(sizes) {
  const close = el('button', { type: 'button', className: 'icon-button', 'aria-label': T.close }, [icon('close')]);
  const dialog = el('dialog', { className: 'modal size-guide', 'aria-labelledby': 'size-guide-title' }, [
    el('div', { className: 'modal-head' }, [el('h2', { id: 'size-guide-title', textContent: T.sizeGuide }), close]),
    el('div', { className: 'modal-body' }, [
      ...tipList(T.sizeTipsTitle, T.sizeTips),
      ...tipList(T.sizeNotesTitle, T.sizeNotes),
      diagram(),
      el('h3', { textContent: T.sizeTableTitle }),
      sizeTable(sizes),
    ]),
  ]);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  return { open: () => dialog.showModal() };
}
