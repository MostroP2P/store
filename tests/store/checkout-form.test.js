import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_ORDER,
  REQUIRED_FIELDS,
  PROVINCES,
  validateCheckout,
  firstProblem,
  sanitizeSavedForm,
  savedFormRecord,
  restoreSavedForm,
  SAVED_FORM_TTL_MS,
} from '../../src/store/checkout-form.js';

const VALID = Object.freeze({
  street: 'Av. Siempreviva',
  number: '742',
  floor: '',
  apartment: '',
  postalCode: '1234',
  city: 'Springfield',
  province: 'Buenos Aires',
  notes: '',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  phone: '+54 9 11 2233-4455',
});

test('a complete form has no errors', () => {
  assert.deepEqual(validateCheckout(VALID), {});
});

test('every required field is reported when empty', () => {
  const errors = validateCheckout({});
  assert.deepEqual(Object.keys(errors).sort(), [
    'city', 'email', 'firstName', 'lastName', 'number', 'phone', 'postalCode', 'province', 'street',
  ]);
  assert.equal(errors.street, 'La calle es obligatoria.');
});

test('blank text counts as empty', () => {
  assert.equal(validateCheckout({ ...VALID, firstName: '   ' }).firstName, 'El nombre es obligatorio.');
});

test('checks email, phone, postal code and province formats', () => {
  const errors = validateCheckout({ ...VALID, email: 'ana@', phone: '12-34', postalCode: '12', province: 'Narnia' });
  assert.equal(errors.email, 'Revisá el email.');
  assert.equal(errors.phone, 'Revisá el teléfono.');
  assert.equal(errors.postalCode, 'Revisá el código postal.');
  assert.equal(errors.province, 'Elegí una provincia.');
});

test('accepts the new Argentine postal code (CPA)', () => {
  assert.deepEqual(validateCheckout({ ...VALID, postalCode: 'c1425abc' }), {});
});

test('limits the length of every field', () => {
  const errors = validateCheckout({ ...VALID, notes: 'x'.repeat(501), city: 'x'.repeat(81) });
  assert.equal(errors.notes, 'Máximo 500 caracteres.');
  assert.equal(errors.city, 'Máximo 80 caracteres.');
});

test('firstProblem follows the form order', () => {
  assert.equal(firstProblem({}), null);
  assert.equal(firstProblem(validateCheckout({})), 'Completá la calle para continuar.');
  const errors = validateCheckout({ ...VALID, email: 'nope', phone: '' });
  assert.equal(firstProblem(errors), 'Revisá el email para continuar.');
});

test('FIELD_ORDER covers every validated field', () => {
  assert.deepEqual([...FIELD_ORDER].sort(), Object.keys(VALID).sort());
});

test('REQUIRED_FIELDS are exactly the fields reported when the form is empty', () => {
  assert.deepEqual([...REQUIRED_FIELDS].sort(), Object.keys(validateCheckout({})).sort());
});

test('PROVINCES lists the 24 Argentine jurisdictions', () => {
  assert.equal(PROVINCES.length, 24);
  assert.ok(PROVINCES.includes('Ciudad Autónoma de Buenos Aires'));
  assert.ok(PROVINCES.includes('Tierra del Fuego'));
});

test('sanitizeSavedForm keeps only known text fields, cut to their limit', () => {
  const saved = sanitizeSavedForm({ ...VALID, notes: 'y'.repeat(600), email: 42, extra: 'x', __proto__: { evil: 1 } });
  assert.equal(saved.notes.length, 500);
  assert.equal(saved.email, '');
  assert.equal('extra' in saved, false);
  assert.equal(saved.street, 'Av. Siempreviva');
  assert.deepEqual(sanitizeSavedForm('nope'), Object.fromEntries(FIELD_ORDER.map((f) => [f, ''])));
});

test('saved form data expires after a week', () => {
  const now = 1_800_000_000_000;
  const record = savedFormRecord({ ...VALID, extra: 'x' }, now);
  assert.equal(record.savedAt, now);
  assert.equal('extra' in record.values, false);
  assert.deepEqual(restoreSavedForm(record, now + 1000), sanitizeSavedForm(VALID));
  assert.equal(restoreSavedForm(record, now + SAVED_FORM_TTL_MS + 1), null);
  assert.equal(restoreSavedForm({ savedAt: 'ayer', values: VALID }, now), null);
  assert.equal(restoreSavedForm(VALID, now), null, 'old format without date');
  assert.equal(restoreSavedForm(null, now), null);
});
