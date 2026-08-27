# phd-portfolio

Bryan Min's site. It is one file.

```
portfolio.mrbl     the site — markup, style, behaviour, and content
public/            the things a single file cannot hold: images, PDFs, favicon
dev.mjs            local host: public/ in front, the Marble host behind it
build.mjs          publishing, which is a copy
```

`portfolio.mrbl` is valid HTML5 and is its own source. Opened with no host it is
the site; opened with the Marble host it is the site *and* its editor — drag a
paper to reorder it, click a title and type, and the bytes on disk change. There
is no build step, no state layer, and no save button.

## Working on it

```bash
npm install
npm run dev      # http://localhost:4321/a/portfolio
```

Two servers, one origin. `marble serve` answers for the document and returns 404
for everything else on purpose, so `dev.mjs` puts `public/` in front of it and
forwards the rest. That way `/thumbnails/meridian.png` means the same thing here
as it does in production.

Edit the page in the browser, or edit `portfolio.mrbl` in an editor, or ask an
agent to — all three write the same file, and an open tab reconciles by node id
without losing your scroll or caret.

```bash
npm run doctor       # check the invariants that keep the file addressable
npm run outline      # the shape of the file, for handing to an agent
npm run rollback     # every write is snapshotted while the host runs
```

## Publishing

```bash
npm run build        # dist/ = public/ + portfolio.mrbl as index.html
```

Vercel is configured to run exactly that (`vercel.json`). Nothing about the
deployed site is Marble-aware: `window.marble` never arrives, every affordance
quietly does nothing, and visitors get a static page.

## What is where in the document

| | |
|---|---|
| `<style>` in the head | the whole design, ported from the Tailwind build this replaced |
| `#about` | portrait, links, and the about text |
| `<marble-alt data-marble-id="statement">` | the about text — one block per draft, three drafts, one attribute saying which shows |
| `<marble-alt data-marble-id="notice">` | research opportunities / news, switched off until one of them is true |
| `#publications` | two lists sharing the sortable group `papers`, so a paper drags between them |
| `<template id="tpl-paper">` | what the `+ paper` buttons clone |
| `<script data-marble-id="richwire">` | the bio's rich block editor, link colours, and portrait picker |
| `<template id="tpl-portraits">` | the portraits the gallery offers — add a line to offer another |
| `<script>` at the end | the affordances — a copy of Marble's template, not a dependency |

## Editing the bio

Blocks carry `data-marble-rich` rather than `data-marble-editable`, because the
two file different ops. `data-marble-editable` files `setText`, whose premise is
that the text *is* the element; a paragraph holding `<b>` and a link is not that,
so a rich block files `setInner` instead. It matters for undo more than for
typing: a `setText`'s inverse is another `setText` and cannot bring emphasis
back, while a `setInner`'s inverse carries the previous markup and can.

Select text and a small bar appears — bold, italic, underline, link, unlink.
Enter starts a new block, Backspace in an empty one removes it.

The about text is the exception, and the reason `data-marble-flow` exists. It is
one block holding the whole passage rather than a paragraph per block, so Enter
inside it starts a paragraph of that same block and the gaps you read are its own
`<p>`s. One op names the passage, which is what lets an undo bring a rewrite back
whole instead of a sentence at a time. Emptying a flow block does not delete it —
there is nothing else there to fall back to.

An inline mark inside a rich block carries no `data-marble-id`, and neither does a
paragraph inside a flow block. The block is the piece an op names, the same way an
`<svg>` is addressable and its paths are not.

## Versions, and whether they show

A `<marble-alt>` answers two questions and keeps them apart. *Which* version is
written is `data-marble-active`, and the `v1 v2 v3` switch on its widget sets it.
*Whether the block is on the page at all* is `data-marble-hidden`, and the eye to
the left of the versions turns it on and off. Both are attributes of the file, so
a hand edit, an agent, and a click all mean the same thing.

The old file said "off" by giving the alt an empty candidate to switch to, which
made a draft out of the absence of one and left `+` and `×` acting on it. The eye
replaces that: the CV link and the notice are both written out in full and simply
switched off.

A hidden block is gone from the published page and still here in the editor,
ghosted, so it stays readable and editable while it waits. That is
`data-marble-peek` — declared `marble.pageOnly`, so it never reaches the file and
a visitor gets the nothing the file says.

A link's hover colour is two facts, one per colour scheme. The colours this site
uses more than once are classes (`.tag-ucsd`, `.tag-lab`, …) so the value lives in
one place; a colour picked in the editor is inline on the single link it is true
of. Both are read the same way by `.tag:hover`.

The portrait has a gallery and an upload. The gallery reads
`<template id="tpl-portraits">` — a document cannot read a folder, so the list of
portraits is in the file. An upload has nowhere to go but into the file, so it is
resized to 720px and lands as a data URI in the `src`; expect ~50–80KB per photo.
