// Checkout form markup: delivery, notes and personal data cards built from one layout,
// with labels, autocomplete hints, an error slot per field and the notes counter.

import { el } from '../dom.js';
import { FIELD_LIMITS, REQUIRED_FIELDS, PROVINCES } from './checkout-form.js';
import { icon } from './icons.js';
import { T } from './lang.js';

// Structure only: labels, placeholders and section titles come from T (strings/<lang>.js)
const LAYOUT = Object.freeze([
  {
    icon: 'truck',
    section: 'delivery',
    fields: [
      { name: 'street', autocomplete: 'address-line1', span: 'wide' },
      { name: 'number', span: 'narrow' },
      { name: 'floor' },
      { name: 'apartment' },
      { name: 'postalCode', autocomplete: 'postal-code' },
      { name: 'city', autocomplete: 'address-level2' },
      { name: 'province', type: 'select', autocomplete: 'address-level1', span: 'full' },
    ],
  },
  {
    icon: 'chat',
    section: 'notes',
    fields: [{ name: 'notes', type: 'textarea', span: 'full' }],
  },
  {
    icon: 'user',
    section: 'personal',
    fields: [
      { name: 'firstName', autocomplete: 'given-name' },
      { name: 'lastName', autocomplete: 'family-name' },
      { name: 'email', type: 'email', autocomplete: 'email' },
      { name: 'phone', type: 'tel', autocomplete: 'tel' },
    ],
  },
]);

function control(spec, props) {
  if (spec.type === 'select') {
    return el('select', props, [
      el('option', { value: '', textContent: T.provincePlaceholder }),
      ...PROVINCES.map((name) => el('option', { value: name, textContent: name })),
    ]);
  }
  const text = { ...props, maxLength: FIELD_LIMITS[spec.name], placeholder: T.fields[spec.name].placeholder };
  if (spec.type === 'textarea') return el('textarea', { ...text, rows: 3 });
  return el('input', { ...text, type: spec.type ?? 'text' });
}

function field(spec) {
  const id = `field-${spec.name}`;
  const required = REQUIRED_FIELDS.includes(spec.name);
  const input = control(spec, {
    id, name: spec.name, required, autocomplete: spec.autocomplete ?? 'off', 'aria-describedby': `${id}-error`,
  });
  const mark = required
    ? el('span', { className: 'required-mark', title: T.requiredMark, textContent: ' *' })
    : el('span', { className: 'muted', textContent: ` ${T.optional}` });
  const error = el('p', { className: 'field-error', id: `${id}-error` });
  const counter = spec.type === 'textarea'
    ? [el('p', { className: 'field-foot' }, [
      el('span', { textContent: T.notesHelp(FIELD_LIMITS[spec.name]) }),
      el('span', { id: `${id}-counter`, textContent: T.notesCounter(0, FIELD_LIMITS[spec.name]) }),
    ])]
    : [];
  return { node: el('div', { className: `field field-${spec.span ?? 'half'}` }, [el('label', { htmlFor: id }, [T.fields[spec.name].label, mark]), input, ...counter, error]), input, error };
}

/** Fills `form` with the field cards. Returns { fieldsets, controls: Map(name → control), errors: Map(name → <p>) }. */
export function buildCheckoutForm(form) {
  const built = LAYOUT.map((card) => ({ card, fields: card.fields.map(field) }));
  const fieldsets = built.map(({ card, fields }) => el('fieldset', { className: 'panel' }, [
    el('legend', { className: 'panel-title' }, [icon(card.icon), T.formSections[card.section]]),
    el('div', { className: 'field-grid' }, fields.map((f) => f.node)),
  ]));
  form.replaceChildren(...fieldsets);
  const all = built.flatMap(({ card, fields }) => fields.map((f, i) => [card.fields[i].name, f]));
  return {
    fieldsets,
    controls: new Map(all.map(([name, f]) => [name, f.input])),
    errors: new Map(all.map(([name, f]) => [name, f.error])),
  };
}
