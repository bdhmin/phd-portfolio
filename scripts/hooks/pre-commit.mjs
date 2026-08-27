// Keep index.html in step with portfolio.mrbl, on every commit.
//
// It is built from the *staged* .mrbl rather than from the working tree,
// because the staged bytes are the ones about to become a commit. In the
// ordinary case the two are the same file and the distinction is invisible; when
// someone stages part of a change, it is the difference between a commit whose
// html matches its .mrbl and one whose html is a guess about the future.
//
// The working-tree index.html is written from the working tree separately, so
// the file on disk keeps matching the file on disk.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { toHtml, verify } from '../mrbl-to-html.mjs';

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
const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n');
const tracked = git('ls-files', DOC).trim();
if (!tracked) process.exit(0);

const build = (source) => {
  const { html } = toHtml(source);
  verify(source, html);
  return html;
};

// What the commit will contain.
const stagedDoc = git('show', `:${DOC}`);
const stagedHtml = build(stagedDoc);

let stagedHtmlBefore = null;
try {
  stagedHtmlBefore = git('show', `:${OUT}`);
} catch {
  // not in the index yet
}

if (stagedHtmlBefore !== stagedHtml) {
  // Write the blob and put it in the index directly, so what gets committed is
  // what was derived from the staged .mrbl even if the working tree has moved on.
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin', '--path', OUT], {
    input: stagedHtml,
    encoding: 'utf8',
  }).trim();
  git('update-index', '--add', '--cacheinfo', `100644,${blob},${OUT}`);
  console.log(`[pre-commit] index.html rebuilt from portfolio.mrbl and staged`);
}

// And keep the file on disk in step with the file on disk.
const worktreeDoc = fs.readFileSync(path.join(root, DOC), 'utf8');
const worktreeHtml = worktreeDoc === stagedDoc ? stagedHtml : build(worktreeDoc);
const onDisk = path.join(root, OUT);
if (!fs.existsSync(onDisk) || fs.readFileSync(onDisk, 'utf8') !== worktreeHtml) {
  fs.writeFileSync(onDisk, worktreeHtml);
  if (worktreeDoc !== stagedDoc) {
    console.log('[pre-commit] note: portfolio.mrbl has unstaged changes, so the index.html left');
    console.log('[pre-commit]       in your working tree is ahead of the one being committed.');
  }
}
