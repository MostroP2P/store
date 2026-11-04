// Shopping cart (pure, immutable): lines of product + color + size with a quantity.
// Every function returns a new cart; carts read from storage go through sanitizeCart first.

export const MAX_QUANTITY = 20;
export const EMPTY_CART = Object.freeze({ items: Object.freeze([]) });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value !== '';
const clamp = (quantity) => Math.min(MAX_QUANTITY, Math.max(0, Math.floor(quantity)));

/** Unambiguous id of a product + color + size line, whatever characters the ids contain. */
export const lineKey = ({ productId, colorId, size }) => JSON.stringify([productId, colorId, size]);

export function addItem(cart, variant, quantity = 1) {
  const key = lineKey(variant);
  const existing = cart.items.find((item) => lineKey(item) === key);
  if (!existing) {
    const { productId, colorId, size } = variant;
    const amount = clamp(quantity);
    return amount > 0 ? { items: [...cart.items, { productId, colorId, size, quantity: amount }] } : cart;
  }
  return {
    items: cart.items.map((item) => (item === existing ? { ...item, quantity: clamp(item.quantity + quantity) } : item)),
  };
}

export function removeItem(cart, key) {
  return { items: cart.items.filter((item) => lineKey(item) !== key) };
}

/** Sets a line's quantity (capped at MAX_QUANTITY); 0 removes it. Invalid values leave the cart as is. */
export function setQuantity(cart, key, quantity) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return cart;
  if (!cart.items.some((item) => lineKey(item) === key)) return cart;
  const amount = clamp(quantity);
  if (amount === 0) return removeItem(cart, key);
  return { items: cart.items.map((item) => (lineKey(item) === key ? { ...item, quantity: amount } : item)) };
}

/** Takes away what an order bought ({ productId, colorId, size, quantity } items), keeping anything added later. */
export function subtractItems(cart, bought) {
  return bought.reduce((current, item) => {
    const key = lineKey(item);
    const line = current.items.find((entry) => lineKey(entry) === key);
    return line ? setQuantity(current, key, line.quantity - item.quantity) : current;
  }, cart);
}

export const cartCount = (cart) => cart.items.reduce((sum, item) => sum + item.quantity, 0);

export function variantQuantity(cart, variant) {
  const key = lineKey(variant);
  return cart.items.find((item) => lineKey(item) === key)?.quantity ?? 0;
}

/** Rebuilds a cart from untrusted data (localStorage): drops unknown variants, merges repeats, caps quantities. */
export function sanitizeCart(raw, isValidVariant) {
  if (!isObject(raw) || !Array.isArray(raw.items)) return EMPTY_CART;
  return raw.items.reduce((cart, item) => {
    if (!isObject(item) || !Number.isInteger(item.quantity) || item.quantity < 1) return cart;
    const variant = { productId: item.productId, colorId: item.colorId, size: item.size };
    const wellFormed = isText(variant.productId) && isText(variant.colorId) && isText(variant.size);
    return wellFormed && isValidVariant(variant) ? addItem(cart, variant, item.quantity) : cart;
  }, EMPTY_CART);
}

/** Cart lines with product, color and prices; lines whose product or color no longer exist are skipped. */
export function resolveCart(cart, { products, colors }) {
  const lines = cart.items.flatMap((item) => {
    const product = products.find((p) => p.id === item.productId);
    const color = colors.find((c) => c.id === item.colorId);
    if (!product || !color) return [];
    return [{
      key: lineKey(item),
      product,
      color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: product.price,
      total: product.price * item.quantity,
    }];
  });
  return {
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.total, 0),
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
