"""Local server for the store and the viewer.

Same as `python3 -m http.server`, but it tells the browser to revalidate every file
(Cache-Control: no-cache), so edits to catalog.json, stickers or designs show up
with a normal reload. Unchanged files still answer 304, so reloads stay fast.
It only listens on localhost.

Usage: python3 scripts/serve.py [port]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DEFAULT_PORT = 8000
HOST = "127.0.0.1"
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    handler = partial(NoCacheHandler, directory=str(PROJECT_ROOT))
    with ThreadingHTTPServer((HOST, port), handler) as server:
        print(
            f"Store: http://localhost:{port}   Viewer: http://localhost:{port}/viewer.html   (Ctrl+C to stop)",
            flush=True,
        )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
