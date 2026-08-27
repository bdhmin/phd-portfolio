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
| `#about` | portrait, links, bio |
| `<marble-alt data-marble-id="statement">` | three drafts of the research statement; one attribute says which shows |
| `<marble-alt data-marble-id="notice">` | nothing / research opportunities / news |
| `#publications` | two lists sharing the sortable group `papers`, so a paper drags between them |
| `<template id="tpl-paper">` | what `+` beside a heading clones — `tpl-author`, `tpl-res`, `tpl-link` beside it |
| `<template id="tpl-thumbnails">` | the thumbnails a paper's image picker offers — add a line to offer another |
| `<script data-marble-id="richwire">` | the bio's rich block editor, link colours, and the image slots |
| `<template id="tpl-portraits">` | the portraits the gallery offers — add a line to offer another |
| `<script>` at the end | the affordances — a copy of Marble's template, not a dependency |

## Editing publications

Everything a paper is made of is its own element, so everything is separately
editable, draggable and deletable. Hover anything and its controls appear in the
margin beside it.

| | |
|---|---|
| `+` beside **Publications** | adds a paper **at the top of the list**, and drops you in the venue field |
| the thumbnail | hover it for a shelf of `public/thumbnails` and an upload, plus the alt text |
| an author | `⠿` to reorder, `○` to mark which name is yours, `×` to drop it |
| `+` beside the author row | adds a name at the end |
| a link (DOI, Paper, Video…) | click the text to retitle it, the chain button to set where it goes |
| `+` beside the link row | adds a link at the end |

None of those controls are in the file. A `+ paper` button written into the
markup is a button on the published site — there is no carrier there and nothing
for it to do — so an adder hangs off whatever heads the list instead:
`data-marble-add="#tpl-paper" data-marble-into="#stack-pubs" data-marble-at="start"`
on the `<h2>` says what to clone, where to put it, and which end. A visitor's
page is this file exactly, and it holds no editor.

Two things follow the same rule and are worth naming. An author list is a list
rather than a sentence, so the commas are not in the text — `flex` supplies the
space and `::after` the comma, and a reorder can never strand punctuation.
And which author is you is `class="author me"` on that author, toggled by `○`;
the op writes only the file's half of the class attribute, because the other
half is chrome the page derives.

An image slot is `data-marble-image` plus a `data-marble-gallery` naming the
shelf it offers — `#tpl-portraits` for the portrait, `#tpl-thumbnails` for a
paper. A document cannot read a folder, so a new thumbnail is a file in
`public/thumbnails` and a line in that template. Uploading works too, but an
upload has nowhere to go except into the file (see below), which is fine once
and expensive eleven times.

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

The portrait is an image slot like a paper's thumbnail, and reads
`<template id="tpl-portraits">`. An upload has nowhere to go but into the file,
so it is resized on the way in — to `data-marble-edge` pixels on its longest side,
720 for the portrait and 800 for a thumbnail — and lands as a data URI in the
`src`; expect ~50–80KB per photo.
