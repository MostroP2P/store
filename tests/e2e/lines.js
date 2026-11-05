// V8 block coverage → line coverage (pure). Chromium reports, for every script, its functions with
// character ranges and how many times each ran; ranges nest, and an inner range overrides the outer one.

/** 1-based numbers of the lines that hold code: not blank, not only a comment. */
export function codeLines(source) {
  const lines = source.split('\n');
  let inComment = false;
  return lines.flatMap((text, index) => {
    const trimmed = text.trim();
    if (inComment) {
      if (trimmed.includes('*/')) inComment = false;
      return [];
    }
    if (trimmed === '' || trimmed.startsWith('//')) return [];
    if (trimmed.startsWith('/*')) {
      inComment = !trimmed.includes('*/');
      return [];
    }
    return [index + 1];
  });
}

/** How many times each character ran: ranges applied outer first, so an inner one wins. */
function characterCounts(length, functions) {
  const counts = new Int32Array(length);
  functions
    .flatMap((fn) => fn.ranges)
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset)
    .forEach(({ startOffset, endOffset, count }) => counts.fill(count, startOffset, Math.min(endOffset, length)));
  return counts;
}

/** { lines, covered }: the code lines of `source`, and those where some non-blank character ran. */
export function lineCoverage(source, functions) {
  const counts = characterCounts(source.length, functions);
  const starts = [0, ...[...source.matchAll(/\n/g)].map((match) => match.index + 1)];
  const ran = (line) => {
    const end = line < starts.length ? starts[line] - 1 : source.length;
    for (let i = starts[line - 1]; i < end; i += 1) {
      if (counts[i] > 0 && source[i].trim() !== '') return true;
    }
    return false;
  };
  const lines = codeLines(source);
  return { lines, covered: lines.filter(ran) };
}

/** Covered line numbers of every file, from several coverage entries ({ path, source, functions }) merged. */
export function mergeEntries(entries) {
  return entries.reduce((files, { path, source, functions }) => {
    const { lines, covered } = lineCoverage(source, functions);
    const before = files.get(path)?.covered ?? new Set();
    return new Map([...files, [path, { lines, covered: new Set([...before, ...covered]) }]]);
  }, new Map());
}
