// node --test scripts/publish.test.mjs
//
// index.html is portfolio.mrbl under another extension, so "is the conversion
// right" is not a question any more. What replaces it is the condition that
// makes the copy safe: served to a browser with no Marble carrier, the document
// has to be a page you can read and not one that half-tries to be an editor.
// That is a property of the .mrbl itself, and it is what these check.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'parse5';

const ROOT = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'portfolio.mrbl'), 'utf8');

function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
  // A <template>'s children live under .content, not childNodes.
  for (const child of node.content?.childNodes ?? []) yield* walk(child);
}

const doc = parse(source);

test('index.html on disk is portfolio.mrbl, byte for byte', () => {
  const onDisk = path.join(ROOT, 'index.html');
  assert.ok(fs.existsSync(onDisk), 'index.html is missing — run `npm run html`');
  assert.equal(fs.readFileSync(onDisk, 'utf8'), source, 'index.html is stale — run `npm run html`');
});

test('the document is a page before it is anything else', () => {
  assert.match(source, /^<!doctype html>/i);
});

test('no script does anything without a carrier', () => {
  // The honest test for "does this run for a visitor" is behavioural, not a
  // list of script ids: whatever a script does, it has to be behind the check
  // for a carrier the deployed page will never have. A script added later that
  // forgets the gate fails here rather than on the live site.
  const scripts = [...walk(doc)].filter((n) => n.tagName === 'script');
  assert.ok(scripts.length > 0, 'no scripts found — did the document move?');
  for (const script of scripts) {
    const body = script.childNodes?.[0]?.value ?? '';
    const src = script.attrs?.find((a) => a.name === 'src')?.value;
    assert.equal(src, undefined, `<script src="${src}"> runs unconditionally for a visitor`);
    assert.match(
      body,
      /if\s*\(\s*window\.marble\s*\)/,
      'a script is not gated on `if (window.marble)`, so it would run on the published page',
    );
  }
});

test('nothing a visitor can click is markup', () => {
  // The adders and drag handles are injected chrome, built by the affordance
  // scripts and marked transient. A button written into the file would render
  // on the published site with no carrier behind it and do nothing when
  // clicked — the failure that made a whole conversion step seem necessary.
  const chrome = [...walk(doc)].filter(
    (n) =>
      n.tagName === 'button' &&
      !n.attrs?.some((a) => a.name === 'data-marble-transient'),
  );
  assert.deepEqual(chrome, [], 'a <button> is written into the document');
});

test('every asset path the document asks for still resolves', () => {
  const refs = [...source.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 10, `expected asset references, found ${refs.length}`);
  for (const ref of new Set(refs)) {
    const file = path.join(ROOT, 'public', decodeURIComponent(ref));
    assert.ok(fs.existsSync(file), `public${ref} is referenced but not on disk`);
  }
});
