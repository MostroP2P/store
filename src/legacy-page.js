// Old page (producto.html, visor.html): sends the visitor to the new address in <html data-redirect>,
// with the query parameters renamed by data-rename ("old:new") and the hash kept.

import { legacyTarget, parseRenames } from './redirect.js';

const { redirect, rename } = document.documentElement.dataset;
window.location.replace(legacyTarget(redirect, window.location.search, window.location.hash, parseRenames(rename)));
