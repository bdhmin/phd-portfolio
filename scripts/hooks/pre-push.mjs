// Refuse to push a commit whose index.html is not its portfolio.mrbl.
//
// The pre-commit hook is what normally keeps them together, and it can be
// skipped — `--no-verify`, a merge commit, a commit made before the hook was
// installed, a rebase that replays an old one. A push is the last point where
// that is still cheap to notice, because after it the deployed site is a file
// nobody wrote.
//
// Identical bytes are the identical blob, so the check is two object ids. No
// file contents are read at all, which is what makes it free on a 110 KB
// document and on every commit in a range.
//
// git hands a push over on stdin, one line per ref:
//   <local ref> <local sha> <remote ref> <remote sha>

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// stderr is captured rather than inherited: `git rev-parse` on a path a commit
// does not have answers "no" by printing `fatal:`, and that is a question here,
// not a failure.
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const blob = (sha, file) => {
  try {
    return git('rev-parse', `${sha}:${file}`).trim();
  } catch {
    return null;
  }
};

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

  const doc = blob(localSha, 'portfolio.mrbl');
  if (!doc) continue; // no document at this tip, nothing to publish

  const out = blob(localSha, 'index.html');
  if (out === doc) continue;

  problems.push(
    `  ${localRef} (${localSha.slice(0, 8)}) — index.html is ` +
      (out === null ? 'missing' : 'not a copy of portfolio.mrbl'),
  );
}

if (problems.length) {
  console.error('\n  Refusing to push: the deployed page would not match the document.\n');
  console.error(problems.join('\n'));
  console.error('\n  Fix the tip commit:');
  console.error('    npm run html && git add index.html && git commit --amend --no-edit\n');
  process.exit(1);
}
