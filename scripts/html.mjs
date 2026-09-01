// `npm run html` — write index.html from portfolio.mrbl.
//
// index.html *is* portfolio.mrbl, byte for byte. Not a conversion, not a build:
// the same file under the extension a web server knows how to serve. The .mrbl
// is valid HTML5 and every affordance in it is gated on `window.marble`, so a
// visitor's browser — which has no carrier to inject one — parses the editor
// machinery and runs none of it. The page a visitor gets is the page the
// document describes, and there is no second artifact that can disagree with it.
//
// Run by hand, by the pre-commit hook, and by the pre-push hook (with --check,
// which writes nothing and exits non-zero if the committed file is stale). One
// entry point for all three so there is no second answer to what the site is.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOC = path.join(ROOT, 'portfolio.mrbl');
const OUT = path.join(ROOT, 'index.html');
const check = process.argv.includes('--check');
const quiet = process.argv.includes('--quiet');

const source = fs.readFileSync(DOC, 'utf8');
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;

if (check) {
  if (current === source) {
    if (!quiet) console.log('index.html is current');
    process.exit(0);
  }
  console.error(
    current === null
      ? '\n  index.html is missing — the deployed site is served from it.\n'
      : '\n  index.html is stale: portfolio.mrbl has changed since it was copied.\n',
  );
  console.error('  Run `npm run html`, then commit index.html alongside the .mrbl.\n');
  process.exit(1);
}

if (current === source) {
  if (!quiet) console.log('index.html already current');
  process.exit(0);
}

fs.writeFileSync(OUT, source);

if (!quiet) {
  const kb = `${(Buffer.byteLength(source) / 1024).toFixed(1)} KB`;
  console.log(`index.html  ${kb}  — portfolio.mrbl, byte for byte`);
}
