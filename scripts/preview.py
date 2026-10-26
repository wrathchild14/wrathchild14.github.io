from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
class PublicPreview(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def allowed(self):
        path = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        parts = Path(path).parts
        allowed = path in ('index.html', 'styles.css') or path.startswith(('assets/', 'doom/'))
        safe = all(not part.startswith('.') and part not in ('tests', 'scripts', 'node_modules') for part in parts)
        return allowed and safe and (ROOT / path).resolve().is_relative_to(ROOT)
    def do_GET(self):
        if not self.allowed():
            self.send_error(404)
            return
        super().do_GET()
    def do_HEAD(self):
        if not self.allowed():
            self.send_error(404)
            return
        super().do_HEAD()
    def list_directory(self, path):
        self.send_error(404)
        return None

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Preview public portfolio and game files locally.')
    parser.add_argument('--port', type=int, default=8081)
    args = parser.parse_args()
    print(f'Preview: http://127.0.0.1:{args.port}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), PublicPreview).serve_forever()
