// Text fitting (pure). Text width comes from an injected `measure(str)` function,
// so this module works with canvas in the browser and with fakes in tests.

const DEFAULT_STEP = 2;
const BALANCE_ITERATIONS = 16;

function wrapParagraph(paragraph, maxWidth, measure) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  return words.reduce((lines, word) => {
    const last = lines.at(-1);
    if (last === undefined) return [word];
    const candidate = `${last} ${word}`;
    return measure(candidate) <= maxWidth ? [...lines.slice(0, -1), candidate] : [...lines, word];
  }, []);
}

/** Greedy word wrap. "\n" forces a line break; a word wider than the line keeps its own line. */
export function wrapText(text, maxWidth, measure) {
  return String(text)
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, maxWidth, measure));
}

/** Same number of lines as wrapText, but with line lengths as even as possible. */
export function balanceLines(text, maxWidth, measure) {
  const lines = wrapText(text, maxWidth, measure);
  if (lines.length < 2) return lines;

  let narrow = 0;
  let wide = maxWidth;
  for (let i = 0; i < BALANCE_ITERATIONS; i++) {
    const width = (narrow + wide) / 2;
    if (wrapText(text, width, measure).length <= lines.length) wide = width;
    else narrow = width;
  }
  return wrapText(text, wide, measure);
}

function fontSizes(maxFontSize, minFontSize, step) {
  const sizes = [];
  for (let size = maxFontSize; size > minFontSize; size -= step) sizes.push(size);
  return [...sizes, minFontSize];
}

function attempt(text, fontSize, { maxWidth, maxHeight, maxLines, lineHeight, measureAt }) {
  const measure = measureAt(fontSize);
  const lines = balanceLines(text, maxWidth, measure);
  const lineHeightPx = fontSize * lineHeight;
  const height = lines.length * lineHeightPx;
  const widest = Math.max(...lines.map(measure));
  const fits = lines.length <= maxLines && widest <= maxWidth && height <= maxHeight;
  return { fontSize, lines, lineHeightPx, height, fits };
}

/**
 * Finds the largest font size (stepping down from maxFontSize) at which the text
 * fits in maxLines lines, maxWidth and maxHeight. If nothing fits, returns the
 * minimum size with overflow: true.
 */
export function fitText({ text, maxFontSize, minFontSize, step = DEFAULT_STEP, ...limits }) {
  if (!String(text).trim()) {
    return { fontSize: 0, lines: [], lineHeightPx: 0, height: 0, overflow: false };
  }
  const sizes = fontSizes(maxFontSize, minFontSize, step);
  for (const size of sizes) {
    const { fits, ...result } = attempt(text, size, limits);
    if (fits) return { ...result, overflow: false };
  }
  const { fits, ...smallest } = attempt(text, minFontSize, limits);
  return { ...smallest, overflow: true };
}
