// Safe localStorage access. Storage can be missing, full or blocked (private mode), so nothing here throws.

export function readJson(storage, key, fallback) {
  try {
    const text = storage?.getItem(key);
    return text === null || text === undefined ? fallback : JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** Returns false when the value could not be saved (no storage, quota exceeded, blocked). */
export function writeJson(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Blocked storage has nothing saved to remove
  }
}

/** window.localStorage / window.sessionStorage, or null when the browser blocks it (privacy settings). */
export function browserStorage(name, scope = globalThis) {
  try {
    return scope[name] ?? null;
  } catch {
    return null;
  }
}
