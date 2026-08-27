// node --test scripts/mrbl-to-html.test.mjs
//
// The conversion only subtracts, and what it subtracts is a closed list. That
// makes it checkable against the real document rather than against a fixture:
// everything not on the list has to come through untouched.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'parse5';
import { EDITOR_ATTRS, toHtml, verify } from './mrbl-to-html.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'portfolio.mrbl'), 'utf8');
const { html } = toHtml(source);

// An element's shape as a visitor's browser resolves it: what it is, what it is
// styled as, and where it points. Editor attributes are excluded because
// removing them is the point.
function shape(input) {
  const out = [];
  const visit = (node, depth) => {
    if (node.tagName) {
      const skip =
        node.tagName === 'script' ||
        node.tagName === 'template' ||
        (node.tagName === 'meta' && node.attrs?.some((a) => a.value === 'marble:capabilities'));
      if (skip) return;
      const attrs = (node.attrs ?? [])
        .filter((a) => !EDITOR_ATTRS.has(a.name))
        .map((a) => `${a.name}=${a.value}`)
        .sort()
        .join(' ');
      out.push(`${'  '.repeat(depth)}${node.tagName} ${attrs}`);
    }
    for (const child of node.childNodes ?? []) visit(child, depth + 1);
  };
  visit(parse(input), 0);
  return out;
}

test('verify passes on the real document', () => {
  verify(source, html);
});

test('the element tree is unchanged apart from the removals', () => {
  const before = shape(source);
  const after = shape(html);
  const at = before.findIndex((line, i) => line !== after[i]);
  assert.equal(
    at,
    -1,
    at === -1 ? '' : `first difference at element ${at}:\n  .mrbl  ${before[at]}\n  .html  ${after[at]}`,
  );
  assert.equal(before.length, after.length);
});

test('content that carries an adder marker survives', () => {
  // data-marble-add used to sit on a static "+" button, and the button was
  // removed by cutting the element that carried it. It marks real content now —
  // the heading a paper is added under, the list a co-author joins — so the
  // element stays and only the attribute goes. Checked over the parse tree
  // because the affordance script quotes the markup in a comment.
  const carriers = (input) => {
    const out = [];
    const visit = (node) => {
      if (node.tagName === 'script' || node.tagName === 'template') return;
      if (node.attrs?.some((a) => a.name === 'data-marble-add')) out.push(node.tagName);
      for (const child of node.childNodes ?? []) visit(child);
    };
    visit(parse(input));
    return out;
  };
  const marked = carriers(source);
  assert.ok(marked.length > 0, 'no adder markers in the .mrbl');
  assert.deepEqual(carriers(html), [], 'the marker survived the conversion');

  // The two the failure was visible in: the social links and the list heading.
  assert.match(html, /Google Scholar/);
  assert.match(html, /<h2[^>]*>Publications<\/h2>/);
});

test('the style block survives byte for byte', () => {
  const style = (input) => input.slice(input.indexOf('<style>'), input.indexOf('</style>'));
  assert.equal(style(html), style(source));
});

test('the alternatives keep the attributes their CSS selects on', () => {
  // marble-alt is the one piece of machinery that is also content: no script
  // reads these, the document's own <style> does. Counted against the .mrbl
  // rather than against a number, so adding an alternative does not fail here,
  // and counted over the parse tree rather than the text, because the affordance
  // script this removes carries a <marble-alt> in a comment.
  const census = (input) => {
    const seen = { alt: 0, active: 0, element: 0 };
    const visit = (node) => {
      if (node.tagName === 'script' || node.tagName === 'template') return;
      if (node.tagName === 'marble-alt') seen.element += 1;
      for (const a of node.attrs ?? []) {
        if (a.name === 'data-marble-alt') seen.alt += 1;
        if (a.name === 'data-marble-active') seen.active += 1;
      }
      for (const child of node.childNodes ?? []) visit(child);
    };
    visit(parse(input));
    return seen;
  };
  const before = census(source);
  assert.ok(before.element > 0 && before.alt > 0 && before.active > 0, 'no alternatives in .mrbl');
  assert.deepEqual(census(html), before);

  // The <style> selects on them by name, so a rename would have to happen in
  // both places or the page silently shows every candidate at once.
  assert.match(html, /marble-alt\s*>\s*\[data-marble-alt\]\s*\{\s*display:\s*none/);
});

test('nothing addressed to a host survives', () => {
  assert.doesNotMatch(html, /window\.marble/);
  assert.doesNotMatch(html, /marble:capabilities/);
  assert.doesNotMatch(
    html,
    /data-marble-(id|editable|rich|removable|sortable|add|into|at|instruction|href|flag|image|gallery|edge)=/,
  );
  assert.doesNotMatch(html, /<template/);
  assert.doesNotMatch(html, /<script/);
});

test('every asset path the document asks for still resolves', () => {
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 10, `expected asset references, found ${refs.length}`);
  for (const ref of new Set(refs)) {
    const file = path.join(ROOT, 'public', decodeURIComponent(ref));
    assert.ok(fs.existsSync(file), `public${ref} is referenced but not on disk`);
  }
});

test('index.html on disk is what the converter produces', () => {
  const onDisk = path.join(ROOT, 'index.html');
  assert.ok(fs.existsSync(onDisk), 'index.html is missing — run `npm run html`');
  assert.equal(fs.readFileSync(onDisk, 'utf8'), html, 'index.html is stale — run `npm run html`');
});
