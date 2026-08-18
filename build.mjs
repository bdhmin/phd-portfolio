// Publishing, which is a copy rather than a build.
//
// There is nothing to compile — portfolio.mrbl is already the page a browser
// runs. All this does is give a static host the two things it expects: an
// index.html at the root, and the assets beside it at the paths the document
// asks for. Deleting this file and uploading `portfolio.mrbl` as `index.html`
// by hand would produce the same site.

import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('dist');
const DOC = path.resolve('portfolio.mrbl');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.resolve('public'), OUT, { recursive: true });
fs.copyFileSync(DOC, path.join(OUT, 'index.html'));
fs.rmSync(path.join(OUT, '.DS_Store'), { force: true });

const bytes = fs.statSync(path.join(OUT, 'index.html')).size;
console.log(`dist/index.html  ${(bytes / 1024).toFixed(1)} KB  (portfolio.mrbl, byte for byte)`);
console.log(`dist/            public/ copied alongside it`);
