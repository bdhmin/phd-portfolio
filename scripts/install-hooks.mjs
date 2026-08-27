// `npm install` runs this (the "prepare" script). It points git at .githooks,
// which is in the repository — so the hooks arrive with a clone rather than
// having to be remembered, and changing one is a commit like any other.
//
// It is deliberately quiet and never fails the install: a repository you cannot
// npm-install is worse than one whose hooks are not wired yet.

import { execFileSync } from 'node:child_process';

const git = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts });

try {
  if (git(['config', '--get', 'core.hooksPath']).trim() === '.githooks') process.exit(0);
} catch {
  // unset, or not a git checkout — try to set it and find out which
}

try {
  git(['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  console.log('git hooks installed (core.hooksPath -> .githooks)');
} catch {
  console.log('not a git checkout — skipping hook install');
}
