// `npm run html` — write index.html from portfolio.mrbl.
//
// Run by hand, by the pre-commit hook, and by the pre-push hook (with --check,
// which writes nothing and exits non-zero if the committed file is stale). One
// entry point for all three so there is no second answer to what the site is.

import fs from 'node:fs';
import path from 'node:path';
import { toHtml, verify } from './mrbl-to-html.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOC = path.join(ROOT, 'portfolio.mrbl');
const OUT = path.join(ROOT, 'index.html');
const check = process.argv.includes('--check');
const quiet = process.argv.includes('--quiet');

const source = fs.readFileSync(DOC, 'utf8');
const { html, counts } = toHtml(source);
verify(source, html);

const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;

if (check) {
  if (current === html) {
    if (!quiet) console.log('index.html is current');
    process.exit(0);
  }
  console.error(
    current === null
      ? '\n  index.html is missing — the deployed site is built from it.\n'
      : '\n  index.html is stale: portfolio.mrbl has changed since it was written.\n',
  );
  console.error('  Run `npm run html`, then commit index.html alongside the .mrbl.\n');
  process.exit(1);
}

if (current === html) {
  if (!quiet) console.log('index.html already current');
  process.exit(0);
}

fs.writeFileSync(OUT, html);

if (!quiet) {
  const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
  console.log(`index.html  ${kb(html)}  (from ${kb(source)} of portfolio.mrbl)`);
  console.log(
    `  removed  ${counts.scripts} affordance script(s), ${counts.templates} template(s), ` +
      `${counts.adders} adder(s), ${counts.meta} host meta, ${counts.attrs} editor attribute(s)`,
  );
}
