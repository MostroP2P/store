// The product image viewer's numbers: how large it draws the shirt, how far it zooms, where a tap falls on
// the image and where to scroll so that point stays under the finger once the image is larger. The DOM
// module (image-viewer.js) measures; this decides.

/**
 * The viewer draws the shirt at twice the product page's scale (1). A series' text stays sharp when zoomed
 * in, and a design file up to twice the print area shows its detail. The shirt itself is the base photo,
 * upscaled: it has no more detail to give.
 */
export const VIEWER_SCALE = 2;
/** How much larger than its fitted size the image is shown when zoomed in. */
export const ZOOM_FACTOR = 2.5;

const CENTRE = 0.5;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const along = (offset, size) => (size > 0 ? clamp01(offset / size) : CENTRE);

/** Where `point` falls on `rect` ({ left, top, width, height }), as fractions of its width and height. */
export function pointOn(point, rect) {
  return { x: along(point.x - rect.left, rect.width), y: along(point.y - rect.top, rect.height) };
}

/**
 * The scroll offsets that put `fraction` of `image` (its box in the scrolled content) under `anchor` (a point
 * of the visible area). Never before the start; the browser stops the scroll at the far end by itself.
 */
export function scrollToKeep(fraction, image, anchor) {
  return {
    left: Math.max(0, image.left + fraction.x * image.width - anchor.x),
    top: Math.max(0, image.top + fraction.y * image.height - anchor.y),
  };
}
