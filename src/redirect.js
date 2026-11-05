// Old URLs (pure): where an old page (producto.html, visor.html) sends the visitor, keeping the query
// and the hash so shared links still open the same shirt, color, size or viewer state.

// The target comes from the page itself; still, only a plain page name of this site is accepted
const PAGE_NAME = /^[a-z][a-z0-9-]*\.html$/;
const RENAME_PAIR = /^([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/;

/** 'talle:size' → { talle: 'size' }; malformed pairs are ignored. */
export function parseRenames(text) {
  if (typeof text !== 'string') return {};
  return Object.fromEntries(text.split(/\s+/)
    .map((pair) => RENAME_PAIR.exec(pair))
    .filter(Boolean)
    .map(([, from, to]) => [from, to]));
}

/**
 * New address for an old page: `target` plus the query (with `renames` applied: { old: new }) and the hash.
 * A parameter already under its new name wins over the old one.
 */
export function legacyTarget(target, search, hash, renames) {
  if (!PAGE_NAME.test(target ?? '')) throw new Error(`invalid redirect target "${target}"`);
  const params = new URLSearchParams(search);
  const toRename = Object.entries(renames).filter(([from]) => params.has(from));
  if (toRename.length === 0) return `${target}${search}${hash}`;
  const renamed = new URLSearchParams([...params].flatMap(([key, value]) => {
    const to = renames[key];
    if (!to) return [[key, value]];
    return params.has(to) ? [] : [[to, value]];
  }));
  // At least one parameter was renamed, so the query is never empty
  return `${target}?${renamed}${hash}`;
}
