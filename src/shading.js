// Shading maps (pure). From the pixels of the base shirt (RGBA) it builds:
//  - shade:     light gray, darker in folds  → drawn with "multiply"
//  - highlight: black, lighter where it shines → drawn with "screen"
// so the shirt can be painted any color while keeping the fabric folds.

const ALPHA_THRESHOLD = 200;
const FALLBACK_LEVELS = Object.freeze({ lo: 0, med: 128, hi: 255 });

/** Rec. 601 luma, 0–255. */
export const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

function percentile(histogram, total, fraction) {
  const target = total * fraction;
  let cumulative = 0;
  // Always found: the running count ends at `total`, and target ≤ total
  return histogram.findIndex((count) => {
    cumulative += count;
    return cumulative >= target;
  });
}

/** p1 / p50 / p99 of the luminance of the opaque pixels. */
export function computeLevels(rgba, alphaThreshold = ALPHA_THRESHOLD) {
  const histogram = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < alphaThreshold) continue;
    histogram[Math.round(luminance(rgba[i], rgba[i + 1], rgba[i + 2]))] += 1;
    total += 1;
  }
  if (total === 0) return { ...FALLBACK_LEVELS };

  const lo = percentile(histogram, total, 0.01);
  const med = percentile(histogram, total, 0.5);
  const hi = percentile(histogram, total, 0.99);
  return { lo, med, hi: Math.max(hi, lo + 1) };
}

function blurPass(source, { lines, length, lineStride, step }, radius) {
  const output = new Float32Array(source.length);
  const size = radius * 2 + 1;
  const last = length - 1;
  for (let line = 0; line < lines; line++) {
    const start = line * lineStride;
    const at = (i) => source[start + Math.min(last, Math.max(0, i)) * step];
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += at(k);
    for (let i = 0; i < length; i++) {
      output[start + i * step] = sum / size;
      sum += at(i + radius + 1) - at(i - radius);
    }
  }
  return output;
}

/** Separable box blur (one horizontal and one vertical pass, edges clamped). Returns a new array. */
export function boxBlur(values, width, height, radius) {
  const r = Math.round(radius);
  if (r <= 0) return Float32Array.from(values);
  const horizontal = blurPass(values, { lines: height, length: width, lineStride: width, step: 1 }, r);
  return blurPass(horizontal, { lines: width, length: height, lineStride: 1, step: width }, r);
}

const normalize = (value, from, to) => (to > from ? Math.min(1, Math.max(0, (value - from) / (to - from))) : 0);

function grayPixels(values) {
  const rgba = new Uint8ClampedArray(values.length * 4);
  values.forEach((value, p) => {
    rgba.set([value, value, value, 255], p * 4);
  });
  return rgba;
}

/** Builds the shade and highlight maps (RGBA, same size as the input). */
export function buildShadingMaps(rgba, width, height, { blur, shadowFloor, highlight }) {
  const levels = computeLevels(rgba);
  const tones = new Float32Array(width * height);
  for (let p = 0; p < tones.length; p++) {
    const i = p * 4;
    // Transparent pixels take the median tone so blurring does not darken the shirt edges
    tones[p] = rgba[i + 3] < ALPHA_THRESHOLD ? levels.med : luminance(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  const smooth = boxBlur(tones, width, height, blur);

  const shadeValues = smooth.map((t) => Math.round(255 * (shadowFloor + (1 - shadowFloor) * normalize(t, levels.lo, levels.hi))));
  const highlightValues = smooth.map((t) => Math.round(255 * highlight * normalize(t, levels.med, levels.hi)));
  return { shade: grayPixels(shadeValues), highlight: grayPixels(highlightValues) };
}
