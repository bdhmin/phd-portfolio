// One origin for local work.
//
// `marble serve` answers for the document and nothing else — /a/, /runtime/,
// /events, /intent — and returns 404 for everything else on purpose: a host
// that served files would be deciding what a document's assets are. This site's
// assets are real files (11 thumbnails, a portrait, 84MB of PDFs), and they are
// addressed the same way in development as they are in production: /thumbnails/x.png
// from the site root. So the two answers have to arrive on one origin.
//
// This puts public/ in front and hands everything the Marble host owns to it.
// It is development-only. In production there is no proxy and no marble host —
// the .mrbl *is* index.html and public/ is the site root, and the same paths
// resolve.
//
// Because production is the same bytes with no host in front, both halves of
// that sentence are servable here, side by side:
//
//   /a/portfolio   the document with a carrier   — editable
//   /html          the document with no carrier  — what a visitor gets
//
// Same file, two origins for the same page. Nothing is converted between them;
// the affordances are all gated on `window.marble`, so the second one is quiet
// for the same reason the deployed site is.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Not 4321. That is Marble's default, and anyone with a second .mrbl project
// open is already on it — the failure is an EADDRINUSE at startup, which is
// loud but wastes a minute every time.
const PORT = Number(process.env.PORT ?? 4380);
const INNER = PORT + 1;
const ROOT = path.resolve(import.meta.dirname);
const PUBLIC = path.join(ROOT, 'public');
const DOC = path.join(ROOT, 'portfolio.mrbl');
const OUT = path.join(ROOT, 'index.html');
const APP = 'portfolio';

// Which of the two answers a request. Asked as "is there a file for this?"
// rather than as a list of the host's routes, because a list is a copy of
// something the host already knows and it drifts the moment the host learns a
// new one. It drifted immediately: the first version of this named /a/,
// /runtime/, /events and /intents, and the host also serves /ops — so every
// op a gesture filed 404'd here, the page moved, the file never changed, and
// the next reconcile put the old value back. Nothing persisted, and it looked
// like the affordances were broken rather than the proxy.

const TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.JPEG': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

// ── index.html follows portfolio.mrbl ───────────────────────────────────────
//
// Every save, and every op the host writes while you edit. Publishing is a
// copy, so keeping the two in step is a copy too — there is no build to be
// out of date, only a file that is either the same bytes or hasn't caught up
// yet. `npm run html` does this once; this does it for as long as dev is up.

const watchers = new Set();

function sync() {
  const source = fs.readFileSync(DOC, 'utf8');
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (current === source) return false;
  fs.writeFileSync(OUT, source);
  for (const res of watchers) res.write('data: changed\n\n');
  return true;
}

sync();

// Watched through the directory rather than the file: an editor that saves
// atomically writes a new file and renames it over the old one, and a watch on
// the old inode stops hearing about a file that no longer exists. Debounced
// because one save is several events, and because the host writes the document
// itself while an op is being applied.
let pending;
fs.watch(ROOT, (_event, name) => {
  if (name !== 'portfolio.mrbl') return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    try {
      if (sync()) console.log('  index.html  ← portfolio.mrbl');
    } catch (err) {
      console.error(`[dev] could not copy portfolio.mrbl — ${err.message}`);
    }
  }, 40);
});

// The published page, reloaded when the document changes. The snippet is added
// to the response and never to the file: what is on disk stays byte-identical
// to the .mrbl, which is the whole claim this preview exists to let you check.
const RELOAD = `
<!-- dev only: not in index.html, not deployed -->
<script>new EventSource('/__dev/reload').onmessage = () => location.reload();</script>
`;

const marble = spawn(
  process.platform === 'win32' ? 'marble.cmd' : 'marble',
  ['serve', '.', '--port', String(INNER), '--app', APP],
  { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, PORT: String(INNER) } },
);
marble.on('error', (err) => {
  console.error(`[dev] could not start marble — ${err.message}\n[dev] run: npm install`);
  process.exit(1);
});

const stop = () => {
  marble.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // The published view. Claimed before the proxy, because the host owns
  // everything it is not asked about and would answer 404 for these.
  if (url.pathname === '/__dev/reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 500\n\n');
    watchers.add(res);
    req.on('close', () => watchers.delete(res));
    return;
  }

  if (url.pathname === '/html' || url.pathname === '/html/') {
    const body = fs.readFileSync(OUT, 'utf8').replace(/<\/body>/i, `${RELOAD}</body>`);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    return res.end(body);
  }

  // The same bytes as text, for reading and diffing rather than rendering.
  if (url.pathname === '/html/source') {
    const body = fs.readFileSync(OUT);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    return res.end(body);
  }

  const file = path.join(PUBLIC, path.normalize(decodeURIComponent(url.pathname)));
  const asset = file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile();

  if (!asset) {
    // Piped both ways and never buffered: /events is an event stream, and a
    // proxy that collects the body before forwarding it is a proxy that hangs.
    const upstream = http.request(
      { host: '127.0.0.1', port: INNER, path: req.url, method: req.method, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`marble host not reachable: ${err.message}`);
    });
    return req.pipe(upstream);
  }

  const stat = fs.statSync(file);
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  portfolio  http://localhost:${PORT}/a/${APP}      editable (marble host)`);
  console.log(`  published  http://localhost:${PORT}/html           what a visitor gets`);
  console.log(`  source     http://localhost:${PORT}/html/source    the same bytes, as text`);
  console.log(`\n  index.html follows portfolio.mrbl on every save. assets: public/\n`);
});
