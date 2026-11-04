// Small line icons (24×24, stroke = currentColor) built as SVG nodes. Decorative: hidden from screen readers.

import { svgEl } from '../dom.js';

const SHAPES = Object.freeze({
  cart: [['path', 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2'], ['circle', 10, 20, 1.4], ['circle', 17, 20, 1.4]],
  trash: [['path', 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3']],
  ruler: [['path', 'M3 17 17 3l4 4L7 21zM7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2']],
  bolt: [['path', 'M13 2 4 14h7l-1 8 9-12h-7z']],
  truck: [['path', 'M3 6h11v10H3zM14 10h4l3 3v3h-7'], ['circle', 7, 18, 2], ['circle', 17, 18, 2]],
  user: [['circle', 12, 8, 4], ['path', 'M4 21a8 8 0 0 1 16 0']],
  chat: [['path', 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z']],
  copy: [['rect', 9, 9, 11, 11, 2], ['path', 'M5 15V5a2 2 0 0 1 2-2h8']],
  wallet: [['path', 'M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3zM3 7V5a2 2 0 0 1 2-2h11'], ['circle', 16.5, 13.5, 1]],
  check: [['path', 'M5 12l5 5 9-10']],
  arrowLeft: [['path', 'M19 12H5M11 6l-6 6 6 6']],
  close: [['path', 'M6 6l12 12M18 6 6 18']],
  minus: [['path', 'M5 12h14']],
  plus: [['path', 'M12 5v14M5 12h14']],
  info: [['circle', 12, 12, 9], ['path', 'M12 11v5M12 8h.01']],
  card: [['rect', 3, 5, 18, 14, 2], ['path', 'M3 10h18']],
});

const SHAPE_ATTRIBUTES = {
  path: ([d]) => ({ d }),
  circle: ([cx, cy, r]) => ({ cx, cy, r }),
  rect: ([x, y, width, height, rx]) => ({ x, y, width, height, rx }),
};

/** icon('cart') → <svg class="icon">…</svg> */
export function icon(name, className = 'icon') {
  const shapes = SHAPES[name] ?? [];
  return svgEl('svg', {
    class: className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  }, shapes.map(([tag, ...values]) => svgEl(tag, SHAPE_ATTRIBUTES[tag](values))));
}
