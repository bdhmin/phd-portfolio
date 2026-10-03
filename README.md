# phd-portfolio

Bryan Min's site. It is one file.

```
portfolio.mrbl     the site — markup, style, behaviour, and content
index.html         the same bytes under the extension a web server serves
public/            the things a single file cannot hold: images, PDFs, favicon
dev.mjs            local host: public/ in front, the Marble host behind it
scripts/           the copy, its tests, and the git hooks that run it
build.mjs          publishing: dist/ = public/ + index.html
```

`portfolio.mrbl` is valid HTML5 and is its own source. Opened with no host it is
the site; opened with the Marble host it is the site *and* its editor — drag a
paper to reorder it, click a title and type, and the bytes on disk change. There
is no build step, no state layer, and no save button.

## Working on it

```bash
npm install
npm run dev
```

| | |
|---|---|
| `localhost:4380/a/portfolio` | the document **with** a carrier — editable |
| `localhost:4380/html` | the document **with no** carrier — what a visitor gets |
| `localhost:4380/html/source` | the same bytes as text, for reading and diffing |

The second one is the published page, live: `index.html` is rewritten from
`portfolio.mrbl` on every save — and on every op the host writes while you edit
in the first one — and the preview reloads itself. Nothing is converted between
the two tabs; they are one file served from two origins, and the second is quiet
for the same reason the deployed site is (see *Publishing*). The reload snippet
is added to that response and never to the file on disk, so `/html/source` and
`portfolio.mrbl` stay byte-identical — which is the thing the preview exists to
let you check.

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

`index.html` **is** `portfolio.mrbl` — the same bytes, under the extension a web
server knows how to serve. Not a conversion, not a build.

```bash
npm run html         # portfolio.mrbl -> index.html (a copy)
npm run build        # dist/ = public/ + index.html   (what Vercel runs)
npm test             # check the conditions that make the copy safe
```

This works because the .mrbl is valid HTML5 and every affordance in it is gated
on `window.marble`. A visitor's browser has no carrier to inject one, so it
parses the editor machinery and runs none of it: no drag handles, no `+`
buttons, no contenteditable. The page a visitor gets is the page the document
describes, and there is no second artifact that can disagree with it.

There used to be a subtraction step here, and the reason it existed is worth
recording: the `+ paper` and `+ link` adders were once static markup with no
rule hiding them, so they rendered on the live site and did nothing when
clicked. Something had to cut them out. Once the adder became injected chrome —
built by a gated script, marked `data-marble-transient` — there was nothing left
that a carrier-less browser would show, and the whole step was subtraction for
its own sake. It also had teeth: the converter cut any element carrying
`data-marble-add`, which stopped meaning "a button" and started meaning "the
heading a button hangs off", and it silently took the Publications heading, the
social links and every paper's resource row off the site.

So `scripts/publish.test.mjs` checks the conditions the copy rests on rather
than a diff: every `<script>` in the document is gated on `if (window.marble)`
and none is external, no `<button>` is written into the markup that isn't
transient chrome, every `/…` asset the document names exists in `public/`, and
`index.html` is byte-for-byte the `.mrbl`. A script added later that forgets the
gate fails there instead of on the live site.

The cost is that a visitor downloads ~170 KB instead of the ~28 KB the
subtraction produced — the affordance scripts and templates come along, inert.
That is the trade: one file, no derivation, nothing that can drift.

### Keeping them together

`index.html` is committed, so the repository always shows what is deployed. Two
hooks in `.githooks/` keep that true; `npm install` points git at them.

| | |
|---|---|
| `pre-commit` | restages `index.html` as a copy of the **staged** `portfolio.mrbl` |
| `pre-push` | refuses a push whose commit's `index.html` is not its `.mrbl` |

Identical bytes are the identical git blob, so both hooks are object-id
comparisons — nothing is read, hashed or written on a 170 KB document.

`pre-commit` can be skipped with `--no-verify`, and does not run for merge
commits; `pre-push` is the backstop. If it stops you:

```bash
npm run html && git add index.html && git commit --amend --no-edit
```

Vercel does not trust the committed copy — `build.mjs` writes `dist/index.html`
from `portfolio.mrbl` at deploy time, because a copy in the repository can be
stale and the document cannot. The hooks are what keep the repository honest;
the build is what keeps the site right. Nothing is installed to do it: the build
imports only `node:fs` and `node:path`, so `npm ci --omit=dev` fetches nothing.

## What is where in the document

| | |
|---|---|
| `<style data-marble-id="sitecss">` | the whole design, ported from the Tailwind build this replaced |
| `#about` | portrait, links, bio |
| `<marble-alt data-marble-id="statement">` | the drafts of the research statement; one attribute says which shows |
| `<marble-alt data-marble-id="notice">` | nothing / research opportunities / news |
| `#publications` | two lists sharing the sortable group `papers`, so a paper drags between them |
| `<template id="tpl-paper">` | the shape of a new paper, which the publication sheet fills in — `tpl-author`, `tpl-res`, `tpl-link` beside it |
| `<template id="tpl-thumbnails">` | the thumbnails a paper's image picker offers — add a line to offer another |
| `<script data-marble-id="richwire">` | the bio's rich block editor, link colours, and the image slots |
| `<template id="tpl-portraits">` | the portraits the gallery offers — add a line to offer another |
| `<script data-marble-id="editwire">` | the editor: the control layer, dragging, adding, link addresses, versions, the publication card and its paper finder, and the notes (saved, removed, Undo) |
| `<script data-marble-id="stampwire">` | the footer date, written by whatever change made it stale |

## Editing publications

A paper is edited two ways, and both file the same ops.

**The card** is for a whole paper at once, and it opens where you asked for
it: **+ Add** beside a list's heading opens it under that button, the pencil
in a paper's rail opens it beside the paper, with a tail pointing back at what
opened it. It holds the list, venue, award, title, the authors as one
comma-separated field (click a name to bold it as yours), the links as label +
address rows, and the picture. A label like “DOI” with no address is flagged,
because it would print as plain text. A new paper goes to the top of its list;
an edit files only what changed, as one step for Mod+Z. Closing a card with
changes in it asks once.

**The finder** sits at the top of a new card (and behind “Look it up again”
in an edited one). Paste a title, a DOI or arXiv link, or a few words you
remember: it asks Crossref (for papers with your name on them), Semantic
Scholar and OpenAlex, puts your papers first, and marks any already on the
site. Picking one fills the card the way this page writes it — “UIST 2025”,
“arXiv (May 2026)”, a DOI link. **Ask an agent** hands the question to one of
the drive's agents, in a conversation called “Portfolio · Paper finder”, for
papers the indexes don't know. It is the CV's finder (`cv.mrbl`), adapted.

**In place** is for one word. Point at anything (or click into it) and its
controls appear beside it.

| | |
|---|---|
| a paper | a rail in the left margin: drag handle (between the two lists too), pencil for the sheet, bin to delete |
| the venue, title, award | click and type; an empty award shows “Add an award” while you point at the paper |
| the thumbnail | point at it for a shelf of `public/thumbnails` and an upload, plus the alt text |
| an author | a bar over the name: drag handle, **Me** to bold it as yours, bin to drop it |
| **+ Author** after the last name | adds a name at the end, text selected |
| a link (DOI, Paper, Video…) | click the text to retitle it; the bar over it has the drag handle, the link button for its address, the bin |
| **+ Link** after the last link | adds a link and asks for its address first; the label fills in from it |
| a contact link | the same bar, beside it; **+ Link** under the social links adds one there |

⌘⇧↑ / ⌘⇧↓ moves whatever you are typing in one place up or down: a paper from
its title, a name, a link, a bio paragraph. Pointing at a control outlines what
it will act on, red for a delete, and every delete says what it took in a note
at the bottom left, with **Undo**.

Things move rather than jump: controls ease in and glide between items, a
deleted item fades where it stood while its neighbours close the gap, the list
makes room as you drag, and switching versions crossfades. None of it is in
the file (Web Animations and `@starting-style`), and none of it runs for
someone whose system asks for reduced motion.

Inside Marble Drive the shell's header, sidebar and docked chat take part of
the window and say how much in `--marble-shell-top`, `--marble-shell-left` and
`--marble-dock-right`. The page lays itself out by `@container page` queries
on `.page`, so it answers to the width it actually has; the editor keeps its
controls, cards and notes inside that room. Published, the page is the whole
window and nothing changes: the same pixels as before.

The controls are drawn in one layer over the whole page (`.pf-layer`), not
inside the things they act on. Inside, each was a child of its item shown on
the item's `:hover`, which put it a few pixels outside the item's box (the
hover ended on the way there and the control vanished under the pointer) and
under whichever sibling came later in the document (the next link's handle
covered this link's delete). In the layer nothing covers them, and which item
they belong to follows the pointer's path: they stay while the pointer is
anywhere in the box that holds the item and its controls, and for a third of a
second after it leaves. On a touch screen a tap does the pointing.

None of those controls are in the file, and that is load-bearing: the published
site is this file, so a `+ paper` button written into the markup would be a
button a visitor sees and clicks to no effect. `data-paper-list="#stack-pubs"`
on a heading says which list it adds to; the **Add** button is built by the
gated script and marked `data-marble-transient`. A visitor's page is this file
exactly, and it holds no editor.

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
Enter starts a new block, Backspace in an empty one removes it. A paste arrives
as plain text: `setInner` files markup verbatim, so the styling a sentence
carries out of a browser or a Google Doc would land in the file, and the marks
this document wants are the five on that bar.

An inline mark inside a rich block carries no `data-marble-id`. The block is the
piece an op names, the same way an `<svg>` is addressable and its paths are not.
The block itself must have one, though — `setInner` names its target, so a rich
block with no id takes typing and files nothing, silently. That is what
`[data-marble-rich]` in the affordance script's `addressable` list is for, and
why an unnamed block warns in the console when it is wired.

## Versions

The research statement, the notice below it and the CV link are
`<marble-alt>`: every draft is in the file and `data-marble-active` says which
one shows. Point at the block (or put the cursor in it) and a bar appears under it
with the block's name and its versions — click one to show it, `+` to add a copy
of the one showing, and the list button to see every version at once with what
it says. In that list you can rename a version, jump into it to edit, or delete
it (with Undo); reading a draft there does not switch the live page.

A block whose showing version is the empty one (the notice and the CV link are
hidden right now) has no box to hover, so while editing it shows a dashed line
saying what is hidden there.

Names are attributes: `data-label` on the `<marble-alt>` names the block
(“Research statement”), and `data-label` on a version names that version
(“News”). A version with no label is called by its `v1`…`v12`. The Drive's own
version pill is hidden on this page, because the bar is the same control.

Which version *displays* is the stylesheet, pairing each name against
`data-marble-active` by hand — a selector cannot compare a child's attribute
against its parent's. So the names are a finite list, twelve of them, and `+`
stops there rather than minting a `v13` that renders as nothing on the
published page. Deleting a version frees its name for the next one.

A link's hover colour is two facts, one per colour scheme. The colours this site
uses more than once are classes (`.tag-ucsd`, `.tag-lab`, …) so the value lives in
one place; a colour picked in the editor is inline on the single link it is true
of. Both are read the same way by `.tag:hover`.

The portrait is an image slot like a paper's thumbnail, and reads
`<template id="tpl-portraits">`. An upload has nowhere to go but into the file,
so it is resized on the way in — to `data-marble-edge` pixels on its longest side,
720 for the portrait and 800 for a thumbnail — and lands as a data URI in the
`src`; expect ~50–80KB per photo.

## The footer date

`Last Updated:` is typed and the date beside it is not. `stampwire` writes
`foot-d` to today whenever the carrier records a change — which is every gesture
in the document and no piece of bookkeeping, so opening the editor does not
count as editing. It writes only when the date is not already today, which is
also what stops it from answering its own write.

Nothing derives the date at build time. A document cannot read a commit or an
mtime, and a build that could would be a second copy of a fact the page already
holds. The consequence to know: a change typed straight into `portfolio.mrbl`
files no op, so it does not move the date — edit the sentence in the browser, or
edit the date by hand along with it.
