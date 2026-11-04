// Base shirt (browser/canvas): loads it, builds its shading maps once and paints it any color.

import { buildShadingMaps } from './shading.js';

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Lets a future store serve images from a CDN (with CORS) without tainting the canvas
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });
}

function canvasFromPixels(pixels, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

/** Reads the base image pixels and builds its shade/highlight maps (run once per base). */
export function prepareShirt(image, shading) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const context = source.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  const maps = buildShadingMaps(data, width, height, shading);
  return {
    width,
    height,
    image,
    shade: canvasFromPixels(maps.shade, width, height),
    highlight: canvasFromPixels(maps.highlight, width, height),
  };
}

/** Paints the shirt in `hex`, in base-image coordinates (the caller sets the scale transform). */
export function paintShirt(context, shirt, hex) {
  context.save();
  context.fillStyle = hex;
  context.fillRect(0, 0, shirt.width, shirt.height);
  context.globalCompositeOperation = 'multiply';
  context.drawImage(shirt.shade, 0, 0);
  context.globalCompositeOperation = 'screen';
  context.drawImage(shirt.highlight, 0, 0);
  // Keep only the shirt silhouette (alpha of the base image)
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(shirt.image, 0, 0);
  context.restore();
}
