// Keep index.html in step with portfolio.mrbl, on every commit.
//
// The two files are the same bytes, so they are the same git blob — the staged
// index.html can be set to the .mrbl's object id directly, with nothing read,
// written or hashed. That also means it is taken from the *staged* .mrbl rather
// than from the working tree: the staged bytes are the ones about to become a
// commit. In the ordinary case the two are the same file and the distinction is
// invisible; when someone stages part of a change, it is the difference between
// a commit whose html matches its .mrbl and one whose html is a guess about the
// future.
//
// The working-tree index.html is written from the working tree separately, so
// the file on disk keeps matching the file on disk.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// stderr is captured rather than inherited: two of the calls below are asking
// whether something exists, and `git show` answers "no" by printing `fatal:`.
const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const root = git('rev-parse', '--show-toplevel').trim();
const DOC = 'portfolio.mrbl';
const OUT = 'index.html';

// A commit that deletes the document has nothing to publish.
if (!git('ls-files', DOC).trim()) process.exit(0);

const docBlob = git('rev-parse', `:${DOC}`).trim();

let outBlob = null;
try {
  outBlob = git('rev-parse', `:${OUT}`).trim();
} catch {
  // not in the index yet
}

if (outBlob !== docBlob) {
  git('update-index', '--add', '--cacheinfo', `100644,${docBlob},${OUT}`);
  console.log('[pre-commit] index.html restaged as a copy of portfolio.mrbl');
}

// And keep the file on disk in step with the file on disk.
const worktreeDoc = fs.readFileSync(path.join(root, DOC), 'utf8');
const onDisk = path.join(root, OUT);
if (!fs.existsSync(onDisk) || fs.readFileSync(onDisk, 'utf8') !== worktreeDoc) {
  fs.writeFileSync(onDisk, worktreeDoc);
  if (git('diff', '--name-only', '--', DOC).trim()) {
    console.log('[pre-commit] note: portfolio.mrbl has unstaged changes, so the index.html left');
    console.log('[pre-commit]       in your working tree is ahead of the one being committed.');
  }
}
