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
// the .mrbl is index.html and public/ is the site root, and the same paths resolve.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Not 4321. That is Marble's default, and anyone with a second .mrbl project
// open is already on it — the failure is an EADDRINUSE at startup, which is
// loud but wastes a minute every time.
const PORT = Number(process.env.PORT ?? 4380);
const INNER = PORT + 1;
const PUBLIC = path.resolve('public');
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
  console.log(`\n  portfolio  http://localhost:${PORT}/a/${APP}`);
  console.log(`  assets     public/ on the same origin\n`);
});
