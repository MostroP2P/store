// Catalog (pure): validates and normalizes catalog.json into a flat list of products.
// The future store reads the same catalog, so unknown fields (price, sizes, status…) are ignored, never rejected.

import { isHexColor } from './color.js';

export const DESIGNS_GROUP_ID = 'designs';
export const ALL_GROUP_ID = 'all';
const RESERVED_GROUP_IDS = [ALL_GROUP_ID, DESIGNS_GROUP_ID];

export const DEFAULT_SHADING = Object.freeze({ blur: 7, shadowFloor: 0.66, highlight: 0.16 });

export const DEFAULT_SERIES_STYLE = Object.freeze({
  font: 'sans-serif',
  textColor: 'auto',
  uppercase: true,
  imageWidth: 0.6,
  textPosition: 'below',
  gap: 24,
  maxLines: 2,
  maxFontSize: 96,
  minFontSize: 28,
  lineHeight: 1.05,
});

const STYLE_NUMBER_RULES = Object.freeze({
  imageWidth: { min: 0.05, max: 1 },
  gap: { min: 0, max: 1000 },
  maxLines: { min: 1, max: 10, integer: true },
  maxFontSize: { min: 1, max: 500 },
  minFontSize: { min: 1, max: 500 },
  lineHeight: { min: 0.5, max: 3 },
});

const SHADING_NUMBER_RULES = Object.freeze({
  blur: { min: 0, max: 50 },
  shadowFloor: { min: 0, max: 1 },
  highlight: { min: 0, max: 1 },
});

const TEXT_POSITIONS = ['below', 'above'];
const FONT_FILE = /([^/\\]+)\.(ttf|otf|woff2?)$/i;

// Store fields: only "published" products are on sale; a draft is only seen in the viewer
export const PRODUCT_STATUSES = Object.freeze(['draft', 'published']);
const DEFAULT_STATUS = 'draft';
const NO_STORE_FIELDS = Object.freeze({ status: DEFAULT_STATUS, price: null, description: null });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const error = (message) => ({ level: 'error', message });
const warning = (message) => ({ level: 'warning', message });
const fail = (message) => ({ catalog: null, problems: [error(message)] });
const baseName = (path) => path.split('/').pop().replace(/\.[^.]+$/, '');

const isValidNumber = (value, { min, max, integer = false }) =>
  isFiniteNumber(value) && value >= min && value <= max && (!integer || Number.isInteger(value));

/** Drops the keys whose numeric value breaks its rule, with one warning per dropped key. */
function checkNumbers(values, rules, owner) {
  const invalid = Object.keys(rules).filter((key) => values[key] !== undefined && !isValidNumber(values[key], rules[key]));
  return {
    values: Object.fromEntries(Object.entries(values).filter(([key]) => !invalid.includes(key))),
    problems: invalid.map((key) => warning(
      `${owner}: "${key}" inválido "${values[key]}" (número entre ${rules[key].min} y ${rules[key].max}); se usa el valor por defecto.`,
    )),
  };
}

/** "Mañana ¡Bitcoin!" → "manana-bitcoin" */
export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Font family for a font file path ("assets/fonts/X-Regular.ttf" → "X-Regular"), or null for system fonts. */
export function fontFamilyFromFile(font) {
  const match = FONT_FILE.exec(font ?? '');
  return match ? match[1] : null;
}

function normalizeBase(base) {
  if (!isObject(base) || !isText(base.image)) {
    return { error: 'Falta "base.image": la imagen de la remera base.' };
  }
  const area = base.printArea;
  const validArea = isObject(area)
    && isFiniteNumber(area.x) && isFiniteNumber(area.y)
    && isFiniteNumber(area.width) && area.width > 0
    && isFiniteNumber(area.height) && area.height > 0;
  if (!validArea) {
    return { error: '"base.printArea" debe tener x, y, width y height numéricos (width y height > 0).' };
  }
  const shading = checkNumbers(isObject(base.shading) ? base.shading : {}, SHADING_NUMBER_RULES, '"base.shading"');
  return {
    base: {
      image: base.image,
      printArea: { x: area.x, y: area.y, width: area.width, height: area.height },
      shading: { ...DEFAULT_SHADING, ...shading.values },
    },
    problems: shading.problems,
  };
}

function normalizeColors(colors) {
  if (!Array.isArray(colors)) return { colors: [], problems: [error('"colors" debe ser una lista.')] };
  return colors.reduce(({ colors: valid, problems }, color, index) => {
    if (!isObject(color) || !isText(color.id)) {
      return { colors: valid, problems: [...problems, error(`Color #${index + 1}: falta "id".`)] };
    }
    if (!isHexColor(color.hex)) {
      return { colors: valid, problems: [...problems, error(`Color "${color.id}": hex inválido "${color.hex}" (usá #rrggbb).`)] };
    }
    if (valid.some((c) => c.id === color.id)) {
      return { colors: valid, problems: [...problems, error(`Color "${color.id}" repetido: se ignora el segundo.`)] };
    }
    const normalized = { id: color.id, name: isText(color.name) ? color.name : color.id, hex: color.hex.toLowerCase() };
    return { colors: [...valid, normalized], problems };
  }, { colors: [], problems: [] });
}

function normalizeRecommended(colors, colorIds, owner) {
  if (colors === undefined) return { colors: null, problems: [] };
  if (!Array.isArray(colors)) return { colors: null, problems: [warning(`${owner}: "colors" debe ser una lista de ids.`)] };
  const unknown = colors.filter((id) => !colorIds.includes(id));
  return {
    colors: colors.filter((id) => colorIds.includes(id)),
    problems: unknown.map((id) => warning(`${owner}: color recomendado desconocido "${id}".`)),
  };
}

function validateStyle(style, owner) {
  if (style === undefined) return { style: {}, problems: [] };
  if (!isObject(style)) return { style: {}, problems: [warning(`${owner}: "style" debe ser un objeto.`)] };
  const numbers = checkNumbers(style, STYLE_NUMBER_RULES, owner);
  const problems = [...numbers.problems];
  const badTextColor = style.textColor !== undefined && style.textColor !== 'auto' && !isHexColor(style.textColor);
  if (badTextColor) problems.push(warning(`${owner}: "textColor" inválido "${style.textColor}" (usá "auto" o #rrggbb).`));
  const badPosition = style.textPosition !== undefined && !TEXT_POSITIONS.includes(style.textPosition);
  if (badPosition) problems.push(warning(`${owner}: "textPosition" inválido "${style.textPosition}" (usá "below" o "above").`));
  const valid = Object.fromEntries(Object.entries(numbers.values).filter(([key]) =>
    !(key === 'textColor' && badTextColor) && !(key === 'textPosition' && badPosition)));

  const { minFontSize: min, maxFontSize: max } = valid;
  const inverted = min !== undefined && max !== undefined && min > max;
  if (inverted) problems.push(warning(`${owner}: "minFontSize" (${min}) es mayor que "maxFontSize" (${max}); se usa ${max}.`));
  return { style: inverted ? { ...valid, minFontSize: max } : valid, problems };
}

/**
 * status / price / description of a design, series or series item.
 * `inherited` holds the already valid values of the series (or NO_STORE_FIELDS).
 */
function storeFields(entry, inherited, owner) {
  const problems = [];
  const status = entry.status ?? inherited.status;
  const validStatus = PRODUCT_STATUSES.includes(status);
  if (!validStatus) problems.push(warning(`${owner}: "status" inválido "${status}" (usá "draft" o "published"); queda como borrador.`));
  const price = entry.price ?? inherited.price;
  const validPrice = price === null || (isFiniteNumber(price) && price > 0);
  if (!validPrice) problems.push(warning(`${owner}: "price" inválido "${price}" (número mayor a 0); se usa el precio de la tienda.`));
  const description = isText(entry.description) ? entry.description.trim() : inherited.description;
  return {
    fields: {
      status: validStatus ? status : DEFAULT_STATUS,
      price: validPrice ? price : null,
      description,
    },
    problems,
  };
}

function normalizeDesign(design, index, colorIds) {
  if (!isObject(design) || !isText(design.id)) return { problems: [error(`Diseño #${index + 1}: falta "id".`)] };
  if (!isText(design.image)) return { problems: [error(`Diseño "${design.id}": falta "image".`)] };
  const owner = `Diseño "${design.id}"`;
  const recommended = normalizeRecommended(design.colors, colorIds, owner);
  const store = storeFields(design, NO_STORE_FIELDS, owner);
  return {
    product: {
      id: design.id,
      name: isText(design.name) ? design.name : design.id,
      groupId: DESIGNS_GROUP_ID,
      layout: 'image',
      image: design.image,
      text: null,
      style: null,
      colors: recommended.colors,
      ...store.fields,
    },
    problems: [...recommended.problems, ...store.problems],
  };
}

function normalizeItem(item, index, series, seriesStyle, seriesStore, colorIds) {
  const owner = `Serie "${series.id}", ítem #${index + 1}`;
  if (!isObject(item) || !isText(item.image)) return { problems: [error(`${owner}: falta "image".`)] };

  const text = isText(item.text) ? item.text : null;
  const itemStyle = validateStyle(item.style, owner);
  const merged = { ...DEFAULT_SERIES_STYLE, ...seriesStyle, ...itemStyle.style };
  const recommended = normalizeRecommended(item.colors ?? series.colors, colorIds, owner);
  const store = storeFields(item, seriesStore, owner);
  const slug = slugify(text ?? baseName(item.image)) || String(index + 1);

  return {
    product: {
      id: isText(item.id) ? item.id : `${series.id}-${slug}`,
      name: isText(item.name) ? item.name : (text ? text.replace(/\s*\n\s*/g, ' ') : baseName(item.image)),
      groupId: series.id,
      layout: 'image-text',
      image: item.image,
      text,
      style: { ...merged, fontFamily: fontFamilyFromFile(merged.font) ?? merged.font },
      colors: recommended.colors,
      ...store.fields,
    },
    problems: [...itemStyle.problems, ...recommended.problems, ...store.problems],
  };
}

function normalizeOneSeries(series, index, colorIds) {
  if (!isObject(series) || !isText(series.id)) return { problems: [error(`Serie #${index + 1}: falta "id".`)] };
  if (RESERVED_GROUP_IDS.includes(series.id)) {
    return { problems: [error(`Serie "${series.id}": ese id está reservado, usá otro.`)] };
  }
  if (!Array.isArray(series.items)) return { problems: [error(`Serie "${series.id}": falta la lista "items".`)] };
  const seriesStyle = validateStyle(series.style, `Serie "${series.id}"`);
  const seriesStore = storeFields(series, NO_STORE_FIELDS, `Serie "${series.id}"`);
  const items = series.items.map((item, i) => normalizeItem(item, i, series, seriesStyle.style, seriesStore.fields, colorIds));
  return {
    group: { id: series.id, name: isText(series.name) ? series.name : series.id },
    products: items.filter((r) => r.product).map((r) => r.product),
    problems: [...seriesStyle.problems, ...seriesStore.problems, ...items.flatMap((r) => r.problems)],
  };
}

function normalizeList(list, label, normalizeEntry) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return [{ problems: [error(`"${label}" debe ser una lista.`)] }];
  return list.map(normalizeEntry);
}

function dedupeProducts(products) {
  return products.reduce(({ products: unique, problems }, product) => (
    unique.some((p) => p.id === product.id)
      ? { products: unique, problems: [...problems, error(`ID repetido "${product.id}": se ignora la segunda remera.`)] }
      : { products: [...unique, product], problems }
  ), { products: [], problems: [] });
}

function dedupeSeries(results) {
  return results.reduce((kept, result) => (
    result.group && kept.some((r) => r.group?.id === result.group.id)
      ? [...kept, { problems: [error(`Serie "${result.group.id}" repetida: se ignora la segunda.`)] }]
      : [...kept, result]
  ), []);
}

/** One font per family; a second file with the same family name is ignored with a warning. */
function collectFonts(products) {
  return products.reduce(({ fonts, problems }, { style }) => {
    const family = style && fontFamilyFromFile(style.font);
    if (!family) return { fonts, problems };
    const existing = fonts.find((font) => font.family === family);
    if (!existing) return { fonts: [...fonts, { family, file: style.font }], problems };
    if (existing.file === style.font) return { fonts, problems };
    const message = `Las fuentes "${existing.file}" y "${style.font}" tienen el mismo nombre: se usa la primera.`;
    return problems.some((p) => p.message === message) ? { fonts, problems } : { fonts, problems: [...problems, warning(message)] };
  }, { fonts: [], problems: [] });
}

/**
 * Validates and normalizes the raw catalog.
 * Returns { catalog, problems }; catalog is null when it cannot be used at all.
 * Each problem is { level: 'error' | 'warning', message }.
 */
export function normalizeCatalog(raw) {
  if (!isObject(raw)) return fail('El catálogo debe ser un objeto JSON.');
  const { base, problems: baseProblems, error: baseError } = normalizeBase(raw.base);
  if (baseError) return fail(baseError);

  const colorResult = normalizeColors(raw.colors);
  if (colorResult.colors.length === 0) {
    return { catalog: null, problems: [...colorResult.problems, error('No hay ningún color válido en "colors".')] };
  }
  const colorIds = colorResult.colors.map((c) => c.id);

  const designs = normalizeList(raw.designs, 'designs', (d, i) => normalizeDesign(d, i, colorIds));
  const series = dedupeSeries(normalizeList(raw.series, 'series', (s, i) => normalizeOneSeries(s, i, colorIds)));
  const unique = dedupeProducts([
    ...designs.filter((r) => r.product).map((r) => r.product),
    ...series.flatMap((r) => r.products ?? []),
  ]);
  const fonts = collectFonts(unique.products);

  return {
    catalog: {
      base,
      colors: colorResult.colors,
      fonts: fonts.fonts,
      groups: series.filter((r) => r.group).map((r) => r.group),
      products: unique.products,
    },
    problems: [
      ...baseProblems,
      ...colorResult.problems,
      ...designs.flatMap((r) => r.problems),
      ...series.flatMap((r) => r.problems),
      ...unique.problems,
      ...fonts.problems,
    ],
  };
}
