// Publishing.
//
// dist/ is public/ with index.html on top of it: an index at the root, and the
// assets beside it at the paths the document asks for.
//
// index.html is written here from portfolio.mrbl rather than copied from the
// repository, even though the repository has a committed copy, because a copy
// can be stale and a derivation cannot. The derivation is the identity: the
// .mrbl is valid HTML5 and every affordance in it is gated on `window.marble`,
// so served to a browser with no carrier it is exactly the page it describes.
// The hooks in .githooks keep the committed copy honest for anyone reading the
// repository; this makes the deployed site true by construction regardless.

import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('dist');
const DOC = path.resolve('portfolio.mrbl');

const source = fs.readFileSync(DOC, 'utf8');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.resolve('public'), OUT, { recursive: true });
fs.rmSync(path.join(OUT, '.DS_Store'), { force: true });
fs.writeFileSync(path.join(OUT, 'index.html'), source);

// If the committed copy disagrees with what a deploy would serve, the deploy is
// still right — but say so, because it means a commit went in without the hook.
const committed = path.resolve('index.html');
if (fs.existsSync(committed) && fs.readFileSync(committed, 'utf8') !== source) {
  console.warn('warning: the committed index.html is stale — run `npm run html` and commit it');
}

const kb = `${(Buffer.byteLength(source) / 1024).toFixed(1)} KB`;
console.log(`dist/index.html  ${kb}  — portfolio.mrbl, byte for byte`);
console.log(`dist/            public/ copied alongside it`);
