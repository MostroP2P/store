// Product render (browser/canvas): shirt color + design + message on one canvas.
// Reusable by the store: it only needs a prepared shirt, a product and its image.

import { paintShirt } from './shirt.js';
import { containRect, layoutImageText } from './layouts.js';
import { autoTextColor } from './color.js';

export const WARNING_TEXT_TOO_LONG = 'textTooLong';

const DEBUG_STROKE = '#ff3b30';
const DEBUG_LINE_WIDTH = 3;
const DEBUG_DASH = [12, 8];

const fontString = (size, family) => `${size}px "${family}", sans-serif`;

// Created on first use so that importing this module never touches the DOM
let measureContext = null;
const getMeasureContext = () => {
  measureContext ??= document.createElement('canvas').getContext('2d');
  return measureContext;
};

const measureAtFor = (family) => (size) => {
  const font = fontString(size, family);
  return (str) => {
    const context = getMeasureContext();
    context.font = font;
    return context.measureText(str).width;
  };
};

function drawLines(context, block, { family, color }) {
  context.save();
  context.font = fontString(block.fontSize, family);
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  block.lines.forEach((line, i) => {
    context.fillText(line, block.x, block.y + (i + 0.5) * block.lineHeightPx);
  });
  context.restore();
}

function drawDesign(context, { product, image, hex, printArea }) {
  const imageSize = { width: image.naturalWidth, height: image.naturalHeight };
  if (product.layout === 'image') {
    const rect = containRect(imageSize, printArea);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    return [];
  }

  const { style } = product;
  const text = product.text && style.uppercase ? product.text.toUpperCase() : product.text;
  const layout = layoutImageText({ area: printArea, imageSize, text, style, measureAt: measureAtFor(style.fontFamily) });
  context.drawImage(image, layout.image.x, layout.image.y, layout.image.width, layout.image.height);
  if (!layout.text) return [];

  const color = style.textColor === 'auto' ? autoTextColor(hex) : style.textColor;
  drawLines(context, layout.text, { family: style.fontFamily, color });
  return layout.text.overflow ? [WARNING_TEXT_TOO_LONG] : [];
}

function drawPrintArea(context, area) {
  context.save();
  context.strokeStyle = DEBUG_STROKE;
  context.lineWidth = DEBUG_LINE_WIDTH;
  context.setLineDash(DEBUG_DASH);
  context.strokeRect(area.x, area.y, area.width, area.height);
  context.restore();
}

/**
 * Draws a product on `canvas` at `scale` (1 = base image size).
 * `image` may be null (missing file): then only the shirt is drawn.
 * Returns { warnings } with codes such as WARNING_TEXT_TOO_LONG.
 */
export function renderProduct(canvas, { shirt, product, image, hex, printArea, scale = 1, debug = false }) {
  canvas.width = Math.round(shirt.width * scale);
  canvas.height = Math.round(shirt.height * scale);
  const context = canvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.imageSmoothingQuality = 'high';

  paintShirt(context, shirt, hex);
  const warnings = image ? drawDesign(context, { product, image, hex, printArea }) : [];
  if (debug) drawPrintArea(context, printArea);
  return { warnings };
}
