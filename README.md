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

## The "Last Updated" line

The footer's date is stamped by a `pre-commit` hook, so it always reads the day
the site last changed rather than the day someone last remembered to edit it.

```bash
npm install                   # also runs `git config core.hooksPath .githooks`
npm run date                  # stamp it by hand, without committing
SKIP_LAST_UPDATED=1 git commit -m …   # commit without touching it
```

The hook patches the *staged* copy of `portfolio.mrbl` directly rather than
`git add`-ing the file, so a commit of something else never sweeps in whatever
you had half-written in the document. The change it makes is one line — the
same edit a `setText` on `foot-t` would produce. If the footer ever moves, the
`MARBLE_ID` at the top of `scripts/update-last-updated.mjs` is what to change.

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
| `#about` | portrait, links, bio |
| `<marble-alt data-marble-id="statement">` | three drafts of the research statement; one attribute says which shows |
| `<marble-alt data-marble-id="notice">` | nothing / research opportunities / news |
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

An inline mark inside a rich block carries no `data-marble-id`. The block is the
piece an op names, the same way an `<svg>` is addressable and its paths are not.

A link's hover colour is two facts, one per colour scheme. The colours this site
uses more than once are classes (`.tag-ucsd`, `.tag-lab`, …) so the value lives in
one place; a colour picked in the editor is inline on the single link it is true
of. Both are read the same way by `.tag:hover`.

The portrait has a gallery and an upload. The gallery reads
`<template id="tpl-portraits">` — a document cannot read a folder, so the list of
portraits is in the file. An upload has nowhere to go but into the file, so it is
resized to 720px and lands as a data URI in the `src`; expect ~50–80KB per photo.
