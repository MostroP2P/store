// DOM helpers shared by the viewer and the store. Text always goes through textContent (no innerHTML).

const SVG_NS = 'http://www.w3.org/2000/svg';

/** True when `node[key] = value` works (some DOM properties, such as button.form, only have a getter). */
function isWritableProperty(node, key) {
  for (let proto = node; proto; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);
    if (descriptor) return Boolean(descriptor.set) || descriptor.writable === true;
  }
  return false;
}

function applyProps(node, props) {
  Object.entries(props).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (!(node instanceof SVGElement) && isWritableProperty(node, key)) node[key] = value;
    else node.setAttribute(key, value);
  });
}

/** el('button', { type: 'button', textContent: 'Hola', onclick }, [children]) */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  applyProps(node, props);
  node.append(...children);
  return node;
}

/** Same as el() for SVG elements: every prop becomes an attribute. */
export function svgEl(tag, props = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  applyProps(node, props);
  node.append(...children);
  return node;
}
