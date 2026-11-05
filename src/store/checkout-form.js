// Checkout form (pure): delivery address and contact fields, their validation and the saved copy.

export const PROVINCES = Object.freeze([
  'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Ciudad Autónoma de Buenos Aires', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]+$/;
const PHONE_DIGITS = { min: 8, max: 15 };
// 4 digits, or the 8 character CPA (C1425ABC)
const POSTAL_CODE = /^(\d{4}|[a-z]\d{4}[a-z]{3})$/i;

const isPhone = (value) => {
  const digits = value.replace(/\D/g, '').length;
  return PHONE.test(value) && digits >= PHONE_DIGITS.min && digits <= PHONE_DIGITS.max;
};

// Rules per field, in form order. The texts (labels, messages) live in strings/<lang>.js under `fields`.
const FIELDS = Object.freeze({
  street: { required: true, max: 80 },
  number: { required: true, max: 10 },
  floor: { max: 10 },
  apartment: { max: 10 },
  postalCode: { required: true, max: 8, check: (v) => POSTAL_CODE.test(v) },
  city: { required: true, max: 80 },
  province: { required: true, max: 40, check: (v) => PROVINCES.includes(v) },
  notes: { max: 500 },
  firstName: { required: true, max: 60 },
  lastName: { required: true, max: 60 },
  email: { required: true, max: 120, check: (v) => EMAIL.test(v) },
  phone: { required: true, max: 30, check: isPhone },
});

/** What can be wrong with a field. */
export const FIELD_PROBLEMS = Object.freeze({ REQUIRED: 'required', TOO_LONG: 'tooLong', INVALID: 'invalid' });

export const FIELD_ORDER = Object.freeze(Object.keys(FIELDS));
export const REQUIRED_FIELDS = Object.freeze(FIELD_ORDER.filter((name) => FIELDS[name].required));
/** Fields with a format check (they need an `invalid` message). */
export const CHECKED_FIELDS = Object.freeze(FIELD_ORDER.filter((name) => FIELDS[name].check));
/** name → max length, for the inputs' maxlength attribute. */
export const FIELD_LIMITS = Object.freeze(Object.fromEntries(FIELD_ORDER.map((name) => [name, FIELDS[name].max])));

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function fieldProblem(name, raw) {
  const rule = FIELDS[name];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return rule.required ? FIELD_PROBLEMS.REQUIRED : null;
  if (value.length > rule.max) return FIELD_PROBLEMS.TOO_LONG;
  return !rule.check || rule.check(value) ? null : FIELD_PROBLEMS.INVALID;
}

/** { fieldName: 'required' | 'tooLong' | 'invalid' } for every invalid field; {} when the form is complete. */
export function validateCheckout(values) {
  return Object.fromEntries(FIELD_ORDER
    .map((name) => [name, fieldProblem(name, values?.[name])])
    .filter(([, problem]) => problem));
}

/** Message under a field in the page language (`t`, a strings table): "La calle es obligatoria."; '' when fine. */
export function fieldMessage(t, name, problem) {
  if (problem === FIELD_PROBLEMS.TOO_LONG) return t.fieldTooLong(FIELDS[name].max);
  if (problem === FIELD_PROBLEMS.REQUIRED) return t.fields[name].required;
  if (problem === FIELD_PROBLEMS.INVALID) return t.fields[name].invalid;
  return '';
}

/** "Completá la calle para continuar." for the first field (in form order) that blocks the payment. */
export function firstProblem(t, errors) {
  const name = FIELD_ORDER.find((field) => errors[field]);
  if (!name) return null;
  const field = t.fields[name].name;
  return errors[name] === FIELD_PROBLEMS.REQUIRED ? t.completeField(field) : t.checkField(field);
}

/** Saved delivery data is kept for a week at most (shared computers). */
export const SAVED_FORM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** What goes to localStorage: the clean values and when they were saved. */
export const savedFormRecord = (values, now) => ({ savedAt: now, values: sanitizeSavedForm(values) });

/** Values from a saved record, or null when missing, malformed or older than SAVED_FORM_TTL_MS. */
export function restoreSavedForm(record, now) {
  if (!isObject(record) || !Number.isFinite(record.savedAt) || !isObject(record.values)) return null;
  if (now - record.savedAt > SAVED_FORM_TTL_MS) return null;
  return sanitizeSavedForm(record.values);
}

/** Form data read back from localStorage: only known text fields, cut to their limit. */
export function sanitizeSavedForm(raw) {
  return Object.fromEntries(FIELD_ORDER.map((name) => {
    const value = isObject(raw) && Object.hasOwn(raw, name) && typeof raw[name] === 'string' ? raw[name] : '';
    return [name, value.slice(0, FIELDS[name].max)];
  }));
}
