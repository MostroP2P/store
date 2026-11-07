// The product image, larger: a dialog that draws the shirt at a higher scale than the product page and zooms
// in where the buyer taps, so the print can be looked at closely. Built once per page, like the size guide.

import { el } from '../dom.js';
import { icon } from './icons.js';
import { T } from './lang.js';
import { ZOOM_FACTOR, pointOn, scrollToKeep } from './zoom.js';

const CENTRE = Object.freeze({ x: 0.5, y: 0.5 });

/** Shows the image larger, with `fraction` of it under `anchor` (a point of the stage; null: its centre). */
function zoomIn({ dialog, stage, canvas, toggle }, fraction, anchor) {
  canvas.style.width = `${canvas.getBoundingClientRect().width * ZOOM_FACTOR}px`;
  dialog.classList.add('is-zoomed');
  toggle.setAttribute('aria-pressed', 'true');
  toggle.replaceChildren(icon('zoomOut'));
  // Measured after the change: the stage now scrolls, and its scrollbars take some of its room
  const frame = stage.getBoundingClientRect();
  const box = canvas.getBoundingClientRect();
  const image = { left: box.left - frame.left + stage.scrollLeft, top: box.top - frame.top + stage.scrollTop, width: box.width, height: box.height };
  const { left, top } = scrollToKeep(fraction, image, anchor ?? { x: stage.clientWidth / 2, y: stage.clientHeight / 2 });
  stage.scrollTo(left, top);
}

function zoomOut({ dialog, canvas, toggle }) {
  canvas.style.removeProperty('width');
  dialog.classList.remove('is-zoomed');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.replaceChildren(icon('zoomIn'));
}

function build() {
  const canvas = el('canvas', { className: 'image-viewer-canvas', role: 'img' });
  const spinner = el('span', { className: 'spinner image-viewer-spinner', 'aria-hidden': 'true' });
  // Focusable, so a keyboard can scroll the zoomed image (Safari does not focus a scroller by itself)
  const stage = el('div', { className: 'image-viewer-stage', tabIndex: 0, role: 'group', 'aria-labelledby': 'image-viewer-title' }, [canvas, spinner]);
  const toggle = el('button', { type: 'button', className: 'icon-button', id: 'image-viewer-zoom', 'aria-label': T.zoomImage, 'aria-pressed': 'false' }, [icon('zoomIn')]);
  const close = el('button', { type: 'button', className: 'icon-button', 'aria-label': T.close }, [icon('close')]);
  const title = el('h2', { id: 'image-viewer-title' });
  const dialog = el('dialog', { className: 'modal image-viewer', 'aria-labelledby': 'image-viewer-title' }, [
    el('div', { className: 'modal-head' }, [title, el('div', { className: 'modal-tools' }, [toggle, close])]),
    stage,
    el('p', { className: 'image-viewer-hint', textContent: T.zoomHint }),
  ]);
  return { dialog, stage, canvas, toggle, close, title };
}

/**
 * Draws once the open dialog has painted, with a spinner meanwhile: the tap is answered at once, and the
 * large drawing, which takes a moment on a phone, comes after. A drawing that throws still drops the spinner.
 */
function drawAfterPaint({ dialog, stage }, draw) {
  dialog.classList.add('is-drawing');
  stage.setAttribute('aria-busy', 'true');
  requestAnimationFrame(() => setTimeout(() => {
    try {
      draw();
    } finally {
      dialog.classList.remove('is-drawing');
      stage.removeAttribute('aria-busy');
    }
  }));
}

/**
 * Closes on its button, and on a press that starts and ends on the backdrop. A drag that starts in the
 * dialog (a scrollbar, the hint) and ends outside also clicks the dialog, and must not throw the zoom away.
 */
function bindClose(dialog, close) {
  close.addEventListener('click', () => dialog.close());
  let pressedOnBackdrop = false;
  dialog.addEventListener('pointerdown', (event) => { pressedOnBackdrop = event.target === dialog; });
  dialog.addEventListener('click', (event) => {
    if (pressedOnBackdrop && event.target === dialog) dialog.close();
  });
}

/**
 * Builds the viewer (appended to body) and returns { open }. `open({ key, label, draw })` shows it titled
 * `label`; `draw(canvas)` runs only when `key` differs from the last one drawn, since a large drawing is slow.
 */
export function createImageViewer() {
  const parts = build();
  const { dialog, stage, canvas, toggle, close, title } = parts;
  const isZoomed = () => dialog.classList.contains('is-zoomed');
  canvas.addEventListener('click', (event) => {
    if (isZoomed()) {
      zoomOut(parts);
      return;
    }
    const frame = stage.getBoundingClientRect();
    const fraction = pointOn({ x: event.clientX, y: event.clientY }, canvas.getBoundingClientRect());
    zoomIn(parts, fraction, { x: event.clientX - frame.left, y: event.clientY - frame.top });
  });
  toggle.addEventListener('click', () => {
    // Nothing to zoom on until the drawing is there
    if (dialog.classList.contains('is-drawing')) return;
    if (isZoomed()) zoomOut(parts);
    else zoomIn(parts, CENTRE, null);
  });
  bindClose(dialog, close);
  // Every opening starts with the whole shirt in view
  dialog.addEventListener('close', () => zoomOut(parts));
  // The zoomed width is in pixels of the old stage: a turned phone or a resized window starts over, fitted
  window.addEventListener('resize', () => {
    if (isZoomed()) zoomOut(parts);
  });
  document.body.append(dialog);

  let drawnKey = null;
  return {
    open({ key, label, draw }) {
      title.textContent = label;
      canvas.setAttribute('aria-label', label);
      dialog.showModal();
      if (key === drawnKey) return;
      drawAfterPaint(parts, () => {
        draw(canvas);
        drawnKey = key;
      });
    },
  };
}
