// Layouts (pure): where the image and the text go inside the print area.
// All coordinates are in pixels of the base shirt image.

import { fitText } from './text.js';

/** The image never takes more than this share of the print area height. */
export const MAX_IMAGE_SHARE = 0.75;

/** Scales `size` to fit inside `area`, centered horizontally, aligned top (or center). */
export function containRect(size, area, { align = 'top' } = {}) {
  const scale = Math.min(area.width / size.width, area.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    x: area.x + (area.width - width) / 2,
    y: align === 'center' ? area.y + (area.height - height) / 2 : area.y,
    width,
    height,
  };
}

function scaledImageSize(imageSize, area, imageWidth) {
  const width = area.width * imageWidth;
  const height = (width * imageSize.height) / imageSize.width;
  const maxHeight = area.height * MAX_IMAGE_SHARE;
  if (height <= maxHeight) return { width, height };
  return { width: (maxHeight * imageSize.width) / imageSize.height, height: maxHeight };
}

/**
 * Image + message layout used by series. Returns the image rect and the fitted
 * text block ({ x: center, y: top, fontSize, lines, lineHeightPx, height, overflow }),
 * or text: null when there is no message.
 */
export function layoutImageText({ area, imageSize, text, style, measureAt }) {
  const { width, height } = scaledImageSize(imageSize, area, style.imageWidth);
  const imageX = area.x + (area.width - width) / 2;

  if (!text || !text.trim()) {
    return { image: { x: imageX, y: area.y, width, height }, text: null };
  }

  const fitted = fitText({
    text,
    maxWidth: area.width,
    maxHeight: area.height - height - style.gap,
    maxLines: style.maxLines,
    maxFontSize: style.maxFontSize,
    minFontSize: style.minFontSize,
    lineHeight: style.lineHeight,
    measureAt,
  });

  const textFirst = style.textPosition === 'above';
  const imageY = textFirst ? area.y + fitted.height + style.gap : area.y;
  const textY = textFirst ? area.y : area.y + height + style.gap;

  return {
    image: { x: imageX, y: imageY, width, height },
    text: { ...fitted, x: area.x + area.width / 2, y: textY },
  };
}
