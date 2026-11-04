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

// label completes "Completá … para continuar." / "Revisá … para continuar."; the order is the form's order
const FIELDS = Object.freeze({
  street: { label: 'la calle', required: 'La calle es obligatoria.', max: 80 },
  number: { label: 'el número', required: 'El número es obligatorio.', max: 10 },
  floor: { label: 'el piso', max: 10 },
  apartment: { label: 'el depto', max: 10 },
  postalCode: {
    label: 'el código postal', required: 'El código postal es obligatorio.', max: 8,
    check: (v) => POSTAL_CODE.test(v) || 'Revisá el código postal.',
  },
  city: { label: 'la localidad', required: 'La localidad es obligatoria.', max: 80 },
  province: {
    label: 'la provincia', required: 'Elegí una provincia.', max: 40,
    check: (v) => PROVINCES.includes(v) || 'Elegí una provincia.',
  },
  notes: { label: 'las instrucciones', max: 500 },
  firstName: { label: 'tu nombre', required: 'El nombre es obligatorio.', max: 60 },
  lastName: { label: 'tu apellido', required: 'El apellido es obligatorio.', max: 60 },
  email: { label: 'el email', required: 'El email es obligatorio.', max: 120, check: (v) => EMAIL.test(v) || 'Revisá el email.' },
  phone: { label: 'el teléfono', required: 'El teléfono es obligatorio.', max: 30, check: (v) => isPhone(v) || 'Revisá el teléfono.' },
});

export const FIELD_ORDER = Object.freeze(Object.keys(FIELDS));
export const REQUIRED_FIELDS = Object.freeze(FIELD_ORDER.filter((name) => FIELDS[name].required));
/** name → max length, for the inputs' maxlength attribute. */
export const FIELD_LIMITS = Object.freeze(Object.fromEntries(FIELD_ORDER.map((name) => [name, FIELDS[name].max])));

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function fieldError(name, raw) {
  const rule = FIELDS[name];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return rule.required ?? null;
  if (value.length > rule.max) return `Máximo ${rule.max} caracteres.`;
  const verdict = rule.check ? rule.check(value) : true;
  return verdict === true ? null : verdict;
}

/** { fieldName: message } for every invalid field; {} when the form is complete. */
export function validateCheckout(values) {
  return Object.fromEntries(FIELD_ORDER
    .map((name) => [name, fieldError(name, values?.[name])])
    .filter(([, message]) => message));
}

/** "Completá la calle para continuar." for the first field (in form order) that blocks the payment. */
export function firstProblem(errors) {
  const name = FIELD_ORDER.find((field) => errors[field]);
  if (!name) return null;
  const { label, required } = FIELDS[name];
  return errors[name] === required ? `Completá ${label} para continuar.` : `Revisá ${label} para continuar.`;
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
