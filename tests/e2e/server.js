// Serves the repository on a free local port, as GitHub Pages would, without cache. `overrides` maps a
// path such as /catalog.json to the body served instead of the file, or to an HTTP status to answer.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
});

async function bodyFor(file, overrides) {
  if (Object.hasOwn(overrides, file)) return overrides[file];
  const path = join(ROOT, normalize(file));
  if (!path.startsWith(ROOT)) return 404;
  return readFile(path).catch(() => 404);
}

/** Starts the server; returns { url, close }. */
export async function startSite(overrides = {}) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://site').pathname);
    const body = await bodyFor(path === '/' ? '/index.html' : path, overrides);
    if (typeof body === 'number') {
      response.writeHead(body);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    }),
  };
}
