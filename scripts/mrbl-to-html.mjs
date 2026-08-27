// portfolio.mrbl -> index.html
//
// The .mrbl is already valid HTML5, so "converting" it is not a compile. What it
// is, is a subtraction: the document carries the machinery that makes it
// editable — the affordance scripts, the ids ops address nodes by, the `+ paper`
// buttons — and a visitor has no host to talk to, so none of that is anything
// but weight. Two of those are worse than weight. The `+ paper` and `+ link`
// buttons are static markup with no rule hiding them, so on the deployed site
// they render, and clicking them does nothing.
//
// The edit is done against source offsets rather than by re-serializing the
// parse tree. A serializer would rewrite the whole file — attribute quoting,
// entity escaping, the SVG paths that appear twenty times — and every one of
// those rewrites is a chance to change what the page looks like for no reason.
// Cutting byte ranges out of the original string cannot: every byte not named
// below is the byte it was.

import { parse } from 'parse5';

// Attributes the editor reads and a browser does not. data-marble-alt and
// data-marble-active are deliberately absent: the document's own <style> selects
// on both to decide which alternative shows, so they are content, not machinery.
export const EDITOR_ATTRS = new Set([
  'data-marble',
  'data-marble-id',
  'data-marble-editable',
  'data-marble-rich',
  'data-marble-removable',
  'data-marble-sortable',
  'data-marble-add',
  'data-marble-into',
  'data-marble-instruction',
  'data-marble-portrait',
  'data-marble-transient',
]);

// Both affordance scripts end in this line, and it is the honest test for "does
// this run for a visitor": no carrier, no call. Naming the behaviour rather than
// the ids means a third script added later is handled without editing a list.
const GATED_ON_CARRIER = /if\s*\(\s*window\.marble\s*\)/;

const attr = (node, name) => node.attrs?.find((a) => a.name === name);

function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
  // A <template>'s children live under .content, not childNodes.
  for (const child of node.content?.childNodes ?? []) yield* walk(child);
}

export function toHtml(source) {
  const doc = parse(source, { sourceCodeLocationInfo: true });

  const cuts = [];
  const counts = { scripts: 0, templates: 0, adders: 0, meta: 0, comments: 0, attrs: 0 };

  // A cut that is alone on its line takes the line with it, rather than leaving
  // the indentation behind as a blank one. Only whole elements are offered this;
  // an attribute is never alone on a line.
  const wholeLine = (start, end) => {
    let from = start;
    while (from > 0 && source[from - 1] !== '\n' && /\s/.test(source[from - 1])) from -= 1;
    if (from > 0 && source[from - 1] !== '\n') return { start, end };
    let to = end;
    while (to < source.length && source[to] !== '\n' && /\s/.test(source[to])) to += 1;
    if (source[to] !== '\n') return { start, end };
    return { start: from, end: to + 1 };
  };

  const cutNode = (node) => {
    const loc = node.sourceCodeLocation;
    if (!loc) throw new Error(`no source location for <${node.tagName ?? node.nodeName}>`);
    cuts.push(wholeLine(loc.startOffset, loc.endOffset));
  };

  for (const node of walk(doc)) {
    // Every markup comment in this document is a note to whoever edits the
    // .mrbl — which alternative to switch to, what the gallery reads. None of
    // them is addressed to a visitor, and the .mrbl is where they stay.
    if (node.nodeName === '#comment') {
      cutNode(node);
      counts.comments += 1;
      continue;
    }
    if (!node.tagName) continue;

    if (node.tagName === 'script' && GATED_ON_CARRIER.test(node.childNodes?.[0]?.value ?? '')) {
      cutNode(node);
      counts.scripts += 1;
      continue;
    }

    // The templates exist to be cloned by the adders and by the portrait
    // gallery. Every caller is inside the scripts just cut.
    if (node.tagName === 'template') {
      cutNode(node);
      counts.templates += 1;
      continue;
    }

    // The adders: markup rather than injected chrome, which is why they leak.
    if (attr(node, 'data-marble-add')) {
      cutNode(node);
      counts.adders += 1;
      continue;
    }

    // A capability grant is addressed to a host. There is no host.
    if (node.tagName === 'meta' && attr(node, 'name')?.value === 'marble:capabilities') {
      cutNode(node);
      counts.meta += 1;
      continue;
    }

    for (const a of node.attrs ?? []) {
      if (!EDITOR_ATTRS.has(a.name)) continue;
      const loc = node.sourceCodeLocation?.attrs?.[a.name];
      if (!loc) throw new Error(`no source location for ${a.name} on <${node.tagName}>`);
      // Take the whitespace in front of the attribute with it, so a tag that
      // loses all of them closes as `<div>` and not `<div   >`.
      let start = loc.startOffset;
      while (start > 0 && /\s/.test(source[start - 1])) start -= 1;
      cuts.push({ start, end: loc.endOffset });
      counts.attrs += 1;
    }
  }

  // An attribute inside a node that is itself being cut is already covered by
  // the node's range, and two cuts can meet in the whitespace between them.
  // Merge into disjoint ranges, then splice back to front so the offsets ahead
  // of each one stay valid.
  cuts.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const cut of cuts) {
    const last = merged[merged.length - 1];
    if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
    else merged.push({ ...cut });
  }

  let out = source;
  for (const cut of [...merged].reverse()) out = out.slice(0, cut.start) + out.slice(cut.end);

  // Where a removed block sat between two blank lines, the two are now adjacent.
  out = out.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');

  out = out.replace(
    /^(<!doctype html>\n)/i,
    `$1<!-- Generated from portfolio.mrbl by scripts/mrbl-to-html.mjs. Do not edit by hand. -->\n`,
  );

  return { html: out, counts };
}

// Text a visitor could see, in order, with the parts a browser never shows
// removed. Used to check the conversion rather than trust it.
function visibleText(input) {
  const SKIP = new Set(['script', 'style', 'template']);
  const parts = [];
  const visit = (node) => {
    if (SKIP.has(node.tagName)) return;
    if (node.nodeName === '#text') parts.push(node.value);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(input));
  return parts.join('').replace(/\s+/g, ' ').trim();
}

// A conversion that only ever subtracts can be checked: everything a visitor
// could read before is still there, in the same order, and nothing that speaks
// to a host survived.
export function verify(source, html) {
  // The adders are the one visible thing intentionally removed.
  const before = visibleText(source).replace(/\+ paper|\+ link/g, '').replace(/\s+/g, ' ').trim();
  const after = visibleText(html);

  if (before !== after) {
    const at = [...before].findIndex((c, i) => c !== after[i]);
    const window_ = (s) => JSON.stringify(s.slice(Math.max(0, at - 50), at + 50));
    throw new Error(
      `conversion changed visible text at offset ${at}\n` +
        `  .mrbl  ${window_(before)}\n` +
        `  .html  ${window_(after)}`,
    );
  }

  const leaked = [...EDITOR_ATTRS].filter((name) => new RegExp(`\\s${name}[\\s=>]`).test(html));
  if (leaked.length) throw new Error(`editor attributes survived: ${leaked.join(', ')}`);
  if (/window\.marble/.test(html)) throw new Error('a carrier reference survived');
  if (!/^<!doctype html>/i.test(html)) throw new Error('the doctype did not survive');
}
