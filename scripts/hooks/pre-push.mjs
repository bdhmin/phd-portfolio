// Refuse to push a commit whose index.html is not what its portfolio.mrbl makes.
//
// The pre-commit hook is what normally keeps them together, and it can be
// skipped — `--no-verify`, a merge commit, a commit made before the hook was
// installed, a rebase that replays an old one. A push is the last point where
// that is still cheap to notice, because after it the deployed site is a file
// nobody wrote.
//
// git hands a push over on stdin, one line per ref:
//   <local ref> <local sha> <remote ref> <remote sha>

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { toHtml, verify } from '../mrbl-to-html.mjs';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const ZERO = /^0+$/;

let stdin = '';
try {
  stdin = fs.readFileSync(0, 'utf8');
} catch {
  // no refs on stdin — nothing named, nothing to check
}
const lines = stdin.split('\n').filter(Boolean);

const problems = [];

for (const line of lines) {
  const [localRef, localSha] = line.split(' ');
  if (ZERO.test(localSha)) continue; // a deletion

  let source;
  try {
    source = git('show', `${localSha}:portfolio.mrbl`);
  } catch {
    continue; // no document at this tip, nothing to publish
  }

  const { html } = toHtml(source);
  verify(source, html);

  let committed = null;
  try {
    committed = git('show', `${localSha}:index.html`);
  } catch {
    // missing
  }

  if (committed !== html) {
    problems.push(
      `  ${localRef} (${localSha.slice(0, 8)}) — index.html is ` +
        (committed === null ? 'missing' : 'not what portfolio.mrbl makes'),
    );
  }
}

if (problems.length) {
  console.error('\n  Refusing to push: the deployed page would not match the document.\n');
  console.error(problems.join('\n'));
  console.error('\n  Fix the tip commit:');
  console.error('    npm run html && git add index.html && git commit --amend --no-edit\n');
  process.exit(1);
}
