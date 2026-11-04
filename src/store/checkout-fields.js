// Checkout form markup: delivery, notes and personal data cards built from one layout,
// with labels, autocomplete hints, an error slot per field and the notes counter.

import { el } from '../dom.js';
import { FIELD_LIMITS, REQUIRED_FIELDS, PROVINCES } from './checkout-form.js';
import { icon } from './icons.js';
import { STRINGS } from './strings.js';

const LAYOUT = Object.freeze([
  {
    icon: 'truck',
    title: '¿Dónde querés recibir tu pedido?',
    fields: [
      { name: 'street', label: 'Calle', placeholder: 'Nombre de la calle', autocomplete: 'address-line1', span: 'wide' },
      { name: 'number', label: 'Número', placeholder: 'Número', span: 'narrow' },
      { name: 'floor', label: 'Piso', placeholder: 'Ej: 3, PB' },
      { name: 'apartment', label: 'Depto', placeholder: 'Ej: B, 4' },
      { name: 'postalCode', label: 'Código postal', placeholder: '1234', autocomplete: 'postal-code' },
      { name: 'city', label: 'Localidad', placeholder: 'Ciudad o barrio', autocomplete: 'address-level2' },
      { name: 'province', label: 'Provincia', type: 'select', autocomplete: 'address-level1', span: 'full' },
    ],
  },
  {
    icon: 'chat',
    title: 'Instrucciones adicionales',
    fields: [
      { name: 'notes', label: 'Comentarios', type: 'textarea', placeholder: 'Cualquier dato que nos ayude con la entrega', span: 'full' },
    ],
  },
  {
    icon: 'user',
    title: 'Información personal',
    fields: [
      { name: 'firstName', label: 'Nombre', placeholder: 'Tu nombre', autocomplete: 'given-name' },
      { name: 'lastName', label: 'Apellido', placeholder: 'Tu apellido', autocomplete: 'family-name' },
      { name: 'email', label: 'Email', type: 'email', placeholder: 'tu@email.com', autocomplete: 'email' },
      { name: 'phone', label: 'Teléfono', type: 'tel', placeholder: '11 1234-5678', autocomplete: 'tel' },
    ],
  },
]);

const PROVINCE_PLACEHOLDER = 'Elegí tu provincia';

function control(spec, props) {
  if (spec.type === 'select') {
    return el('select', props, [
      el('option', { value: '', textContent: PROVINCE_PLACEHOLDER }),
      ...PROVINCES.map((name) => el('option', { value: name, textContent: name })),
    ]);
  }
  const text = { ...props, maxLength: FIELD_LIMITS[spec.name], placeholder: spec.placeholder };
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
    ? el('span', { className: 'required-mark', title: STRINGS.requiredMark, textContent: ' *' })
    : el('span', { className: 'muted', textContent: ` ${STRINGS.optional}` });
  const error = el('p', { className: 'field-error', id: `${id}-error` });
  const counter = spec.type === 'textarea'
    ? [el('p', { className: 'field-foot' }, [
      el('span', { textContent: STRINGS.notesHelp(FIELD_LIMITS[spec.name]) }),
      el('span', { id: `${id}-counter`, textContent: STRINGS.notesCounter(0, FIELD_LIMITS[spec.name]) }),
    ])]
    : [];
  return { node: el('div', { className: `field field-${spec.span ?? 'half'}` }, [el('label', { htmlFor: id }, [spec.label, mark]), input, ...counter, error]), input, error };
}

/** Fills `form` with the field cards. Returns { fieldsets, controls: Map(name → control), errors: Map(name → <p>) }. */
export function buildCheckoutForm(form) {
  const built = LAYOUT.map((card) => ({ card, fields: card.fields.map(field) }));
  const fieldsets = built.map(({ card, fields }) => el('fieldset', { className: 'panel' }, [
    el('legend', { className: 'panel-title' }, [icon(card.icon), card.title]),
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
