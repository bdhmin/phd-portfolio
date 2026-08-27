#!/usr/bin/env node
/**
 * Stamps today's date into the portfolio's footer.
 *
 *   node scripts/update-last-updated.mjs           # just rewrite the file
 *   node scripts/update-last-updated.mjs --stage   # ...and stage that one change
 *
 * --stage patches the *staged* copy of the document directly (via a fresh blob and
 * update-index) rather than `git add`-ing the file, so a commit never sweeps in
 * unrelated edits you were still working on. Set SKIP_LAST_UPDATED=1 to opt out.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOC = 'portfolio.mrbl';
const MARBLE_ID = 'foot-t';
const LABEL = 'Last Updated: ';

const args = new Set(process.argv.slice(2));
const stage = args.has('--stage');
const quiet = args.has('--quiet');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const say = (m) => { if (!quiet) console.log(m); };

// "August 27, 2026" — the format the footer already uses.
const today = new Date().toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric',
});

// Scoped to the one addressed span, so nothing else in the document can match.
const SPAN = new RegExp(
  `(<span[^>]*data-marble-id="${MARBLE_ID}"[^>]*>)${LABEL}[^<]*(</span>)`,
);

function stamp(html, where) {
  if (!SPAN.test(html)) {
    throw new Error(
      `no <span data-marble-id="${MARBLE_ID}"> containing "${LABEL}…" in ${where}. ` +
      `If the footer moved, update MARBLE_ID in scripts/update-last-updated.mjs.`,
    );
  }
  return html.replace(SPAN, `$1${LABEL}${today}$2`);
}

const root = git('rev-parse', '--show-toplevel');
const path = join(root, DOC);

// Working tree.
const before = readFileSync(path, 'utf8');
const after = stamp(before, DOC);
if (after !== before) {
  writeFileSync(path, after);
  say(`${DOC}: Last Updated → ${today}`);
} else {
  say(`${DOC}: already ${today}`);
}

if (!stage) process.exit(0);

// Staged copy. Patch the blob in the index directly — never `git add` the whole file.
const entry = git('ls-files', '-s', '--', DOC).match(/^(\d{6}) ([0-9a-f]{40})/);
if (!entry) {
  say(`${DOC} is not tracked; nothing staged.`);
  process.exit(0);
}
const [, mode, sha] = entry;

const staged = execFileSync('git', ['cat-file', 'blob', sha], {
  maxBuffer: 1 << 28,
}).toString('utf8');
const restaged = stamp(staged, `${DOC} (staged)`);
if (restaged === staged) process.exit(0);

const blob = execFileSync('git', ['hash-object', '-w', '--path', DOC, '--stdin'], {
  input: restaged, encoding: 'utf8',
}).trim();
git('update-index', '--cacheinfo', `${mode},${blob},${DOC}`);
say(`staged ${DOC} footer for this commit.`);
