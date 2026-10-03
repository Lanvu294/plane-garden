#!/usr/bin/env python3
"""Dev server for the plane garden.

Plain http.server answers 304 Not Modified, which lets a browser keep an old
common.js while loading a new page that depends on it — the page then dies on
a missing function and the viewport goes blank with no explanation. So: never
cache anything.

It also answers /api/questions the way the Vercel function (api/questions.js)
does, storing submissions in data/pending.json, so asking a question works
locally. The clean-up rules below mirror the function's — keep them in step.
"""
import json, os, re, sys, time, random, string, threading
from urllib.parse import urlparse, parse_qs
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

MIN, MAX, LIST_MAX, RATE, RATE_WINDOW_S = 8, 280, 200, 5, 600
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'pending.json')
ADMIN_TOKEN = os.environ.get('ADMIN_TOKEN', 'local-admin')
lock = threading.Lock()
rate = {}

def redact(text):
    changed = [False]
    def sub(pattern, rep, flags=0):
        nonlocal text
        def f(m):
            changed[0] = True
            return rep(m) if callable(rep) else rep
        text = re.sub(pattern, f, text, flags=flags)
    sub(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[email removed]', re.I)
    sub(r'\b(?:https?://|www\.)\S+', '[link removed]', re.I)
    sub(r'[+(]?(?:\d[\s().-]*){7,}\d', '[number removed]')
    sub(r'(^|\s)@[A-Za-z0-9_.]{2,}', lambda m: m.group(1) + '[handle removed]')
    return text, changed[0]

def clean(raw):
    s = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', str(raw or ''))   # shown as text, never as HTML
    return re.sub(r'\s+', ' ', s).strip()

def load():
    try:
        with open(DATA) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'pending': [], 'hidden': []}

def save(db):
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    with open(DATA, 'w') as f:
        json.dump(db, f, indent=1)

class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_head(self):
        # strip the browser's revalidation headers so we always answer 200
        self.headers.replace_header('If-Modified-Since', '') if 'If-Modified-Since' in self.headers else None
        self.headers.replace_header('If-None-Match', '') if 'If-None-Match' in self.headers else None
        return super().send_head()

    # ---------------------------------------------------------- /api/questions
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _api(self):
        return urlparse(self.path).path.rstrip('/') == '/api/questions'

    def do_GET(self):
        if not self._api():
            return super().do_GET()
        with lock:
            db = load()
        hide = set(db.get('hidden', []))
        self._json(200, {'pending': [x for x in db['pending'] if x['id'] not in hide][:LIST_MAX]})

    def do_POST(self):
        if not self._api():
            return self._json(404, {'error': 'not-found'})
        try:
            n = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(n) or b'{}')
        except ValueError:
            return self._json(400, {'error': 'bad-json'})
        if body.get('website'):
            return self._json(201, {'item': None})
        t = body.get('t')
        if isinstance(t, (int, float)) and t < 1500:
            return self._json(400, {'error': 'too-fast'})
        text, changed = redact(clean(body.get('q')))
        if len(text) < MIN:
            return self._json(400, {'error': 'too-short'})
        if len(text) > MAX:
            return self._json(400, {'error': 'too-long'})
        ip, now = self.client_address[0], time.time()
        hits = [h for h in rate.get(ip, []) if now - h < RATE_WINDOW_S]
        if len(hits) >= RATE:
            return self._json(429, {'error': 'slow-down'})
        rate[ip] = hits + [now]
        item = {'id': format(int(now * 1000), 'x') + ''.join(random.choice(string.ascii_lowercase) for _ in range(5)),
                'q': text, 'at': int(now * 1000)}
        with lock:
            db = load()
            db['pending'].insert(0, item)
            db['pending'] = db['pending'][:LIST_MAX * 5]
            save(db)
        self._json(201, {'item': item, 'redacted': changed})

    def do_DELETE(self):
        if not self._api():
            return self._json(404, {'error': 'not-found'})
        if self.headers.get('x-admin-token') != ADMIN_TOKEN:
            return self._json(403, {'error': 'forbidden'})
        q = parse_qs(urlparse(self.path).query).get('id', [''])[0]
        if not q:
            return self._json(400, {'error': 'no-id'})
        with lock:
            db = load()
            db.setdefault('hidden', []).append(q)
            save(db)
        self._json(200, {'hidden': q})

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8732
    print('serving %s on http://localhost:%d (no-cache, /api/questions -> data/pending.json)' % ('.', port))
    ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
