// The editor for this site.
//
// Everything a hand can do to the page while a carrier is present, and none of
// it for a visitor: with no carrier this script does nothing, and the page is
// the page the file describes.
//
// The controls live in one layer drawn over the whole page, not inside the
// things they act on. Inside, they were children of their item and appeared on
// the item's :hover — which put every one of them a few pixels outside the box
// it belonged to (so the hover ended on the way there and the control vanished
// under the pointer), and under whichever sibling came later in the document
// (so the next link's handle covered this link's delete). In one layer above
// everything, nothing covers them; and because which item they belong to is
// decided by the pointer's path rather than by :hover, they wait while the
// pointer travels to them.
//
// What the controls file is the ordinary vocabulary — setText, setAttr, insert,
// move, remove — with the inverse recorded, so Mod+Z takes any of it back.
(() => {
  const begin = (marble) => {
    const TRANSIENT = 'data-marble-transient';
    const ID = 'data-marble-id';
    const ALT = 'data-marble-alt';
    const ACTIVE = 'data-marble-active';
    const LABEL = 'data-label';
    // The stylesheet pairs each version name against data-marble-active by
    // hand, so the names it knows are a finite list; see "alternatives" there.
    const VERSIONS = 12;

    // ------------------------------------------------------------ plumbing

    const isTransient = (el) => Boolean(el?.hasAttribute?.(TRANSIENT));
    const kids = (el) => [...el.children].filter((c) => !isTransient(c));
    function nextPersistentSibling(el) {
      let sibling = el.nextElementSibling;
      while (sibling && isTransient(sibling)) sibling = sibling.nextElementSibling;
      return sibling;
    }
    const roles = new WeakMap();
    function claim(el, role) {
      const held = roles.get(el) ?? new Set();
      if (held.has(role)) return false;
      held.add(role);
      roles.set(el, held);
      return true;
    }
    const within = (root, sel) => [...(root.matches?.(sel) ? [root] : []), ...(root.querySelectorAll?.(sel) ?? [])];
    const textOf = (el) => (el ? marble.text(el).replace(/\s+/g, ' ').trim() : '');
    const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
    const owned = (el) => [...el.classList].filter((c) => !c.startsWith('marble-')).join(' ');

    function chrome(tag, cls, html) {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      marble.transient(el);
      el.setAttribute('contenteditable', 'false');
      if (html !== undefined) el.innerHTML = html;
      return el;
    }

    // Several ops, one step: applied in order, filed, and recorded with their
    // inverses so a single Mod+Z takes the whole gesture back.
    function play(ops, { record = true } = {}) {
      const undo = [];
      for (const op of ops) {
        const inverse = marble.invert(op);
        if (inverse) undo.unshift(inverse);
        marble.apply(op);
        marble.op(op);
      }
      if (record && ops.length && undo.length) marble.record({ redo: ops, undo });
      marble.flush();
    }

    // Anything a hand can act on has to be addressable in the file first. The
    // image slots and rich blocks are wired by richwire, which runs after this
    // and relies on this one pass to have named them: a rich block with no id
    // takes typing and files nothing.
    const ADDRESSABLE = [
      '[data-marble-editable]', '[data-marble-removable]', '[data-marble-href]',
      '[data-marble-sortable]', '[data-marble-sortable] > *', '[data-marble-flag] > *',
      '[data-marble-add]', '[data-paper-list]', 'marble-alt', 'marble-alt > *',
      '[data-marble-image]', '[data-marble-image] img', '[data-marble-rich]',
    ].join(', ');

    // A subtree that isn't in the document yet can't be addressed by path, so
    // it carries its ids with it — they are serialized into the insert op.
    function assignIdsIn(root) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (isTransient(el) || marble.id(el)) continue;
        if (el === root || el.matches(ADDRESSABLE)) el.setAttribute(ID, marble.newId());
      }
    }
    // A new paper names every element, because every element of a paper is a
    // thing a hand reaches: the paper, its picture, each name, each link.
    function nameAll(root) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!marble.id(el)) el.setAttribute(ID, marble.newId());
      }
    }

    // Select what the person is meant to replace, and nothing else.
    function selectText(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    function caretToEnd(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }

    // ---------------------------------------------------------------- motion

    // Everything that appears, leaves or moves does it the same way: a short
    // ease-out in, a shorter ease-in out, and neighbours that glide to where a
    // move or a removal left them instead of jumping. Web Animations, so none
    // of it is a style attribute the file could pick up; and none of it at all
    // for someone who has asked their system for less motion.
    const EASE = 'cubic-bezier(.2, .8, .2, 1)';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    function motion(el, frames, opts = {}) {
      if (reduced.matches || !el?.animate) return null;
      return el.animate(frames, { duration: 170, easing: EASE, ...opts });
    }
    const enter = (el, from = 'translateY(4px) scale(.98)', opts = {}) =>
      motion(el, [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { fill: 'backwards', ...opts });
    function leave(el, done, to = 'scale(.98)') {
      const a = motion(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: to }], { duration: 110, easing: 'ease-in', fill: 'forwards' });
      if (!a) { done(); return null; }
      // Held at the end only until whatever it was hiding is gone; then let go,
      // or the next time this element is shown it is still at opacity 0.
      a.onfinish = () => {
        done();
        a.cancel();
      };
      return a;
    }
    // First, last, invert, play: measure, change, and animate each element
    // from where it was to where it is.
    function flip(els, mutate) {
      const before = new Map(els.filter(Boolean).map((el) => [el, el.getBoundingClientRect()]));
      mutate();
      if (reduced.matches) return;
      for (const [el, was] of before) {
        if (!el.isConnected) continue;
        for (const a of el.getAnimations()) if (a.id === 'flip') a.cancel();
        const now = el.getBoundingClientRect();
        const dx = was.left - now.left;
        const dy = was.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        const a = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: EASE });
        a.id = 'flip';
      }
    }

    // The part of the window the page actually has. The drive's header, its
    // sidebar and a docked chat take the rest, and say how much in custom
    // properties on <html>; with no shell they are absent and this is the
    // whole window.
    function room() {
      const css = getComputedStyle(document.documentElement);
      const px = (name) => parseFloat(css.getPropertyValue(name)) || 0;
      return {
        left: px('--marble-shell-left'),
        top: px('--marble-shell-top'),
        right: innerWidth - px('--marble-dock-right'),
        bottom: innerHeight,
      };
    }

    const svg = (body, size = 14) =>
      `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    const ICON = {
      grip: `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="6" cy="3.5" r="1.1"/><circle cx="10" cy="3.5" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12.5" r="1.1"/><circle cx="10" cy="12.5" r="1.1"/></svg>`,
      edit: svg('<path d="M10.5 2.8 13.2 5.5 5.6 13.1H2.9v-2.7z"/><path d="M9.2 4.1 11.9 6.8"/>'),
      trash: svg('<path d="M2.8 4.3h10.4M6.3 4.3V2.9h3.4v1.4M4.2 4.3l.6 8.7c0 .5.4.9.9.9h4.6c.5 0 .9-.4.9-.9l.6-8.7"/><path d="M6.8 6.8v4.6M9.2 6.8v4.6"/>'),
      link: svg('<path d="M6.6 9.4 9.4 6.6"/><path d="M8.6 5.3 9.9 4a2.3 2.3 0 0 1 3.2 3.2l-1.3 1.3"/><path d="M7.4 10.7 6.1 12A2.3 2.3 0 0 1 2.9 8.8l1.3-1.3"/>'),
      list: svg('<path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8"/><path d="M2.6 4.5h.2M2.6 8h.2M2.6 11.5h.2"/>', 13),
      close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
      plus: svg('<path d="M8 3.5v9M3.5 8h9"/>', 12),
      eyeOff: svg('<path d="M2.5 8s2-4 5.5-4c1 0 1.9.3 2.7.7M13.5 8s-.8 1.6-2.3 2.8M9.7 9.8A2.3 2.3 0 0 1 6.2 6.3"/><path d="M3 13 13 3"/>', 13),
      upload: svg('<path d="M8 10.5V3.5M5.2 6.2 8 3.5l2.8 2.7"/><path d="M3 10.5v1.7c0 .6.4 1 1 1h8c.6 0 1-.4 1-1v-1.7"/>', 13),
      open: svg('<path d="M9 3h4v4M13 3 7.5 8.5"/><path d="M11.5 9.5v3c0 .6-.4 1-1 1h-7c-.6 0-1-.4-1-1v-7c0-.6.4-1 1-1h3"/>', 13),
    };

    // ---------------------------------------------------------------- styling

    const style = document.createElement('style');
    marble.transient(style);
    style.textContent = `
      /* The Drive draws a version pill on every <marble-alt>. This page has its
         own versions control, so the pill would be a second switcher for the
         same choice, floating over the email address. */
      .marble-variations-pill { display: none !important; }

      .st-ui {
        --st-red: #b4544f;
        font: 400 12.5px/1.4 var(--sans, system-ui, sans-serif);
        color: var(--foreground, #171717);
        letter-spacing: 0;
      }
      .st-ui button { font: inherit; color: inherit; }
      .st-ui :focus-visible { outline: 1px solid var(--dim, #71717a); outline-offset: 1px; }

      /* ---- empty fields show what goes in them, while editing only */
      html.marble-studio [data-hint]:empty::before {
        content: attr(data-hint); color: var(--faint, #a1a1aa); font-weight: 400; pointer-events: none;
      }
      html.marble-studio .paper:hover .venue .award:empty,
      html.marble-studio .venue .award:focus { display: block; }
      html.marble-studio .venue .award:empty::before { font-style: italic; }

      .st-ib {
        width: 24px; height: 24px; padding: 0; border: 0; border-radius: 3px; background: none; flex: none;
        display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        color: var(--dim, #71717a);
      }
      .st-ib:hover:not(:disabled) { color: var(--foreground, #171717); background: rgba(127,127,127,.12); }
      .st-ib:disabled { opacity: .35; cursor: default; }

      /* A block whose shown version is the empty one has no box to hover, so
         while editing it gets a line that says what is hidden there. */
      .st-ghost {
        display: none; align-items: center; gap: 6px; min-height: 22px; padding: 0 6px;
        border: 1px dashed var(--rule, #e4e4e7); border-radius: 3px;
        color: var(--faint, #a1a1aa); font: italic 400 12px/1 var(--sans, system-ui, sans-serif); cursor: default;
      }
      marble-alt[data-st-empty] > .st-ghost { display: flex; }

      /* ---- versions panel */
      .st-pop {
        position: fixed; z-index: 60; display: none; flex-direction: column;
        width: 360px; max-width: calc(100vw - 16px); max-height: min(70vh, 560px);
        background: var(--background, #fff); border: 1px solid var(--rule, #e4e4e7);
        border-radius: 4px; box-shadow: 0 6px 24px rgba(0,0,0,.12);
      }
      .st-pop[data-open] { display: flex; }
      .st-pop-head { display: flex; align-items: center; gap: 8px; padding: 9px 8px 9px 12px; border-bottom: 1px solid var(--rule, #e4e4e7); }
      .st-pop-title { font-weight: 600; flex: 1; }
      .st-pop-sub { color: var(--faint, #a1a1aa); font-weight: 400; }
      .st-vlist { overflow: auto; padding: 4px 0; }
      .st-vrow {
        display: grid; grid-template-columns: 16px 1fr auto; gap: 2px 8px; align-items: center;
        padding: 8px 10px 8px 12px; cursor: pointer;
      }
      .st-vrow:hover { background: rgba(127,127,127,.06); }
      .st-vrow[aria-current="true"] { background: rgba(127,127,127,.09); }
      .st-dot { width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--dim, #71717a); justify-self: center; }
      .st-vrow[aria-current="true"] .st-dot { background: var(--foreground, #171717); border-color: var(--foreground, #171717); }
      .st-vname {
        min-width: 0; padding: 2px 0; border: 0; border-bottom: 1px solid transparent; background: none;
        font: 600 12.5px var(--sans, system-ui, sans-serif); color: inherit; outline: none;
      }
      .st-vname:hover { border-bottom-color: var(--rule, #e4e4e7); }
      .st-vname:focus { border-bottom-color: var(--dim, #71717a); }
      .st-vname::placeholder { color: inherit; }
      .st-vacts { display: flex; gap: 2px; opacity: 0; }
      .st-vrow:hover .st-vacts, .st-vrow:focus-within .st-vacts { opacity: 1; }
      .st-vtext {
        grid-column: 2 / 4; color: var(--dim, #71717a); font-size: 12px; line-height: 1.45;
        display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
      }
      .st-vtext.st-hidden { font-style: italic; color: var(--faint, #a1a1aa); }
      .st-tb {
        border: 0; background: none; cursor: pointer; padding: 2px 6px; border-radius: 2px;
        color: var(--dim, #71717a); font-size: 11.5px;
      }
      .st-tb:hover:not(:disabled) { color: var(--foreground, #171717); background: rgba(127,127,127,.1); }
      .st-tb:disabled { opacity: .4; cursor: default; }
      .st-tb.st-danger:hover:not(:disabled) { color: var(--st-red); }
      .st-pop-foot { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--rule, #e4e4e7); }
      .st-pop-foot .st-note { color: var(--faint, #a1a1aa); font-size: 11.5px; margin-left: auto; }

      /* ---- the publication card: a popover beside what opened it */
      .pf-card {
        position: fixed; z-index: 70; display: none; flex-direction: column; width: 420px;
        background: var(--background, #fff); border: 1px solid var(--rule, #e4e4e7);
        border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,.06), 0 14px 44px rgba(0,0,0,.16);
      }
      .pf-card[data-open] { display: flex; }
      .pf-card[data-docked] { bottom: 0; border-radius: 10px 10px 0 0; border-bottom: 0; }
      .pf-card[data-docked] .pf-tail { display: none; }
      .pf-tail {
        position: absolute; width: 12px; height: 12px; transform: rotate(45deg);
        background: var(--background, #fff); border: 1px solid var(--rule, #e4e4e7);
      }
      .pf-card[data-side="right"] .pf-tail { border-top-color: transparent; border-right-color: transparent; }
      .pf-card[data-side="left"] .pf-tail { border-bottom-color: transparent; border-left-color: transparent; }
      .pf-card[data-side="below"] .pf-tail { border-bottom-color: transparent; border-right-color: transparent; }
      .pf-card[data-side="above"] .pf-tail { border-top-color: transparent; border-left-color: transparent; }
      .pf-card-head { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px 8px 10px 14px; border-bottom: 1px solid var(--rule, #e4e4e7); }
      .pf-card-title { flex: 1; font: 600 13.5px/1.2 var(--sans, system-ui, sans-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pf-card-body { flex: 1; min-height: 0; overflow: auto; padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 14px; overscroll-behavior: contain; }
      .pf-card-note { font-size: 11.5px; color: var(--st-red); }

      /* the finder, at the top of a new card */
      .pf-find { display: flex; flex-direction: column; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--rule, #e4e4e7); }
      .pf-find[data-folded] { padding-bottom: 0; border-bottom: 0; }
      .pf-find-open { align-self: flex-start; padding-left: 0; }
      .pf-find:not([data-folded]) .pf-find-open, .pf-find[data-folded] .pf-find-box { display: none; }
      .pf-find-box { display: flex; flex-direction: column; gap: 6px; }
      .pf-find-row { display: flex; gap: 6px; }
      .pf-find-row .st-in { flex: 1; }
      .pf-find-meta { display: flex; align-items: center; gap: 8px; min-height: 22px; }
      .pf-status { flex: 1; font-size: 11.5px; color: var(--dim, #71717a); }
      .pf-status[data-tone="warn"] { color: var(--st-red); }
      .pf-agent[data-running] { color: var(--foreground, #171717); }
      .pf-hits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .pf-hit {
        width: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 7px 8px;
        border: 1px solid transparent; border-radius: 4px; background: none; cursor: pointer; font: inherit; color: inherit;
      }
      .pf-hit:hover, .pf-hit:focus-visible { border-color: var(--rule, #e4e4e7); background: rgba(127,127,127,.06); }
      .pf-hit-t { font-weight: 600; font-size: 12.5px; line-height: 1.35; }
      .pf-hit-a { font-size: 12px; color: var(--dim, #71717a); }
      .pf-hit-a b { color: var(--foreground, #171717); font-weight: 600; }
      .pf-hit-v { font-size: 11.5px; color: var(--faint, #a1a1aa); }
      .pf-pic { display: flex; align-items: center; gap: 10px; }
      .pf-pic img { width: 96px; height: 60px; object-fit: cover; border: 1px solid var(--rule, #e4e4e7); border-radius: 3px; background: var(--thumb-bg, #fff); }
      .st-warn { grid-column: 2 / 4; font-size: 11.5px; color: var(--st-red); }
      .st-warn:empty { display: none; }
      .st-link .st-in[aria-invalid] { border-color: var(--st-red); }
      .st-field { display: flex; flex-direction: column; gap: 5px; }
      .st-field > label, .st-lab { font-size: 11.5px; color: var(--dim, #71717a); }
      .st-help { font-size: 11.5px; color: var(--faint, #a1a1aa); }
      .st-row2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; }
      .st-in, .st-ta {
        width: 100%; padding: 6px 8px; border: 1px solid var(--rule, #e4e4e7); border-radius: 3px;
        background: var(--background, #fff); color: inherit; font: 400 13px/1.4 var(--sans, system-ui, sans-serif);
        outline: none;
      }
      .st-in:focus, .st-ta:focus { border-color: var(--dim, #71717a); }
      .st-in[aria-invalid="true"], .st-ta[aria-invalid="true"] { border-color: var(--st-red); }
      .st-ta { resize: vertical; min-height: 58px; }
      .st-title { font-weight: 600; }
      .st-err { color: var(--st-red); font-size: 11.5px; }
      .st-err:empty { display: none; }

      .st-seg { display: flex; flex-direction: column; gap: 4px; }
      .st-seg label { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--rule, #e4e4e7); border-radius: 3px; cursor: pointer; font-size: 12.5px; }
      .st-seg label:has(input:checked) { border-color: var(--foreground, #171717); }
      .st-seg input { margin: 0; accent-color: var(--foreground, #171717); }

      .st-chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .st-chip {
        padding: 2px 8px; border: 1px solid var(--rule, #e4e4e7); border-radius: 999px; background: none;
        cursor: pointer; font-size: 12px; color: var(--dim, #71717a);
      }
      .st-chip:hover { border-color: var(--dim, #71717a); color: var(--foreground, #171717); }
      .st-chip[aria-pressed="true"] { color: var(--foreground, #171717); border-color: var(--foreground, #171717); font-weight: 600; }

      .st-links { display: flex; flex-direction: column; gap: 6px; }
      .st-link { display: grid; grid-template-columns: 22px 92px 1fr 22px; gap: 6px; align-items: center; }
      .st-link .st-in { padding: 5px 7px; font-size: 12.5px; }
      .st-grab { cursor: grab; color: var(--faint, #a1a1aa); display: inline-flex; justify-content: center; user-select: none; }
      .st-link[data-dragging] { opacity: .4; }
      .st-quick { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }

      .st-shelf { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
      .st-shelf button {
        aspect-ratio: 16 / 10; padding: 0; border: 1px solid var(--rule, #e4e4e7); border-radius: 2px;
        overflow: hidden; background: var(--thumb-bg, #fff); cursor: pointer;
      }
      .st-shelf button:hover { border-color: var(--dim, #71717a); }
      .st-shelf button[aria-pressed="true"] { border-color: var(--foreground, #171717); box-shadow: 0 0 0 1px var(--foreground, #171717); }
      .st-shelf img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .st-shelf .st-up { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--dim, #71717a); font-size: 11px; background: none; }

      .st-sheet-foot { display: flex; align-items: center; gap: 8px; padding: 10px 12px 10px 16px; border-top: 1px solid var(--rule, #e4e4e7); }
      .st-sheet-foot .st-grow { flex: 1; }
      .st-btn {
        padding: 6px 12px; border: 1px solid var(--rule, #e4e4e7); border-radius: 3px; background: none;
        cursor: pointer; font-size: 12.5px; color: var(--foreground, #171717);
      }
      .st-btn:hover { border-color: var(--dim, #71717a); }
      .st-btn.st-primary { background: var(--foreground, #171717); border-color: var(--foreground, #171717); color: var(--background, #fff); font-weight: 600; }
      .st-btn.st-primary:hover { opacity: .88; }
      .st-btn.st-danger { border-color: transparent; color: var(--st-red); padding-left: 4px; padding-right: 4px; }
      .st-btn.st-danger:hover { text-decoration: underline; text-underline-offset: 3px; }
      .st-kbd { color: var(--faint, #a1a1aa); font-size: 11px; }

      /* ---- notes: saving, removed + undo */
      .st-notes {
        position: fixed; left: calc(var(--marble-shell-left, 0px) + 16px); bottom: 16px; z-index: 80;
        display: flex; flex-direction: column; align-items: flex-start; gap: 6px; pointer-events: none;
      }
      .st-toast {
        display: flex; align-items: center; gap: 10px; max-width: min(440px, calc(100vw - 32px));
        padding: 7px 8px 7px 12px; border-radius: 4px; pointer-events: auto;
        background: var(--foreground, #171717); color: var(--background, #fff);
        box-shadow: 0 4px 16px rgba(0,0,0,.16); font-size: 12.5px;
        transition: opacity .18s ease, transform .18s ease;
      }
      .st-toast[data-leaving] { opacity: 0; transform: translateY(4px); }
      .st-toast span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .st-toast button {
        border: 0; background: none; color: inherit; cursor: pointer; font-weight: 600;
        padding: 2px 6px; border-radius: 2px; text-decoration: underline; text-underline-offset: 3px;
      }
      .st-toast button:hover { background: rgba(127,127,127,.25); }
      .st-save {
        padding: 3px 9px; border-radius: 999px; font-size: 11.5px; color: var(--dim, #71717a);
        background: var(--background, #fff); border: 1px solid var(--rule, #e4e4e7);
        opacity: 0; transition: opacity .25s ease;
      }
      .st-save[data-state="saving"] { opacity: 1; }
      .st-save[data-state="saved"] { opacity: .8; }
      .st-save[data-state="error"] { opacity: 1; color: var(--st-red); border-color: currentColor; pointer-events: auto; }
      @media (prefers-reduced-motion: reduce) { .st-toast, .st-save, .pf-bar, .pf-chip { transition: none; } }
    
      /* ---- the control layer: one sheet over the page, positioned in page
         coordinates so it scrolls with what it points at */
      .pf-ui { --st-red: #b4544f; }
      .pf-layer { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 45; pointer-events: none; }
      .pf-bar {
        position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 1px; padding: 2px;
        background: var(--background, #fff); border: 1px solid var(--rule, #e4e4e7); border-radius: 5px;
        box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 4px 14px rgba(0,0,0,.09);
        pointer-events: auto; white-space: nowrap; z-index: 2;
        font: 400 12px/1 var(--sans, system-ui, sans-serif); color: var(--foreground, #171717);
      }
      .pf-bar[hidden], .pf-ring[hidden], .pf-chip[hidden] { display: none; }
      .pf-bar[data-kind="paper"], .pf-bar[data-kind="bio"] { flex-direction: column; }
      .pf-btn {
        width: 24px; height: 24px; padding: 0; border: 0; border-radius: 3px; background: none;
        display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        color: var(--dim, #71717a); font: inherit;
      }
      .pf-btn:hover { color: var(--foreground, #171717); background: rgba(127,127,127,.12); }
      .pf-btn.pf-danger:hover { color: var(--st-red); background: rgba(180,84,79,.1); }
      .pf-btn[aria-pressed="true"] { color: var(--foreground, #171717); background: rgba(127,127,127,.16); }
      .pf-handle { cursor: grab; touch-action: none; }
      .pf-me { width: auto; padding: 0 7px; font-weight: 600; font-size: 11.5px; }

      .pf-bar[data-kind="alt"] { gap: 2px; padding: 2px 3px 2px 8px; font-size: 11.5px; }
      .pf-what { color: var(--dim, #71717a); margin-right: 4px; }
      .pf-v {
        border: 0; background: none; cursor: pointer; padding: 5px 6px; border-radius: 3px;
        color: var(--dim, #71717a); max-width: 10rem; overflow: hidden; text-overflow: ellipsis; font: inherit;
      }
      .pf-v:hover { color: var(--foreground, #171717); background: rgba(127,127,127,.12); }
      .pf-v[aria-pressed="true"] { color: var(--foreground, #171717); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
      .pf-v.pf-hidden { font-style: italic; }
      .pf-sep { width: 1px; height: 14px; background: var(--rule, #e4e4e7); margin: 0 3px; }

      /* "+ Author", "+ Link", and "+ Add" beside a list's heading */
      .pf-chip {
        position: absolute; left: 0; top: 0; pointer-events: auto; z-index: 1;
        display: inline-flex; align-items: center; gap: 3px; height: 22px; padding: 0 8px 0 6px;
        border: 1px solid var(--rule, #e4e4e7); border-radius: 999px; background: var(--background, #fff);
        color: var(--dim, #71717a); cursor: pointer; white-space: nowrap;
        font: 400 12px/1 var(--sans, system-ui, sans-serif);
      }
      .pf-chip:hover { color: var(--foreground, #171717); border-color: var(--dim, #71717a); }
      .pf-chip.pf-head { opacity: .65; }
      .pf-chip.pf-head:hover, .pf-chip.pf-head:focus-visible { opacity: 1; }

      /* What a control is about to act on, drawn while the pointer is on it. */
      .pf-ring { position: absolute; left: 0; top: 0; border: 1px dashed var(--faint, #a1a1aa); border-radius: 4px; pointer-events: none; }
      .pf-ring.pf-danger { border-style: solid; border-color: var(--st-red); background: rgba(180,84,79,.05); }

      /* A drag. The item moves through the list as the pointer passes; the
         label under the pointer says what is moving. */
      .marble-dragging { opacity: .35; pointer-events: none; }
      html.marble-drag, html.marble-drag * { cursor: grabbing !important; user-select: none !important; -webkit-user-select: none !important; }
      .marble-drop { outline: 1px dashed rgba(127,127,127,.45); outline-offset: .6rem; border-radius: 2px; }
      .pf-ghost {
        position: absolute; left: 0; top: 0; pointer-events: none; max-width: 300px; padding: 5px 10px; z-index: 3;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 4px;
        background: var(--foreground, #171717); color: var(--background, #fff);
        font: 600 12px/1.3 var(--sans, system-ui, sans-serif); box-shadow: 0 4px 14px rgba(0,0,0,.18);
      }

      /* Where a link goes, set from the link button. */
      .marble-url {
        position: fixed; z-index: 66; display: none; align-items: center; gap: 6px;
        padding: 7px 8px; width: 300px; max-width: calc(100vw - 16px);
        background: var(--background, #fff); border: 1px solid var(--rule, #e4e4e7);
        border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,.11);
        font: 400 12.5px var(--sans, system-ui, sans-serif); color: var(--foreground, #171717);
      }
      .marble-url[data-open] { display: flex; }
      .marble-url input {
        flex: 1; min-width: 0; padding: 5px 7px; border: 1px solid var(--rule, #e4e4e7); border-radius: 3px;
        background: none; color: inherit; font: inherit; outline: none;
      }
      .marble-url input:focus { border-color: var(--dim, #71717a); }
      .marble-url .pf-btn { flex: none; }
      .marble-url .pf-set {
        padding: 5px 10px; border: 1px solid var(--foreground, #171717); border-radius: 3px; cursor: pointer;
        background: var(--foreground, #171717); color: var(--background, #fff); font: 600 12px var(--sans, system-ui, sans-serif);
      }

      /* The other editors' popovers sit above the layer. */
      html .marble-rt, html .marble-lk, html .marble-gal { z-index: 66; }

      /* No hover to wait for: bigger targets, and the picture's buttons shown. */
      @media (hover: none), (pointer: coarse) {
        .pf-btn { width: 34px; height: 34px; }
        .pf-v { padding: 9px 8px; }
        .pf-chip { height: 30px; padding: 0 12px 0 10px; }
        html.marble-studio [data-marble-image] .marble-ip { opacity: 1; }
      }
    
      /* ---- motion CSS can do on its own. Showing a version swaps which
         child is displayed; @starting-style eases the newcomer in, and only
         when it changes, not when the page loads. */
      @media (prefers-reduced-motion: no-preference) {
        html.marble-studio marble-alt > [data-marble-alt], html.marble-studio .st-ghost {
          transition: opacity .24s ease, translate .24s cubic-bezier(.2, .8, .2, 1);
        }
        @starting-style {
          html.marble-studio marble-alt > [data-marble-alt], html.marble-studio .st-ghost { opacity: 0; translate: 0 4px; }
        }
        .pf-bar, .pf-chip { transition: background-color .12s ease, border-color .12s ease; }
        .pf-btn, .pf-v, .pf-chip, .st-chip, .st-btn, .st-tb, .pf-hit { transition: background-color .12s ease, color .12s ease, border-color .12s ease; }
      }
      .pf-bar[data-kind="paper"], .pf-bar[data-kind="bio"] { transform-origin: 100% 12px; }
      .pf-bar[data-kind="author"] { transform-origin: 50% 100%; }
      .pf-bar[data-kind="res"] { transform-origin: 50% 0; }
      .pf-bar[data-kind="contact"] { transform-origin: 0 50%; }
      .pf-bar[data-kind="alt"] { transform-origin: 12px 0; }
    `;    document.head.append(style);
    document.documentElement.classList.add('marble-studio');
    marble.pageOnly('data-hint', 'data-st-empty');

    // ---------------------------------------------------------------- notes

    const notes = chrome('div', 'st-notes st-ui');
    notes.setAttribute('aria-live', 'polite');
    document.body.append(notes);

    const saveNote = chrome('div', 'st-save');
    notes.append(saveNote);
    let saveTimer = null;
    document.addEventListener('marble:status', ({ detail }) => {
      saveNote.dataset.state = detail.state;
      saveNote.textContent =
        detail.state === 'saving' ? 'Saving…'
          : detail.state === 'saved' ? 'Saved'
            : `Not saved: ${detail.message || 'the Drive did not answer'}`;
      clearTimeout(saveTimer);
      if (detail.state === 'saved') saveTimer = setTimeout(() => (saveNote.dataset.state = 'idle'), 1400);
    });

    // A removal says what it removed and offers it back. Undo is one keystroke
    // already, but nothing on screen said so, and a stray click on a paper's ×
    // took the paper with no trace of where it went.
    let toast = null;
    function say(text, { undo = false } = {}) {
      toast?.dismiss();
      const el = chrome('div', 'st-toast');
      const words = document.createElement('span');
      words.textContent = text;
      el.append(words);
      let timer = null;
      let onHistory = null;
      const dismiss = () => {
        clearTimeout(timer);
        if (onHistory) document.removeEventListener('marble:history', onHistory);
        el.dataset.leaving = '';
        setTimeout(() => el.remove(), 200);
        if (toast?.el === el) toast = null;
      };
      if (undo) {
        const button = document.createElement('button');
        button.textContent = 'Undo';
        button.addEventListener('click', () => {
          dismiss();
          if (marble.canUndo) marble.undo();
        });
        el.append(button);
        // Any later step makes "Undo" mean something else, so the offer goes.
        setTimeout(() => {
          onHistory = () => dismiss();
          document.addEventListener('marble:history', onHistory);
        }, 0);
      }
      notes.prepend(el);
      enter(el, 'translateY(8px)');
      timer = setTimeout(dismiss, undo ? 7000 : 2600);
      toast = { el, dismiss };
    }

    // ------------------------------------------------------------- versions

    const nameOf = (el) => el?.getAttribute(ALT) ?? null;
    const versionsOf = (alt) => kids(alt).filter((c) => c.hasAttribute(ALT));
    const activeIn = (alt) => {
      const all = versionsOf(alt);
      return all.find((v) => nameOf(v) === alt.getAttribute(ACTIVE)) ?? all[0] ?? null;
    };
    // Hidden is a version that draws nothing on the site (class "none"). A
    // version with no words is not hidden: its frame — the notice's rule, its
    // padding — still draws, and calling it hidden would be a lie about what
    // visitors see.
    const isEmpty = (v) => v.classList.contains('none');
    const isBlank = (v) => !isEmpty(v) && !textOf(v) && !v.querySelector('img');
    const labelOf = (v) => v.getAttribute(LABEL) || (isEmpty(v) ? 'Hidden' : isBlank(v) ? `${nameOf(v)} · empty` : nameOf(v));
    const whatOf = (alt) => alt.getAttribute(LABEL) || 'Versions';
    function nextName(alt) {
      const taken = new Set(versionsOf(alt).map(nameOf));
      for (let n = 1; n <= VERSIONS; n += 1) if (!taken.has(`v${n}`)) return `v${n}`;
      return null;
    }
    const preview = (v) => (isEmpty(v) ? 'Nothing shows here on the site.'
      : isBlank(v) ? 'No words yet, but its frame still shows on the site.' : clip(textOf(v), 220));

    function setActive(alt, name) {
      if (!name || alt.getAttribute(ACTIVE) === name) return;
      play([{ type: 'setAttr', id: marble.id(alt), name: ACTIVE, value: name }]);
    }

    function focusVersion(version) {
      const typeable = version.matches('[data-marble-rich], [data-marble-editable]')
        ? version
        : version.querySelector('[data-marble-rich], [data-marble-editable]');
      if (!typeable) return;
      typeable.focus();
      const range = document.createRange();
      range.selectNodeContents(typeable);
      range.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }

    // A new version is a copy, because a new phrasing is nearly always an edit
    // of an old one. Copying the empty "hidden" version gives nothing to type
    // into, so from there it copies the latest version that has words.
    function addVersion(alt) {
      const name = nextName(alt);
      if (!name) return;
      const all = versionsOf(alt);
      const current = activeIn(alt);
      const worded = (v) => v && !isEmpty(v) && !isBlank(v);
      const source = worded(current) ? current : [...all].reverse().find(worded) ?? current;
      if (!source) return;
      const version = marble.clone(source);
      for (const el of [version, ...version.querySelectorAll('[data-marble-id]')]) el.removeAttribute('data-marble-id');
      version.setAttribute(ALT, name);
      version.removeAttribute(LABEL);
      // Every element gets a name except the marks inside a rich block, which
      // travel in that block's markup and are never addressed on their own.
      for (const el of [version, ...version.querySelectorAll('*')]) {
        if (el !== version && el.parentElement.closest('[data-marble-rich]')) continue;
        el.setAttribute('data-marble-id', marble.newId());
      }
      const last = all[all.length - 1];
      const before = last ? last.nextElementSibling : null;
      const beforeId = before && !isTransient(before) ? marble.id(before) : null;
      play([
        { type: 'insert', html: marble.source.outer(version), parentId: marble.id(alt), beforeId },
        { type: 'setAttr', id: marble.id(alt), name: ACTIVE, value: name },
      ]);
      const landed = versionsOf(alt).find((v) => nameOf(v) === name);
      if (landed) requestAnimationFrame(() => focusVersion(landed));
      say(`Added ${name}, a copy of ${labelOf(source)}. It is showing on the site now.`);
    }

    function dropVersion(alt, version) {
      const all = versionsOf(alt);
      if (all.length < 2) return;
      const ops = [];
      if (activeIn(alt) === version) {
        const at = all.indexOf(version);
        const next = all[at + 1] ?? all[at - 1];
        ops.push({ type: 'setAttr', id: marble.id(alt), name: ACTIVE, value: nameOf(next) });
      }
      ops.push({ type: 'remove', id: marble.id(version) });
      const label = labelOf(version);
      play(ops);
      say(`Deleted ${label} of ${whatOf(alt).toLowerCase()}`, { undo: true });
    }

    // Hiding a block is showing its empty version. If it has none — it was
    // deleted, or the block never had one — the empty version is made, so
    // "not on the site right now" is always one click and never a deletion.
    function hideBlock(alt) {
      const empty = versionsOf(alt).find(isEmpty);
      if (empty) return setActive(alt, nameOf(empty));
      const name = nextName(alt);
      if (!name) return;
      const inline = versionsOf(alt).every((v) => getComputedStyle(v).display.startsWith('inline') || v.matches('a, span'));
      const tag = inline ? 'span' : 'div';
      play([
        { type: 'insert', html: `<${tag} class="none" data-marble-alt="${name}" data-marble-id="${marble.newId()}" data-label="Hidden"></${tag}>`, parentId: marble.id(alt), beforeId: marble.id(versionsOf(alt)[0]) },
        { type: 'setAttr', id: marble.id(alt), name: ACTIVE, value: name },
      ]);
      say(`${whatOf(alt)} is hidden on the site. Pick a version to show it again.`, { undo: true });
    }

    function rename(version, value) {
      const next = value.trim() || null;
      if ((version.getAttribute(LABEL) || null) === next) return;
      play([{ type: 'setAttr', id: marble.id(version), name: LABEL, value: next }]);
    }

    // The panel: every version at once, with what it says, so choosing does
    // not mean switching the live page to read each draft.
    const pop = chrome('div', 'st-pop st-ui');
    pop.setAttribute('role', 'dialog');
    pop.innerHTML = `
      <div class="st-pop-head"><span class="st-pop-title"></span>
        <button class="st-ib st-pop-x" title="Close" aria-label="Close">${ICON.close}</button></div>
      <div class="st-vlist"></div>
      <div class="st-pop-foot">
        <button class="st-tb st-pop-new">${ICON.plus} New version</button>
        <button class="st-tb st-pop-hide">${ICON.eyeOff} Hide on the site</button>
        <span class="st-note">The filled dot is what visitors see.</span>
      </div>`;
    document.body.append(pop);
    const vlist = pop.querySelector('.st-vlist');
    let popAnchor = null;

    // Below what it belongs to, or above when there is no room below — inside
    // the part of the window the drive's shell leaves the page.
    function placeNear(el, rect) {
      const r = room();
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = `${Math.max(r.left + 8, Math.min(rect.left, r.right - w - 8))}px`;
      const below = rect.bottom + 6;
      const up = below + h > r.bottom - 8;
      el.style.top = `${up ? Math.max(r.top + 8, rect.top - h - 6) : below}px`;
      el.style.transformOrigin = up ? '20px 100%' : '20px 0';
    }

    function fillVersions(alt) {
      const all = versionsOf(alt);
      const current = activeIn(alt);
      pop.querySelector('.st-pop-title').innerHTML = '';
      pop.querySelector('.st-pop-title').append(
        document.createTextNode(whatOf(alt)),
        Object.assign(document.createElement('span'), { className: 'st-pop-sub', textContent: ` · ${all.length} versions` }),
      );
      pop.querySelector('.st-pop-new').disabled = !nextName(alt);
      const hideButton = pop.querySelector('.st-pop-hide');
      hideButton.hidden = versionsOf(alt).some(isEmpty);
      const focused = document.activeElement?.closest?.('.st-vrow')?.dataset.name;
      vlist.replaceChildren(
        ...all.map((v) => {
          const row = document.createElement('div');
          row.className = 'st-vrow';
          row.dataset.name = nameOf(v);
          row.setAttribute('aria-current', String(v === current));
          const dot = document.createElement('span');
          dot.className = 'st-dot';
          const name = document.createElement('input');
          name.className = 'st-vname';
          name.value = v.getAttribute(LABEL) ?? '';
          name.placeholder = isEmpty(v) ? `${nameOf(v)} · Hidden` : nameOf(v);
          name.title = 'Rename this version';
          name.spellcheck = false;
          name.addEventListener('click', (e) => e.stopPropagation());
          name.addEventListener('change', () => rename(v, name.value));
          name.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); name.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); name.value = v.getAttribute(LABEL) ?? ''; name.blur(); }
          });
          const acts = document.createElement('span');
          acts.className = 'st-vacts';
          const edit = document.createElement('button');
          edit.className = 'st-tb';
          edit.textContent = 'Edit';
          edit.title = 'Show this version and put the cursor in it';
          edit.hidden = isEmpty(v);
          edit.addEventListener('click', (e) => {
            e.stopPropagation();
            setActive(alt, nameOf(v));
            closeVersions();
            requestAnimationFrame(() => focusVersion(v));
          });
          const del = document.createElement('button');
          del.className = 'st-tb st-danger';
          del.textContent = 'Delete';
          del.disabled = all.length < 2;
          del.title = all.length < 2 ? 'The last version cannot be deleted' : 'Delete this version';
          del.addEventListener('click', (e) => { e.stopPropagation(); dropVersion(alt, v); });
          acts.append(edit, del);
          const text = document.createElement('div');
          text.className = `st-vtext${isEmpty(v) || isBlank(v) ? ' st-hidden' : ''}`;
          text.textContent = preview(v);
          row.append(dot, name, acts, text);
          row.addEventListener('click', () => setActive(alt, nameOf(v)));
          return row;
        }),
      );
      if (focused) vlist.querySelector(`[data-name="${CSS.escape(focused)}"] .st-vname`)?.focus();
    }

    function openVersions(alt, bar) {
      pop.dataset.for = marble.id(alt);
      popAnchor = alt;
      fillVersions(alt);
      const fresh = !pop.hasAttribute('data-open');
      pop.getAnimations().forEach((a) => a.cancel());
      delete pop.dataset.closing;
      pop.setAttribute('data-open', '');
      bar.setAttribute('data-pinned', '');
      placeNear(pop, bar.getBoundingClientRect());
      if (fresh) enter(pop, 'translateY(-4px) scale(.97)');
      pop.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    }
    function closeVersions() {
      if (!pop.hasAttribute('data-open') || pop.dataset.closing) return;
      pop.dataset.closing = '';
      leave(pop, () => {
        delete pop.dataset.closing;
        if (!pop.dataset.for) pop.removeAttribute('data-open');
      });
      delete pop.dataset.for;
      for (const b of document.querySelectorAll('.pf-bar[data-pinned]')) b.removeAttribute('data-pinned');
      frame();
      popAnchor = null;
    }
    pop.querySelector('.st-pop-x').addEventListener('click', closeVersions);
    pop.querySelector('.st-pop-new').addEventListener('click', () => popAnchor && addVersion(popAnchor));
    pop.querySelector('.st-pop-hide').addEventListener('click', () => popAnchor && hideBlock(popAnchor));
    document.addEventListener('mousedown', (e) => {
      if (!pop.hasAttribute('data-open')) return;
      if (e.target.closest('.st-pop, .pf-bar, .st-toast')) return;
      closeVersions();
    });

    // ------------------------------------------------------ the publication card

    // A whole paper at once, opened where you asked for it: from "+ Add" beside
    // a list's heading it opens under that button, from a paper's pencil it
    // opens beside the paper. Nothing in it reaches the file until Add or Save,
    // and then as the ops a hand-edit would file.

    // Which lists take papers is read from the page: a heading that adds papers
    // names its list, and the heading's own words are the list's name.
    const lists = () =>
      [...document.querySelectorAll('[data-paper-list]')].map((h) => ({
        heading: h,
        stack: document.querySelector(h.getAttribute('data-paper-list')),
        name: textOf(h),
      })).filter((l) => l.stack);

    const me = () => textOf(marble.byId('name')) || 'Bryan Min';

    // A link's label, guessed from where it goes, for the labels this page uses.
    function guessLabel(url) {
      const u = url.toLowerCase();
      if (/doi\.org|dl\.acm\.org\/doi|arxiv\.org\/abs/.test(u)) return 'DOI';
      if (/\.pdf($|\?)|arxiv\.org\/pdf/.test(u)) return 'Paper';
      if (/youtube\.com|youtu\.be|vimeo\.com/.test(u)) return 'Video';
      if (/github\.com/.test(u)) return 'Code';
      return 'Website';
    }
    const QUICK = ['DOI', 'Paper', 'Video', 'Website', 'Code'];
    // Words that name a link. One of these with no address is almost always a
    // link someone meant to paste and didn't — it would print as plain text.
    const LINK_WORDS = /^(doi|paper|pdf|video|preview|website|code|package|slides|workshop|talk|demo|github|twitter)$/i;

    const sheet = chrome('div', 'pf-card st-ui');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'false');
    sheet.setAttribute('aria-labelledby', 'pf-card-title');
    sheet.innerHTML = `
      <span class="pf-tail" aria-hidden="true"></span>
      <div class="pf-card-head">
        <span class="pf-card-title" id="pf-card-title"></span>
        <button class="st-ib st-x" type="button" title="Close (Esc)" aria-label="Close">${ICON.close}</button>
      </div>
      <form class="pf-card-body" novalidate>
        <div class="pf-find">
          <button type="button" class="st-tb pf-find-open">Look it up again</button>
          <div class="pf-find-box">
            <div class="pf-find-row">
              <input class="st-in pf-q" type="text" spellcheck="false" autocomplete="off"
                placeholder="Paste a title, DOI or arXiv link, or describe it" aria-label="Find the paper">
              <button type="button" class="st-btn pf-go">Find</button>
            </div>
            <div class="pf-find-meta">
              <span class="pf-status" aria-live="polite"></span>
              <button type="button" class="st-tb pf-agent" title="One of the drive’s agents searches the web for it">Ask an agent</button>
            </div>
            <ol class="pf-hits"></ol>
          </div>
        </div>
        <div class="st-field"><span class="st-lab">List</span><div class="st-seg st-list"></div></div>
        <div class="st-row2">
          <div class="st-field"><label for="st-venue">Venue</label><input id="st-venue" class="st-in" name="venue" placeholder="UIST 2026" autocomplete="off"></div>
          <div class="st-field"><label for="st-award">Award <span class="st-help">optional</span></label><input id="st-award" class="st-in" name="award" placeholder="Best Paper" autocomplete="off"></div>
        </div>
        <div class="st-field">
          <label for="st-title">Title</label>
          <textarea id="st-title" class="st-ta st-title" name="title" rows="2"></textarea>
          <span class="st-err st-title-err"></span>
        </div>
        <div class="st-field">
          <label for="st-authors">Authors</label>
          <textarea id="st-authors" class="st-ta" name="authors" rows="2" placeholder="Paste the author list, separated by commas"></textarea>
          <div class="st-chips"></div>
          <span class="st-help">Click a name to bold it as yours.</span>
        </div>
        <div class="st-field">
          <span class="st-lab">Links</span>
          <div class="st-links"></div>
          <div class="st-quick"><span class="st-help">Add</span></div>
        </div>
        <div class="st-field">
          <span class="st-lab">Picture</span>
          <div class="st-shelf"></div>
          <input type="file" accept="image/*" hidden class="st-file">
          <label for="st-alt" class="st-help">Description for screen readers</label>
          <input id="st-alt" class="st-in" name="alt" placeholder="Same as the title" autocomplete="off">
        </div>
      </form>
      <div class="st-sheet-foot">
        <button class="st-btn st-danger st-del" type="button">Delete</button>
        <span class="st-grow pf-card-note" aria-live="polite"></span>
        <button class="st-btn st-cancel" type="button">Cancel</button>
        <button class="st-btn st-primary st-save-btn" type="button"></button>
      </div>`;
    document.body.append(sheet);

    const $ = (sel) => sheet.querySelector(sel);
    const f = {
      list: $('.st-list'), venue: $('#st-venue'), award: $('#st-award'), title: $('#st-title'),
      titleErr: $('.st-title-err'), authors: $('#st-authors'), chips: $('.st-chips'),
      links: $('.st-links'), quick: $('.st-quick'), shelf: $('.st-shelf'), file: $('.st-file'), alt: $('#st-alt'),
      find: $('.pf-find'), q: $('.pf-q'), go: $('.pf-go'), agent: $('.pf-agent'), status: $('.pf-status'), hits: $('.pf-hits'),
      note: $('.pf-card-note'),
    };

    let editing = null; // the <article> being edited, or null for a new one
    let draft = null;
    let opener = null;
    let cardAnchor = null;
    let cardSide = null;
    let pristine = '';

    const splitNames = (s) => s.split(/\s*(?:,|\n|;|\band\b(?=\s+[A-Z]))\s*/).map((n) => n.trim()).filter(Boolean);

    function readPaper(paper) {
      const venue = paper.querySelector('.venue h5:not(.award)');
      const award = paper.querySelector('.venue .award');
      const authors = [...paper.querySelectorAll('.authors > .author')];
      const img = paper.querySelector('.shot img');
      return {
        list: lists().find((l) => l.stack === paper.parentElement)?.stack ?? lists()[0]?.stack,
        venue: textOf(venue), award: textOf(award), title: textOf(paper.querySelector('h3')),
        authors: authors.map((a) => textOf(a)),
        mine: new Set(authors.filter((a) => a.classList.contains('me')).map((a) => textOf(a))),
        links: kids(paper.querySelector('.res')).map((el) => ({ label: textOf(el), href: el.tagName === 'A' ? el.getAttribute('href') ?? '' : '' })),
        src: img?.getAttribute('src') ?? '/thumbnails/coming-soon.png',
        alt: img?.getAttribute('alt') ?? '',
      };
    }

    // What the card would write, as one string, so "has anything changed" is
    // a comparison rather than a flag every field has to remember to set.
    const snapshot = () => JSON.stringify([
      draft?.list && marble.id(draft.list), f.venue.value.trim(), f.award.value.trim(), f.title.value.trim(),
      splitNames(f.authors.value), [...(draft?.mine ?? [])].sort(), draft?.links, draft?.src, f.alt.value.trim(),
    ]);
    const dirty = () => Boolean(draft) && snapshot() !== pristine;

    function paintList() {
      f.list.replaceChildren(
        ...lists().map((l, i) => {
          const label = document.createElement('label');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'st-list';
          radio.value = String(i);
          radio.checked = l.stack === draft.list;
          radio.addEventListener('change', () => (draft.list = l.stack));
          label.append(radio, document.createTextNode(l.name));
          return label;
        }),
      );
    }

    function paintChips() {
      draft.authors = splitNames(f.authors.value);
      f.chips.replaceChildren(
        ...draft.authors.map((name) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'st-chip';
          chip.textContent = name;
          const on = draft.mine.has(name);
          chip.setAttribute('aria-pressed', String(on));
          chip.title = on ? 'Shown in bold as you. Click to unbold.' : 'Click to bold this name as you';
          chip.addEventListener('click', () => {
            if (draft.mine.has(name)) draft.mine.delete(name);
            else draft.mine.add(name);
            paintChips();
          });
          return chip;
        }),
      );
    }

    function linkRow(link) {
      const row = document.createElement('div');
      row.className = 'st-link';
      row.draggable = true;
      const grab = Object.assign(document.createElement('span'), { className: 'st-grab', innerHTML: ICON.grip, title: 'Drag to reorder' });
      const label = Object.assign(document.createElement('input'), { className: 'st-in', value: link.label, placeholder: 'Label' });
      label.setAttribute('list', 'st-labels');
      label.setAttribute('aria-label', 'Link label');
      const href = Object.assign(document.createElement('input'), { className: 'st-in', value: link.href, placeholder: 'https:// or /papers/name.pdf', type: 'text', spellcheck: false });
      href.setAttribute('aria-label', 'Link address');
      const drop = Object.assign(document.createElement('button'), { type: 'button', className: 'st-ib', innerHTML: ICON.close, title: 'Remove this link' });
      const warn = Object.assign(document.createElement('span'), { className: 'st-warn' });
      const check = () => {
        const missing = !link.href && LINK_WORDS.test(link.label.trim());
        warn.textContent = missing ? 'No address yet, so this shows as plain text.' : '';
        href.toggleAttribute('aria-invalid', missing);
      };
      let guessed = !link.label;
      label.addEventListener('input', () => { link.label = label.value; guessed = false; check(); });
      href.addEventListener('input', () => {
        link.href = href.value.trim();
        if ((guessed || !label.value) && link.href) { link.label = label.value = guessLabel(link.href); guessed = true; }
        check();
      });
      drop.addEventListener('click', () => {
        draft.links.splice(draft.links.indexOf(link), 1);
        paintLinks();
      });
      row.addEventListener('dragstart', (e) => { if (e.target.tagName === 'INPUT') return; row.dataset.dragging = ''; e.dataTransfer.effectAllowed = 'move'; dragLink = link; });
      row.addEventListener('dragend', () => { delete row.dataset.dragging; dragLink = null; });
      row.addEventListener('dragover', (e) => {
        if (!dragLink || dragLink === link) return;
        e.preventDefault();
        const from = draft.links.indexOf(dragLink);
        const to = draft.links.indexOf(link);
        draft.links.splice(from, 1);
        draft.links.splice(to, 0, dragLink);
        flip([...f.links.children], paintLinks);
      });
      // An input inside a draggable row would start a drag on text selection.
      for (const input of [label, href]) {
        input.addEventListener('mousedown', () => (row.draggable = false));
        input.addEventListener('mouseup', () => (row.draggable = true));
        input.addEventListener('blur', () => (row.draggable = true));
      }
      row.append(grab, label, href, drop, warn);
      check();
      return row;
    }
    let dragLink = null;
    const labelList = Object.assign(document.createElement('datalist'), { id: 'st-labels' });
    labelList.innerHTML = ['DOI', 'Paper', 'Video', 'Preview', 'Website', 'Code', 'Package', 'Slides', 'Workshop', 'Coming Soon'].map((l) => `<option value="${l}">`).join('');
    sheet.append(labelList);

    function paintLinks() {
      f.links.replaceChildren(...draft.links.map(linkRow));
    }

    for (const label of QUICK) {
      const chip = Object.assign(document.createElement('button'), { type: 'button', className: 'st-chip', textContent: label });
      chip.addEventListener('click', () => {
        const link = { label, href: '' };
        // "Coming Soon" holds the row's place until there is a real link.
        draft.links = draft.links.filter((l) => l.href || l.label.toLowerCase() !== 'coming soon');
        draft.links.push(link);
        paintLinks();
        const row = f.links.lastElementChild;
        enter(row, 'translateY(-4px)');
        row?.querySelectorAll('input')[1]?.focus();
      });
      f.quick.append(chip);
    }

    // The picture folds to the one in use and a "Change" until you ask for
    // the shelf, so the card stays the size of what you are likely to edit.
    let shelfOpen = false;
    function paintShelf() {
      if (!shelfOpen) {
        const now = document.createElement('div');
        now.className = 'pf-pic';
        const img = Object.assign(document.createElement('img'), { src: draft.src, alt: '' });
        const change = Object.assign(document.createElement('button'), { type: 'button', className: 'st-btn', textContent: 'Change picture' });
        change.addEventListener('click', () => {
          shelfOpen = true;
          paintShelf();
          enter(f.shelf, 'translateY(-4px)');
          placeCard();
        });
        now.append(img, change);
        f.shelf.classList.remove('st-shelf');
        f.shelf.replaceChildren(now);
        return;
      }
      f.shelf.classList.add('st-shelf');
      const shelf = document.querySelector('#tpl-thumbnails');
      const options = [...(shelf?.content.querySelectorAll('img') ?? [])].map((img) => ({ src: img.getAttribute('src'), name: img.getAttribute('alt') }));
      if (draft.src && !options.some((o) => o.src === draft.src)) options.unshift({ src: draft.src, name: 'Current picture' });
      const buttons = options.map((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = o.name ?? o.src;
        b.setAttribute('aria-pressed', String(o.src === draft.src));
        const img = document.createElement('img');
        img.src = o.src;
        img.alt = '';
        img.loading = 'lazy';
        b.append(img);
        b.addEventListener('click', () => { draft.src = o.src; paintShelf(); });
        return b;
      });
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'st-up';
      up.innerHTML = `${ICON.upload}<span>Upload</span>`;
      up.title = 'Upload a picture (it is resized and stored in the page)';
      up.addEventListener('click', () => f.file.click());
      f.shelf.replaceChildren(up, ...buttons);
    }
    f.file.addEventListener('change', async () => {
      const file = f.file.files?.[0];
      f.file.value = '';
      if (!file) return;
      draft.src = await downscale(file, 800);
      shelfOpen = false;
      paintShelf();
    });

    function downscale(blob, edge) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const image = new Image();
          image.onerror = reject;
          image.onload = () => {
            const scale = Math.min(1, edge / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(blob);
      });
    }

    // ---- where the card stands

    // Beside what opened it, on whichever side has room inside the part of the
    // window the page has: the drive's header, sidebar and docked chat take
    // the rest, and a card under them is a card you cannot use.
    function placeCard({ choose = false } = {}) {
      if (!sheet.hasAttribute('data-open')) return;
      const r = room();
      const narrow = r.right - r.left < 560;
      sheet.toggleAttribute('data-docked', narrow);
      if (narrow) {
        sheet.style.left = `${r.left}px`;
        sheet.style.width = `${r.right - r.left}px`;
        sheet.style.top = '';
        sheet.style.maxHeight = `${Math.min(innerHeight * 0.88, r.bottom - r.top)}px`;
        cardSide = 'docked';
        return;
      }
      const pad = 10;
      const w = Math.min(420, r.right - r.left - 2 * pad);
      sheet.style.width = `${w}px`;
      sheet.style.maxHeight = `${r.bottom - r.top - 2 * pad}px`;
      const h = sheet.offsetHeight;
      const a = cardAnchor?.isConnected ? cardAnchor.getBoundingClientRect() : null;
      if (!a) {
        cardSide = 'none';
        sheet.style.left = `${(r.left + r.right - w) / 2}px`;
        sheet.style.top = `${r.top + pad}px`;
        return;
      }
      const clampX = (x) => Math.max(r.left + pad, Math.min(x, r.right - w - pad));
      const clampY = (y) => Math.max(r.top + pad, Math.min(y, r.bottom - h - pad));
      const at = {
        right: { x: a.right + 12, y: clampY(a.top - 28), fits: a.right + 12 + w <= r.right - pad },
        below: { x: clampX(a.left - 24), y: a.bottom + 12, fits: a.bottom + 12 + h <= r.bottom - pad },
        above: { x: clampX(a.left - 24), y: a.top - 12 - h, fits: a.top - 12 - h >= r.top + pad },
        left: { x: a.left - 12 - w, y: clampY(a.top - 28), fits: a.left - 12 - w >= r.left + pad },
      };
      if (choose || !at[cardSide]) {
        const prefer = cardAnchor.closest('.pf-bar') ? ['right', 'below', 'above', 'left'] : ['below', 'above', 'right', 'left'];
        cardSide = prefer.find((side) => at[side].fits) ?? (a.top - r.top > r.bottom - a.bottom ? 'above' : 'below');
      }
      let { x, y } = at[cardSide];
      if (cardSide === 'below' || cardSide === 'above') y = clampY(y);
      else x = clampX(x);
      sheet.style.left = `${Math.round(x)}px`;
      sheet.style.top = `${Math.round(y)}px`;
      sheet.dataset.side = cardSide;
      // The tail points at the button that opened the card.
      const tail = $('.pf-tail');
      const cx = a.left + a.width / 2 - x;
      const cy = a.top + a.height / 2 - y;
      tail.style.left = cardSide === 'right' ? '-6px' : cardSide === 'left' ? `${w - 6}px` : `${Math.max(14, Math.min(cx - 6, w - 26))}px`;
      tail.style.top = cardSide === 'below' ? '-6px' : cardSide === 'above' ? `${h - 6}px` : `${Math.max(14, Math.min(cy - 6, h - 26))}px`;
      tail.hidden = (cardSide === 'right' || cardSide === 'left') && (cy < 8 || cy > h - 8);
      sheet.style.transformOrigin = cardSide === 'right' ? `0 ${cy}px` : cardSide === 'left' ? `100% ${cy}px` : cardSide === 'below' ? `${cx}px 0` : `${cx}px 100%`;
    }

    function openSheet(paper, list, anchor) {
      closeVersions();
      closeUrl();
      if (sheet.hasAttribute('data-open')) closeSheet({ quiet: true });
      opener = document.activeElement;
      editing = paper ?? null;
      cardAnchor = anchor ?? null;
      const base = paper ? readPaper(paper) : {
        list: list ?? lists()[0]?.stack, venue: '', award: '', title: '', authors: [me()], mine: new Set([me()]),
        links: [], src: '/thumbnails/coming-soon.png', alt: '',
      };
      draft = { ...base, links: base.links.map((l) => ({ ...l })), mine: new Set(base.mine) };
      $('.pf-card-title').textContent = paper ? 'Edit publication' : `New in ${lists().find((l) => l.stack === draft.list)?.name ?? 'publications'}`;
      $('.st-save-btn').textContent = paper ? 'Save' : 'Add to the top';
      $('.st-del').hidden = !paper;
      f.find.toggleAttribute('data-folded', Boolean(paper));
      f.q.value = '';
      f.hits.replaceChildren();
      f.status.textContent = '';
      f.note.textContent = '';
      f.venue.value = draft.venue;
      f.award.value = draft.award;
      f.title.value = draft.title;
      f.title.removeAttribute('aria-invalid');
      f.titleErr.textContent = '';
      f.authors.value = draft.authors.join(', ');
      f.alt.value = draft.alt && draft.alt !== draft.title ? draft.alt : '';
      shelfOpen = false;
      paintList();
      paintChips();
      paintLinks();
      paintShelf();
      pristine = snapshot();
      // Keep the control that opened it on screen while the card is up.
      const bar = anchor?.closest?.('.pf-bar');
      if (bar) bar.setAttribute('data-pinned', '');
      sheet.setAttribute('data-open', '');
      $('.pf-card-body').scrollTop = 0;
      placeCard({ choose: true });
      enter(sheet, sheet.hasAttribute('data-docked') ? 'translateY(24px)' : 'scale(.96)');
      (paper ? f.title : f.q).focus({ preventScroll: true });
    }

    function closeSheet({ quiet = false } = {}) {
      if (!sheet.hasAttribute('data-open')) return;
      const restore = opener;
      editing = null;
      draft = null;
      opener = null;
      cardAnchor = null;
      finderTicket += 1;
      for (const b of document.querySelectorAll('.pf-bar[data-pinned]')) b.removeAttribute('data-pinned');
      const done = () => {
        if (!draft) sheet.removeAttribute('data-open');
      };
      if (quiet) done();
      else leave(sheet, done);
      if (restore?.isConnected && sheet.contains(document.activeElement)) restore.focus?.({ preventScroll: true });
      frame();
    }

    // Closing with changes in it asks once: Esc, Cancel or a click away again
    // within a few seconds lets them go.
    let discardArmed = 0;
    function tryClose() {
      if (!dirty() || Date.now() - discardArmed < 4000) return closeSheet();
      discardArmed = Date.now();
      f.note.textContent = 'Unsaved changes. Close again to discard them.';
      motion(sheet, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 260, easing: 'ease-in-out' });
    }

    f.authors.addEventListener('input', () => {
      const before = new Set(draft.authors);
      paintChips();
      // Your own name is bold by default, the way every paper here has it.
      for (const name of draft.authors) if (!before.has(name) && isMe(name)) draft.mine.add(name);
      paintChips();
    });
    f.title.addEventListener('input', () => {
      f.title.removeAttribute('aria-invalid');
      f.titleErr.textContent = '';
    });

    // ---- the finder, in the card

    let finderTicket = 0;
    $('.pf-find-open').addEventListener('click', () => {
      f.find.removeAttribute('data-folded');
      f.q.value = f.title.value.trim();
      f.q.focus();
      placeCard();
    });

    function findStatus(text, tone = '') {
      f.status.textContent = text;
      f.status.dataset.tone = tone;
    }

    function drawHits(hits) {
      f.hits.replaceChildren(
        ...hits.map((hit, i) => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'pf-hit';
          const title = Object.assign(document.createElement('span'), { className: 'pf-hit-t', textContent: hit.title });
          const who = document.createElement('span');
          who.className = 'pf-hit-a';
          hit.authors.slice(0, 8).forEach((name, j) => {
            if (j) who.append(', ');
            const n = document.createElement(isMe(name) ? 'b' : 'span');
            n.textContent = name;
            who.append(n);
          });
          if (hit.authors.length > 8) who.append(`, +${hit.authors.length - 8}`);
          const where = Object.assign(document.createElement('span'), {
            className: 'pf-hit-v',
            textContent: [venueLine(hit), hit.sources.join(', '), hit.listed ? 'already on your site' : ''].filter(Boolean).join(' · '),
          });
          b.append(title, who, where);
          b.addEventListener('click', () => useHit(hit));
          li.append(b);
          enter(li, 'translateY(4px)', { delay: i * 30 });
          return li;
        }),
      );
      placeCard();
    }

    // A hit fills the fields; what you had typed into a field yourself is
    // replaced, because picking a paper is saying "this one".
    function useHit(hit) {
      f.title.value = hit.title;
      const authors = hit.authors.map((n) => (isMe(n) ? me() : n));
      f.authors.value = authors.join(', ');
      draft.mine = new Set(authors.filter((n) => n === me()));
      paintChips();
      f.venue.value = venueLine(hit);
      if (hit.award) f.award.value = hit.award;
      const found = linksOf(hit);
      const kept = draft.links.filter((l) => l.href && !found.some((x) => x.label === l.label));
      draft.links = [...found, ...kept];
      paintLinks();
      f.hits.replaceChildren();
      findStatus(`Filled in from ${hit.sources[0]}. Check it, then ${editing ? 'save' : 'add it'}.`, 'good');
      for (const el of [f.title, f.authors, f.venue]) {
        motion(el, [{ backgroundColor: 'rgba(127,127,127,.16)' }, { backgroundColor: 'transparent' }], { duration: 700, easing: 'ease-out' });
      }
      placeCard();
    }

    async function find() {
      const text = f.q.value.trim();
      if (!text || f.go.disabled) return;
      const ticket = ++finderTicket;
      f.go.disabled = true;
      f.hits.replaceChildren();
      findStatus('Looking in your papers, then Crossref, Semantic Scholar and OpenAlex…', 'busy');
      try {
        const { hits, failed, asked } = await lookUp(text);
        if (ticket !== finderTicket) return;
        if (hits.length) {
          drawHits(hits);
          findStatus(hits.length === 1 ? 'One match. Pick it to fill in the card.' : `${hits.length} matches, yours first. Pick one to fill in the card.`);
        } else if (failed.length === asked) {
          findStatus('Couldn’t reach the paper indexes. Try again, or ask an agent.', 'warn');
        } else {
          findStatus('Nothing matched. Try the title’s most distinctive words, or ask an agent.', 'warn');
        }
      } catch (err) {
        console.error('[portfolio] finder', err);
        if (ticket === finderTicket) findStatus('The search broke. Try again.', 'warn');
      } finally {
        if (ticket === finderTicket) f.go.disabled = false;
      }
    }

    async function findWithAgent() {
      const text = f.q.value.trim() || f.title.value.trim();
      if (f.agent.dataset.running) {
        finderTicket += 1;
        return;
      }
      if (!text) {
        findStatus('Type what you remember about the paper first.', 'warn');
        f.q.focus();
        return;
      }
      const ticket = ++finderTicket;
      f.agent.dataset.running = '';
      f.agent.textContent = 'Stop';
      f.hits.replaceChildren();
      findStatus('Asking an agent…', 'busy');
      try {
        const hits = await askAgent(text, {
          onStep: (step) => ticket === finderTicket && findStatus(step, 'busy'),
          stillWanted: () => ticket === finderTicket && sheet.hasAttribute('data-open'),
        });
        if (ticket !== finderTicket) return;
        if (hits.length) {
          drawHits(hits);
          findStatus('The agent found these. Pick one to fill in the card.');
        } else {
          findStatus('The agent couldn’t find it. Add a detail it can search on, like a co-author.', 'warn');
        }
      } catch (err) {
        if (err.stopped) findStatus('Stopped.');
        else if (err.status === 404) findStatus('Asking an agent works when this page is open in Marble Drive.', 'warn');
        else {
          console.error('[portfolio] agent finder', err);
          findStatus(`The agent didn’t finish: ${err.message}.`, 'warn');
        }
      } finally {
        delete f.agent.dataset.running;
        f.agent.textContent = 'Ask an agent';
      }
    }

    f.go.addEventListener('click', find);
    f.agent.addEventListener('click', findWithAgent);
    f.q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); find(); }
    });
    // A pasted DOI or arXiv link names one paper; look it up straight away.
    f.q.addEventListener('paste', () => setTimeout(() => {
      if (/\b10\.\d{4,9}\/|arxiv\.org\/(abs|pdf)\//i.test(f.q.value)) find();
    }));

    // ---- writing the draft into the page

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const authorHtml = (name, mine) =>
      `<span class="author${mine ? ' me' : ''}" data-marble-id="${marble.newId()}" data-marble-removable data-marble-editable>${esc(name)}</span>`;
    const linkHtml = (l) =>
      l.href
        ? `<a data-marble-id="${marble.newId()}" data-marble-removable data-marble-editable data-marble-href href="${esc(l.href)}" target="_blank" rel="noreferrer">${esc(l.label || guessLabel(l.href))}</a>`
        : `<p data-marble-id="${marble.newId()}" data-marble-removable data-marble-editable>${esc(l.label)}</p>`;

    function cleanDraft() {
      draft.venue = f.venue.value.trim();
      draft.award = f.award.value.trim();
      draft.title = f.title.value.replace(/\s+/g, ' ').trim();
      draft.authors = splitNames(f.authors.value);
      draft.links = draft.links.map((l) => ({ label: l.label.trim(), href: l.href.trim() })).filter((l) => l.label || l.href);
      draft.alt = f.alt.value.trim() || draft.title;
    }

    function newPaper() {
      const seed = document.querySelector('#tpl-paper')?.content.firstElementChild;
      const node = seed.cloneNode(true);
      // An empty venue stays empty: the editor shows "Venue" in it, a visitor
      // sees nothing, and the word "Venue" never ends up on the site.
      node.querySelector('.venue h5:not(.award)').textContent = draft.venue;
      node.querySelector('.venue .award').textContent = draft.award;
      node.querySelector('h3').textContent = draft.title;
      const img = node.querySelector('.shot img');
      img.setAttribute('src', draft.src);
      img.setAttribute('alt', draft.alt);
      node.querySelector('.authors').innerHTML = draft.authors.map((n) => authorHtml(n, draft.mine.has(n))).join('');
      node.querySelector('.res').innerHTML = (draft.links.length ? draft.links : [{ label: 'Coming Soon', href: '' }]).map(linkHtml).join('');
      nameAll(node);
      const first = kids(draft.list)[0];
      return { type: 'insert', html: marble.source.outer(node), parentId: marble.id(draft.list), beforeId: first ? marble.id(first) : null };
    }

    // Only what changed, field by field, so an edit through the card keeps
    // every id the paper had and Mod+Z puts back exactly what it took.
    function diffPaper(paper) {
      const ops = [];
      const id = (el) => marble.id(el);
      const setText = (el, text) => { if (el && textOf(el) !== text) ops.push({ type: 'setText', id: id(el), text }); };
      const setAttr = (el, name, value) => { if (el && el.getAttribute(name) !== value) ops.push({ type: 'setAttr', id: id(el), name, value }); };

      setText(paper.querySelector('.venue h5:not(.award)'), draft.venue);
      setText(paper.querySelector('.venue .award'), draft.award);
      setText(paper.querySelector('h3'), draft.title);
      const img = paper.querySelector('.shot img');
      setAttr(img, 'src', draft.src);
      setAttr(img, 'alt', draft.alt);

      // Names: the same slot keeps its element, so a typo fix is a setText and
      // not a new author; extra slots are added at the end or dropped.
      const row = paper.querySelector('.authors');
      const have = [...row.querySelectorAll(':scope > .author')];
      draft.authors.forEach((name, i) => {
        const el = have[i];
        if (!el) { ops.push({ type: 'insert', html: authorHtml(name, draft.mine.has(name)), parentId: id(row), beforeId: null }); return; }
        setText(el, name);
        const classes = new Set(owned(el).split(/\s+/).filter(Boolean));
        if (draft.mine.has(name)) classes.add('me'); else classes.delete('me');
        setAttr(el, 'class', [...classes].join(' '));
      });
      for (const el of have.slice(draft.authors.length)) ops.push({ type: 'remove', id: id(el) });

      // Links the same way; a slot that changes between a link and plain text
      // changes element, because one is an <a> and the other is not.
      const res = paper.querySelector('.res');
      const rows = kids(res);
      const want = draft.links.length ? draft.links : [{ label: 'Coming Soon', href: '' }];
      want.forEach((l, i) => {
        const el = rows[i];
        const isLink = Boolean(l.href);
        if (el && (el.tagName === 'A') === isLink) {
          setText(el, l.label || guessLabel(l.href));
          if (isLink) setAttr(el, 'href', l.href);
          return;
        }
        const next = rows[i + 1];
        if (el) ops.push({ type: 'remove', id: id(el) });
        ops.push({ type: 'insert', html: linkHtml(l), parentId: id(res), beforeId: el && next ? id(next) : null });
      });
      for (const el of rows.slice(want.length)) ops.push({ type: 'remove', id: id(el) });

      if (draft.list && draft.list !== paper.parentElement) {
        const first = kids(draft.list)[0];
        ops.push({ type: 'move', id: id(paper), parentId: id(draft.list), beforeId: first ? id(first) : null });
      }
      return ops;
    }

    function save() {
      cleanDraft();
      if (!draft.title) {
        f.title.setAttribute('aria-invalid', 'true');
        f.titleErr.textContent = 'A publication needs a title.';
        f.title.focus();
        return;
      }
      if (editing) {
        const paper = editing;
        const ops = diffPaper(paper);
        const title = draft.title;
        const moving = ops.some((op) => op.type === 'move');
        closeSheet();
        if (ops.length) {
          if (moving) play(ops);
          else flip(kids(paper.parentElement), () => play(ops));
          motion(paper, [{ backgroundColor: 'rgba(127,127,127,.10)' }, { backgroundColor: 'transparent' }], { duration: 900, easing: 'ease-out' });
        }
        say(ops.length ? `Saved “${clip(title, 48)}”` : 'No changes to save');
        return;
      }
      const op = newPaper();
      const title = draft.title;
      const list = draft.list;
      const listName = lists().find((l) => l.stack === list)?.name ?? 'the list';
      closeSheet();
      flip(kids(list), () => play([op]));
      const landed = marble.byId(new DOMParser().parseFromString(op.html, 'text/html').body.firstElementChild?.getAttribute('data-marble-id'));
      landed?.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
      say(`Added “${clip(title, 40)}” to the top of ${listName}`, { undo: true });
    }

    $('.st-save-btn').addEventListener('click', save);
    $('.st-cancel').addEventListener('click', tryClose);
    $('.st-x').addEventListener('click', tryClose);
    $('.st-del').addEventListener('click', () => {
      const paper = editing;
      closeSheet({ quiet: true });
      if (paper) removeItem(paper);
    });
    sheet.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); save(); });
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tryClose(); return; }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); return; }
      // Enter in a one-line field moves on rather than submitting half a paper.
      if (e.key === 'Enter' && e.target.matches('input.st-in') && !e.target.matches('.pf-q')) {
        e.preventDefault();
        const fields = [...sheet.querySelectorAll('input.st-in, textarea')].filter((x) => x.offsetParent);
        fields[fields.indexOf(e.target) + 1]?.focus();
      }
    });
    // Keys typed in the card are the card's: the page's Mod+Z must not undo
    // the document while you are correcting a field.
    sheet.addEventListener('keydown', (e) => e.stopPropagation());
    // A click away closes it, unless it holds changes; then it asks first.
    document.addEventListener('mousedown', (e) => {
      if (!sheet.hasAttribute('data-open') || sheet.contains(e.target)) return;
      if (e.target.closest('.pf-bar, .pf-chip, .st-toast, .marble-gal')) return;
      tryClose();
    });

    // ------------------------------------------------------------ the finder

    // A paper you have published exists somewhere else in full, so typing it
    // out field by field is copying by hand. The card's finder takes anything
    // you remember — a title, a DOI or arXiv link, a few words and a co-author —
    // and looks it up: Crossref (asked for papers with your name on them),
    // Semantic Scholar and OpenAlex, your own papers ranked first. Picking a
    // hit fills the card's fields; the fields are still what Add writes, so a
    // wrong guess is one correction away. "Ask an agent" goes further, through
    // one of the drive's agents searching the web the way you would. The same
    // finder lives in the CV (cv.mrbl); this one writes venues and links the
    // way this page writes them: "UIST 2025", "arXiv (May 2026)", "DOI".

    const STOP = new Set([
      'the', 'and', 'for', 'with', 'from', 'into', 'via', 'paper', 'using', 'our', 'about',
      'that', 'this', 'its', 'are', 'was', 'proceedings', 'conference', 'acm', 'ieee',
      'symposium', 'annual', 'international', 'best', 'award', 'honorable', 'mention', 'demo', 'poster',
    ]);
    const norm = (s) =>
      String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
    const keywords = (s) => norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
    const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    function sameName(a, b) {
      const x = norm(a).split(' ');
      const y = norm(b).split(' ');
      if (!x[0] || !y[0]) return false;
      if (x.join(' ') === y.join(' ')) return true;
      return x.at(-1) === y.at(-1) && x[0][0] === y[0][0];
    }
    const isMe = (name) => sameName(name, me());

    const VENUES = ['UIST', 'CHI', 'IUI', 'ICER', 'CSCW', 'DIS', 'C&C', 'VL/HCC', 'TOCHI', 'IMWUT', 'UbiComp', 'TEI', 'VIS', 'arXiv'];
    const VENUE_HINTS = [
      [/user interface software/i, 'UIST'],
      [/human factors in computing/i, 'CHI'],
      [/intelligent user interfaces/i, 'IUI'],
      [/computing education research/i, 'ICER'],
      [/designing interactive systems/i, 'DIS'],
      [/creativity (and|&) cognition/i, 'C&C'],
      [/visual languages/i, 'VL/HCC'],
      [/transactions on computer.human interaction/i, 'TOCHI'],
      [/interactive, mobile, wearable/i, 'IMWUT'],
      [/computer.supported cooperative|acm on human.computer interaction/i, 'CSCW'],
      [/\barxiv\b/i, 'arXiv'],
    ];
    function acronymOf(...names) {
      for (const name of names.flat()) {
        if (!name) continue;
        const bare = String(name).replace(/\s*'?\d{2,4}\s*$/, '').trim();
        const known = VENUES.find((v) => v.toLowerCase() === bare.toLowerCase());
        if (known) return known;
        const hint = VENUE_HINTS.find(([re]) => re.test(name));
        if (hint) return hint[1];
      }
      return null;
    }

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    // The venue line the way this page already writes it.
    function venueLine({ acronym, year, month, name }) {
      if (acronym === 'arXiv') return month && year ? `arXiv (${MONTHS[month - 1]} ${year})` : `arXiv${year ? ` (${year})` : ''}`;
      if (acronym) return `${acronym}${year ? ` ${year}` : ''}`;
      const short = stripTags(name).replace(/^proceedings of the\s+/i, '');
      return [clip(short, 48), year].filter(Boolean).join(' ');
    }

    function linksOf(hit) {
      const out = [];
      const arxiv = hit.arxiv || /^10\.48550\/arxiv\.(.+)$/i.exec(hit.doi ?? '')?.[1];
      if (hit.doi && !/^10\.48550\//i.test(hit.doi)) out.push({ label: 'DOI', href: `https://doi.org/${hit.doi}` });
      else if (arxiv) out.push({ label: 'DOI', href: `https://arxiv.org/abs/${arxiv}` });
      if (hit.pdf) out.push({ label: 'Paper', href: hit.pdf });
      else if (arxiv) out.push({ label: 'Paper', href: `https://arxiv.org/pdf/${arxiv}` });
      if (hit.url && !out.some((l) => l.href === hit.url) && !/doi\.org|arxiv\.org/.test(hit.url)) out.push({ label: 'Website', href: hit.url });
      return out;
    }

    async function getJson(url, ms = 9000) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), ms);
      try {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(res.status === 429 ? 'busy' : `HTTP ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    }

    const fromCrossrefItem = (it) => ({
      title: stripTags(it.title?.[0]),
      authors: (it.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name).filter(Boolean),
      year: it.issued?.['date-parts']?.[0]?.[0] ?? it.published?.['date-parts']?.[0]?.[0] ?? null,
      month: it.issued?.['date-parts']?.[0]?.[1] ?? null,
      acronym: acronymOf(it.event?.acronym, it['container-title']?.[0], it.event?.name, it.institution?.[0]?.name),
      name: it['container-title']?.[0] ?? it.event?.name ?? '',
      doi: it.DOI ?? null,
    });
    const fromCrossref = (data) =>
      (data?.message?.items ?? [])
        .filter((it) => !['component', 'peer-review', 'dataset', 'grant'].includes(it.type))
        .map(fromCrossrefItem);
    const fromOpenAlex = (data) =>
      (data?.results ?? []).map((w) => {
        const where = w.primary_location ?? {};
        const name = where.source?.display_name ?? where.raw_source_name ?? '';
        return {
          title: stripTags(w.title),
          authors: (w.authorships ?? []).map((a) => a.author?.display_name).filter(Boolean),
          year: w.publication_year ?? null,
          month: Number(String(w.publication_date ?? '').slice(5, 7)) || null,
          acronym: acronymOf(name),
          name,
          doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, '') : null,
          pdf: w.open_access?.oa_url && /\.pdf($|\?)/.test(w.open_access.oa_url) ? w.open_access.oa_url : null,
        };
      });
    const fromS2Paper = (p) => ({
      title: stripTags(p.title),
      authors: (p.authors ?? []).map((a) => a.name).filter(Boolean),
      year: p.year ?? null,
      month: Number(String(p.publicationDate ?? '').slice(5, 7)) || null,
      acronym: acronymOf(p.publicationVenue?.alternate_names ?? [], p.venue, p.publicationVenue?.name, p.externalIds?.ArXiv && !p.venue ? 'arXiv' : null),
      name: p.venue || p.publicationVenue?.name || '',
      doi: p.externalIds?.DOI ?? null,
      arxiv: p.externalIds?.ArXiv ?? null,
      pdf: p.openAccessPdf?.url || null,
    });
    const fromSemanticScholar = (data) => (data?.data ?? []).map(fromS2Paper);
    const S2_FIELDS = 'title,authors,year,venue,publicationVenue,externalIds,publicationDate,openAccessPdf';

    // How well a record answers what was typed: mostly how much of its title
    // you said, a little for co-authors you named, and a real lift if it is
    // yours — this is your site.
    function rank(hit, text) {
      const said = new Set(keywords(text).filter((w) => !/^\d+$/.test(w)));
      const title = keywords(hit.title);
      if (!title.length) return 0;
      const inTitle = title.filter((w) => said.has(w)).length;
      const overlap = inTitle / Math.max(1, Math.min(said.size, title.length));
      const cover = inTitle / title.length;
      const surnames = hit.authors.filter((a) => said.has(norm(a).split(' ').at(-1))).length;
      let score = 0.6 * overlap + 0.4 * cover + Math.min(0.15, 0.05 * surnames);
      if (hit.mine) score += 0.3;
      return score;
    }

    const onPage = () => new Set([...document.querySelectorAll('article.paper h3')].map((h) => norm(textOf(h))));

    async function lookUp(text) {
      const q = text.trim();
      const doi = /\b(10\.\d{4,9}\/[^\s"<>]+)/.exec(q)?.[1]?.replace(/[.,;)]+$/, '');
      const arxiv = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})|^\s*(?:arxiv:)?([0-9]{4}\.[0-9]{4,5})(?:v\d+)?\s*$/i.exec(q);
      const arxivId = arxiv?.[1] ?? arxiv?.[2];
      let asks;
      // A DOI or an arXiv id names one paper: ask for it, not for a search.
      if (doi && !/^10\.48550\//i.test(doi)) {
        asks = [['Crossref', (d) => [fromCrossrefItem(d.message)], `https://api.crossref.org/works/${encodeURIComponent(doi)}`]];
      } else if (arxivId || doi) {
        const id = arxivId ?? doi.replace(/^10\.48550\/arxiv\./i, '');
        asks = [['Semantic Scholar', (d) => [fromS2Paper(d)], `https://api.semanticscholar.org/graph/v1/paper/arXiv:${id}?fields=${S2_FIELDS}`]];
      } else {
        const loose = encodeURIComponent(q.slice(0, 300));
        asks = [
          ['Crossref', fromCrossref,
            `https://api.crossref.org/works?query.bibliographic=${loose}&query.author=${encodeURIComponent(me())}` +
            `&rows=8&select=DOI,title,author,container-title,event,issued,published,type`],
          ['Semantic Scholar', fromSemanticScholar,
            `https://api.semanticscholar.org/graph/v1/paper/search?query=${loose}&limit=6&fields=${S2_FIELDS}`],
          ['OpenAlex', fromOpenAlex,
            `https://api.openalex.org/works?search=${loose}&per-page=6` +
            `&select=title,publication_year,publication_date,authorships,primary_location,doi,open_access`],
        ];
      }
      const exact = asks.length === 1;
      const settled = await Promise.allSettled(asks.map(([, read, url]) => getJson(url).then(read)));
      const failed = [];
      const byTitle = new Map();
      settled.forEach((result, i) => {
        const source = asks[i][0];
        if (result.status === 'rejected') { failed.push(source); return; }
        for (const hit of result.value) {
          if (!hit.title) continue;
          hit.mine = hit.authors.some(isMe);
          const key = norm(hit.title);
          const held = byTitle.get(key);
          if (!held) { byTitle.set(key, { ...hit, sources: [source] }); continue; }
          // The same paper from two indexes: keep what each knows.
          held.sources.push(source);
          held.mine ||= hit.mine;
          if (!held.acronym && hit.acronym) Object.assign(held, { acronym: hit.acronym, name: hit.name });
          held.doi ||= hit.doi;
          held.arxiv ||= hit.arxiv;
          held.pdf ||= hit.pdf;
          held.month ||= hit.month;
        }
      });
      const listed = onPage();
      const hits = [...byTitle.values()]
        .map((hit) => ({ ...hit, score: exact ? 1 : rank(hit, q), listed: listed.has(norm(hit.title)) }))
        // A record sharing one word with what you typed is noise, not a lead.
        .filter((hit) => hit.score >= 0.4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
      return { hits, failed, asked: asks.length };
    }

    // ---- asking an agent
    //
    // The indexes answer in a second but only know what they index. For the
    // rest the finder hands the question to one of the drive's agents, in one
    // conversation kept for this ("Portfolio · Paper finder") so you can open
    // it and watch. What it sends back is a list of papers, not an edit.

    const AGENT_KEY = 'portfolio:finder-agent';
    const AGENT_SEQ = 'portfolio:finder-agent-seq';
    const remembered = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
    const remember = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };

    async function drive(url, init = {}) {
      const res = await fetch(url, {
        credentials: 'same-origin',
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
      return body;
    }

    async function finderConversation() {
      const kept = remembered(AGENT_KEY);
      if (kept) {
        try {
          const { meta } = await drive(`/agent/conversations/${kept}?after=${Number(remembered(AGENT_SEQ)) || 0}`);
          if (meta && !meta.archived) return kept;
        } catch (err) {
          if (err.status !== 404) throw err;
        }
      }
      const made = await drive('/agent/conversations', {
        method: 'POST',
        body: JSON.stringify({ provider: 'claude-subscription', model: 'sonnet', effort: 'medium' }),
      });
      await drive(`/agent/conversations/${made.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Portfolio · Paper finder' }),
      }).catch(() => {});
      remember(AGENT_KEY, made.id);
      remember(AGENT_SEQ, 0);
      return made.id;
    }

    function agentPrompt(text) {
      return [
        `Find a paper for ${me()}'s academic website. What they typed about it:`,
        `"""${text}"""`,
        `Search the web for it — Google Scholar, the ACM Digital Library, DBLP, arXiv, Semantic Scholar — and work out which paper they mean. Prefer papers ${me()} is an author of.`,
        'Do not edit any document or file. Do not ask questions. Reply with nothing but one fenced ```json block of this shape:',
        '{"papers":[{"title":"","authors":["Given Family"],"year":2025,"month":5,"venue_acronym":"UIST","venue":"full venue name","doi":"","arxiv":"","pdf":"","url":"","award":"","mine":true}]}',
        'Best match first, at most 5. Authors complete and in published order. "award" only if the paper won one (e.g. "Best Paper"), otherwise "".',
      ].join('\n\n');
    }

    function papersIn(texts) {
      for (const text of [...texts].reverse()) {
        const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
        const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
        try {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : parsed.papers;
          if (Array.isArray(list)) return list;
        } catch {}
      }
      return null;
    }

    const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
    function describeStep(event) {
      if (event.type === 'turn.queued') return 'Waiting for the agent…';
      if (event.type === 'turn.started') return 'The agent is on it…';
      if (event.type !== 'tool.call') return null;
      const input = event.input ?? {};
      if (/^web_?search$/i.test(event.name) && input.query) return `Agent searching “${input.query}”`;
      if (/^web_?fetch$/i.test(event.name) && input.url) return `Agent reading ${hostOf(input.url)}…`;
      return 'The agent is working…';
    }

    async function askAgent(text, { onStep, stillWanted }) {
      const id = await finderConversation();
      const { turnId } = await drive(`/agent/conversations/${id}/turns`, {
        method: 'POST',
        body: JSON.stringify({ prompt: agentPrompt(text), context: { viewing: marble.app, target: marble.app, surface: 'chat' } }),
      });
      let after = Number(remembered(AGENT_SEQ)) || 0;
      const said = [];
      const started = Date.now();
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!stillWanted()) {
          drive(`/agent/turns/${turnId}/cancel`, { method: 'POST' }).catch(() => {});
          throw Object.assign(new Error('stopped'), { stopped: true });
        }
        if (Date.now() - started > 5 * 60_000) throw new Error('it took longer than five minutes');
        const { events = [] } = await drive(`/agent/conversations/${id}?after=${after}`);
        for (const event of events) {
          after = Math.max(after, event.seq ?? 0);
          if (event.turn !== turnId) continue;
          const step = describeStep(event);
          if (step) onStep(step);
          if (event.type === 'text') said.push(String(event.text ?? ''));
          if (event.type === 'turn.failed') throw new Error(event.error || 'its turn failed');
          if (event.type === 'turn.removed') throw Object.assign(new Error('stopped'), { stopped: true });
          if (event.type === 'turn.completed') {
            remember(AGENT_SEQ, after);
            const papers = papersIn(said);
            if (!papers) throw new Error('it answered, but not with a list of papers');
            const listed = onPage();
            return papers.filter((p) => p && p.title).map((p) => {
              const authors = (Array.isArray(p.authors) ? p.authors : String(p.authors ?? '').split(/\s*,\s*/)).map(String).filter(Boolean);
              return {
                title: stripTags(p.title), authors,
                year: Number(p.year) || null, month: Number(p.month) || null,
                acronym: acronymOf(p.venue_acronym, p.venue), name: p.venue ?? '',
                doi: p.doi ? String(p.doi).replace(/^https?:\/\/doi\.org\//, '') : null,
                arxiv: p.arxiv || null, pdf: p.pdf || null, url: p.url || null,
                award: p.award ? String(p.award).replace(/[^\p{L}\p{N}\s&'-]/gu, '').trim() : '',
                mine: Boolean(p.mine) || authors.some(isMe), sources: ['Agent'],
                listed: listed.has(norm(p.title)),
              };
            });
          }
        }
        remember(AGENT_SEQ, after);
      }
    }

    // ------------------------------------------------------------------ text

    // These live in the page and never in the file, which the carrier has no
    // way to know until it is told.
    marble.pageOnly('contenteditable', 'spellcheck');

    function wireEditable(root) {
      for (const el of within(root, '[data-marble-editable]')) {
        if (!claim(el, 'editable')) continue;

        // plaintext-only keeps the browser from injecting <div> and <br> soup
        // on Enter, so textContent stays the whole truth and setText is safe.
        el.setAttribute('contenteditable', 'plaintext-only');
        if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
        el.spellcheck = false;

        // One undo step per edit session: prior text is captured on focus, and
        // keystrokes coalesce against that same entry until blur.
        let prior = null;
        el.addEventListener('focus', () => {
          prior = marble.text(el);
        });
        el.addEventListener('input', () => {
          const id = marble.id(el);
          const text = marble.text(el);
          const op = { type: 'setText', id, text };
          if (prior !== null && text !== prior) {
            marble.record(
              { redo: [op], undo: [{ type: 'setText', id, text: prior }] },
              { coalesce: true },
            );
          }
          marble.op(op);
        });
        el.addEventListener('blur', () => {
          prior = null;
          marble.flush();
        });

        // A heading or a single line, where Enter means "done" and a newline
        // buried in the text is a mistake you can't see.
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
            event.preventDefault();
            el.blur();
          }
        });
      }
    }

    // What an empty field is for, said in the field while editing.
    const HINTS = [
      ['.venue h5:not(.award)', 'Venue'],
      ['.venue .award', 'Add an award'],
      ['.paper h3', 'Title'],
    ];
    function wireHints(root) {
      for (const [sel, hint] of HINTS) {
        for (const el of within(root, sel)) if (!el.hasAttribute('data-hint')) el.setAttribute('data-hint', hint);
      }
    }

    // What a control acts on, in words: for its label, and for the note that
    // offers a removal back.
    function describe(el, verb = 'Removed') {
      const words = (node) => clip(textOf(node), 48);
      if (el.matches('article')) return `${verb === 'Removed' ? 'Deleted' : 'Delete'} “${words(el.querySelector('h3')) || 'this publication'}”`;
      if (el.matches('.author')) return `${verb} ${words(el) || 'this name'} from the authors`;
      if (el.closest('.res')) return `${verb} the “${words(el) || 'empty'}” link`;
      if (el.closest('.links')) return `${verb} ${words(el) || 'this line'}`;
      return verb;
    }

    // It fades where it stood, then goes, and what was after it closes the
    // gap instead of jumping into it.
    const leavingItems = new WeakSet();
    function removeItem(el) {
      if (!el?.isConnected || leavingItems.has(el)) return;
      const what = describe(el, 'Removed');
      leavingItems.add(el);
      for (const s of slots) if (s.target && (s.target === el || el.contains(s.target))) hide(s);
      leave(el, () => {
        if (!el.isConnected) return;
        const rest = kids(el.parentElement).filter((c) => c !== el);
        flip(rest, () => play([{ type: 'remove', id: marble.id(el) }]));
        say(what, { undo: true });
      }, 'scale(.97)');
    }

    function toggleFlag(item, flag) {
      const id = marble.id(item);
      if (!id) return;
      // `class` holds both halves: the file's classes and the marble- ones the
      // page derives. The op writes only the file's half.
      const classes = new Set(owned(item).split(/\s+/).filter(Boolean));
      if (classes.has(flag)) classes.delete(flag);
      else classes.add(flag);
      play([{ type: 'setAttr', id, name: 'class', value: [...classes].join(' ') }]);
    }

    // ------------------------------------------------------------ adding one

    // <div class="authors" data-marble-add="#tpl-author"> — what to clone, and
    // (data-marble-into, data-marble-at) where it goes. A new name joins the
    // end of the row with its text selected; a new link asks for its address
    // first, because that is the half nobody can guess.
    function addOne(anchor) {
      const template = document.querySelector(anchor.dataset.marbleAdd);
      const into = anchor.dataset.marbleInto;
      const container = !into ? anchor : into === 'prev' ? anchor.previousElementSibling : document.querySelector(into);
      const seed = template?.content?.firstElementChild;
      if (!seed || !container) {
        console.error('[portfolio] add: missing template or list', anchor.dataset);
        return;
      }
      const node = seed.cloneNode(true);
      assignIdsIn(node);
      const before = anchor.dataset.marbleAt === 'start' ? (kids(container)[0] ?? null) : null;
      flip(kids(container), () => play([{
        type: 'insert',
        html: marble.source.outer(node),
        parentId: marble.id(container),
        beforeId: before ? marble.id(before) : null,
      }]));
      const added = marble.byId(node.getAttribute(ID));
      if (!added) return;
      if (added.matches('[data-marble-href]')) {
        requestAnimationFrame(() => openUrl(added, { fresh: true }));
        return;
      }
      const first = added.matches('[data-marble-editable]') ? added : added.querySelector('[data-marble-editable]');
      if (!first) return;
      first.focus();
      selectText(first);
    }

    // ------------------------------------------------------- where a link goes

    const urlPanel = chrome('div', 'marble-url pf-ui');
    urlPanel.setAttribute('role', 'dialog');
    urlPanel.innerHTML = `
      <input type="text" spellcheck="false" autocomplete="off" placeholder="https://… or /papers/name.pdf" aria-label="Where this link goes">
      <button type="button" class="pf-btn pf-open" title="Open it in a new tab" aria-label="Open it in a new tab">${ICON.open}</button>
      <button type="button" class="pf-set">Set</button>`;
    document.body.append(urlPanel);
    const urlField = urlPanel.querySelector('input');
    const urlOpen = urlPanel.querySelector('.pf-open');
    let hrefTarget = null;

    function openUrl(link, { fresh = false } = {}) {
      hrefTarget = link;
      urlField.value = fresh ? '' : link.getAttribute('href') ?? '';
      urlOpen.disabled = !urlField.value.trim();
      const was = urlPanel.hasAttribute('data-open');
      urlPanel.setAttribute('data-open', '');
      placeNear(urlPanel, link.getBoundingClientRect());
      if (!was) enter(urlPanel, 'translateY(-4px) scale(.97)');
      const s = slot('item');
      if (s.target === link) s.bar.setAttribute('data-pinned', '');
      urlField.focus();
      urlField.select();
    }

    function closeUrl() {
      if (!urlPanel.hasAttribute('data-open')) return;
      urlPanel.removeAttribute('data-open');
      hrefTarget = null;
      for (const s of slots) s.bar.removeAttribute('data-pinned');
      frame();
    }

    // Setting the address can name the link too: a new one says "Link" until
    // it knows where it goes, and then the label this page would give it is a
    // better guess.
    function commitHref() {
      const link = hrefTarget;
      const value = urlField.value.trim();
      closeUrl();
      const id = link && marble.id(link);
      if (!id || !value || value === link.getAttribute('href')) return;
      const ops = [{ type: 'setAttr', id, name: 'href', value }];
      const label = link.matches('[data-marble-editable]') ? link : link.querySelector('[data-marble-editable]');
      const placeholder = label && /^(link|new link)$/i.test(textOf(label));
      if (placeholder && link.closest('.res')) ops.push({ type: 'setText', id: marble.id(label), text: guessLabel(value) });
      play(ops);
      // A social link's name is not in its address; ask for it next.
      if (placeholder && !link.closest('.res')) {
        label.focus();
        selectText(label);
      }
    }

    urlField.addEventListener('input', () => (urlOpen.disabled = !urlField.value.trim()));
    urlField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); commitHref(); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeUrl(); }
    });
    urlPanel.querySelector('.pf-set').addEventListener('click', commitHref);
    urlOpen.addEventListener('click', () => {
      const value = urlField.value.trim();
      if (value) open(value, '_blank', 'noopener');
    });
    urlPanel.addEventListener('mousedown', (event) => {
      if (!event.target.closest('input')) event.preventDefault();
    });
    document.addEventListener('mousedown', (event) => {
      if (!event.target.closest('.marble-url, .pf-bar')) closeUrl();
    });

    // ------------------------------------------------------------- the layer

    const layer = chrome('div', 'pf-layer pf-ui');
    layer.removeAttribute('contenteditable');
    document.body.append(layer);

    // Page coordinates, so what is placed here scrolls with the page for free
    // and only a change of layout moves it.
    const toPage = (r) => ({ left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY, width: r.width, height: r.height });
    const rectOf = (el) => toPage(el.getBoundingClientRect());
    const grow = (r, n) => r && { left: r.left - n, top: r.top - n, right: r.right + n, bottom: r.bottom + n };
    const union = (rs) => rs.reduce((a, r) => ({
      left: Math.min(a.left, r.left), top: Math.min(a.top, r.top),
      right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom),
    }));
    const inside = (r, x, y) => Boolean(r) && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    function put(el, left, top) {
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
    }

    // What on this page has controls, and which of three places they go. A
    // pointer can be over a paper, a name in it and nothing versioned all at
    // once, so each place answers on its own: "block" is the paper or the bio
    // paragraph (a rail in the left margin), "item" is the word in a row (a
    // small bar over it, or beside a contact link), "alt" is the versions bar
    // under a versioned block.
    const KINDS = [
      { slot: 'block', kind: 'paper', sel: 'article.paper' },
      { slot: 'block', kind: 'bio', sel: '.bio > *' },
      { slot: 'block', kind: 'list', sel: '.links[data-marble-add]' },
      { slot: 'item', kind: 'author', sel: '.authors > .author' },
      { slot: 'item', kind: 'res', sel: '.res > *' },
      { slot: 'item', kind: 'contact', sel: '.links > *' },
      { slot: 'alt', kind: 'alt', sel: 'marble-alt' },
    ];
    function resolve(slotName, from) {
      for (let el = from?.nodeType === 1 ? from : from?.parentElement; el && el !== document.body; el = el.parentElement) {
        if (isTransient(el)) continue;
        if (leavingItems.has(el)) return null;
        for (const k of KINDS) {
          if (k.slot === slotName && el.matches(k.sel) && marble.id(el)) return { el, kind: k.kind };
        }
      }
      return null;
    }

    const slots = ['block', 'item', 'alt'].map((name) => {
      const ring = chrome('div', 'pf-ring');
      ring.hidden = true;
      const bar = chrome('div', 'pf-bar');
      bar.hidden = true;
      bar.setAttribute('role', 'toolbar');
      // Pressing a control is not a click into the page: the caret stays where
      // it was, and the control does not hold the focus after the pointer goes.
      bar.addEventListener('mousedown', (e) => e.preventDefault());
      layer.append(ring, bar);
      return { name, bar, ring, chips: [], target: null, kind: null, keep: null, timer: null };
    });
    const slot = (name) => slots.find((s) => s.name === name);

    function button(icon, label, run, cls = '') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pf-btn ${cls}`.trim();
      b.innerHTML = icon;
      b.title = label;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        run(e);
      });
      return b;
    }

    // Fresh controls ease in from the side that faces their item; controls
    // already up glide to the next item rather than blinking out and in.
    function show(s, hit) {
      cancelHide(s);
      const was = s.target && !s.bar.hidden && !s.leaving ? { x: parseFloat(s.bar.style.left), y: parseFloat(s.bar.style.top), kind: s.kind } : null;
      if (s.leaving) {
        s.leaving.cancel();
        s.leaving = null;
      }
      s.target = hit.el;
      s.kind = hit.kind;
      fill(s);
      place(s);
      if (s.bar.hidden) {
        // Nothing to glide.
      } else if (was && was.kind === s.kind) {
        const dx = was.x - parseFloat(s.bar.style.left);
        const dy = was.y - parseFloat(s.bar.style.top);
        if (Math.abs(dx) + Math.abs(dy) > 1) motion(s.bar, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 150 });
      } else {
        enter(s.bar, 'scale(.94)', { duration: 140 });
      }
      for (const chip of s.chips) enter(chip, 'scale(.9)', { duration: 140 });
    }

    function hide(s) {
      cancelHide(s);
      s.target = null;
      s.kind = null;
      s.keep = null;
      s.ring.hidden = true;
      s.bar.removeAttribute('data-pinned');
      for (const chip of s.chips) leave(chip, () => chip.remove(), 'scale(.9)');
      s.chips = [];
      if (s.bar.hidden || s.leaving) return;
      s.leaving = leave(s.bar, () => {
        s.leaving = null;
        if (!s.target) s.bar.hidden = true;
      }, 'scale(.96)');
      if (!s.leaving) s.bar.hidden = true;
    }

    // The grace that lets a pointer travel from a thing to its controls: they
    // stay while the pointer is anywhere in the box that holds both, and for a
    // moment after it leaves that, so a curved path or an overshoot does not
    // take them away.
    function scheduleHide(s, wait = 340) {
      if (!s.target || s.timer || s.bar.hasAttribute('data-pinned')) return;
      if (wait <= 0) return hide(s);
      s.timer = setTimeout(() => {
        s.timer = null;
        hide(s);
      }, wait);
    }
    function cancelHide(s) {
      clearTimeout(s.timer);
      s.timer = null;
    }

    function deleteLabel(t, kind) {
      if (kind === 'paper') return 'Delete this publication';
      return describe(t, 'Remove');
    }

    function fill(s) {
      const t = s.target;
      const kind = s.kind;
      s.bar.replaceChildren();
      s.bar.dataset.kind = kind;
      s.bar.dataset.for = marble.id(t);
      for (const chip of s.chips) chip.remove();
      s.chips = [];

      if (kind === 'alt') {
        fillAltBar(s);
      } else {
        if (t.parentElement?.hasAttribute('data-marble-sortable')) s.bar.append(handle(t));
        if (kind === 'paper') {
          s.bar.append(button(ICON.edit, 'Edit this publication (venue, title, authors, links, picture)', (e) => openSheet(t, null, e.currentTarget)));
        }
        if (t.matches('[data-marble-href]')) s.bar.append(button(ICON.link, 'Change where this link goes', () => openUrl(t)));
        const flag = t.parentElement?.getAttribute('data-marble-flag');
        if (flag) {
          const on = t.classList.contains(flag);
          const me = button('Me', on ? 'This name is yours, shown in bold. Click to unbold it' : 'Mark this name as yours, in bold', () => toggleFlag(t, flag), 'pf-me');
          me.setAttribute('aria-pressed', String(on));
          s.bar.append(me);
        }
        if (t.matches('[data-marble-removable]')) s.bar.append(button(ICON.trash, deleteLabel(t, kind), () => removeItem(t), 'pf-danger'));
        if (kind === 'paper') for (const row of t.querySelectorAll('[data-marble-add]')) s.chips.push(adderChip(row));
        if (kind === 'list') s.chips.push(adderChip(t));
      }
      for (const chip of s.chips) layer.append(chip);
      s.bar.hidden = !s.bar.childElementCount;
    }

    function place(s) {
      const t = s.target;
      if (!t?.isConnected) return hide(s);
      const r = rectOf(t);
      const rects = [r];
      if (!s.bar.hidden) {
        const bw = s.bar.offsetWidth;
        const bh = s.bar.offsetHeight;
        let left = r.left;
        let top = r.top;
        switch (s.kind) {
          case 'paper':
          case 'bio':
            left = r.left - bw - 6;
            break;
          // A name's bar goes above it, over the title; a link's goes below,
          // into the space under the paper. Either way it never sits on the
          // other row, where it would cover the very names or links you are
          // moving the pointer to.
          case 'author':
            left = r.left + r.width / 2 - bw / 2;
            top = r.top - bh + 2;
            break;
          case 'res':
            left = r.left + r.width / 2 - bw / 2;
            top = r.bottom - 2;
            break;
          case 'contact':
            left = r.right + 4;
            top = r.top + (r.height - bh) / 2;
            break;
          case 'alt':
            left = r.left - 9;
            top = r.bottom - 2;
            break;
        }
        // Inside the room the drive's shell leaves, not merely the window.
        const space = room();
        const minX = scrollX + space.left + 4;
        const maxX = scrollX + space.right - 4;
        left = Math.max(minX, Math.min(left, maxX - bw));
        put(s.bar, left, top);
        rects.push({ left, top, right: left + bw, bottom: top + bh });
      }
      for (const chip of s.chips) {
        const c = placeChip(chip);
        if (c) rects.push(c);
      }
      s.keep = grow(union(rects), 12);
      put(s.ring, r.left - 4, r.top - 4);
      s.ring.style.width = `${r.width + 8}px`;
      s.ring.style.height = `${r.height + 8}px`;
    }

    // ---- "+ Author", "+ Link": at the end of the row they add to

    function adderChip(row) {
      const noun = row.matches('.authors') ? 'Author' : 'Link';
      const chip = chrome('button', 'pf-chip', `${ICON.plus}<span>${noun}</span>`);
      chip.type = 'button';
      chip.title = row.getAttribute('data-marble-instruction') ?? `Add ${noun.toLowerCase()}`;
      chip.setAttribute('aria-label', chip.title);
      chip.pfRow = row;
      chip.dataset.for = marble.id(row.closest('article') ?? row);
      chip.addEventListener('mousedown', (e) => e.preventDefault());
      chip.addEventListener('click', () => addOne(row));
      return chip;
    }

    function placeChip(chip) {
      const row = chip.pfRow;
      if (!row?.isConnected) {
        chip.hidden = true;
        return null;
      }
      chip.hidden = false;
      const items = kids(row);
      const last = items[items.length - 1];
      const rr = rectOf(row);
      const cw = chip.offsetWidth;
      const ch = chip.offsetHeight;
      let left = rr.left;
      let top = rr.top;
      if (row.matches('.links')) {
        const lr = last ? rectOf(last) : rr;
        left = lr.left;
        top = lr.bottom + 4;
      } else if (last) {
        const lr = rectOf(last);
        left = lr.right + 10;
        top = lr.top + (lr.height - ch) / 2;
        // No room at the end of the line: start the next one.
        if (left + cw > rr.right + 40) {
          left = rr.left;
          top = lr.bottom + 2;
        }
      }
      put(chip, left, top);
      return { left, top, right: left + cw, bottom: top + ch };
    }

    // ---- "+ Add" beside a list's heading: always there while editing

    const heads = new Map();
    function wireHeads(root) {
      for (const h of within(root, '[data-paper-list]')) {
        if (heads.has(h)) continue;
        const chip = chrome('button', 'pf-chip pf-head', `${ICON.plus}<span>Add</span>`);
        chip.type = 'button';
        chip.title = `Add a publication to “${textOf(h)}”`;
        chip.setAttribute('aria-label', chip.title);
        chip.addEventListener('click', () => openSheet(null, document.querySelector(h.getAttribute('data-paper-list')), chip));
        layer.append(chip);
        heads.set(h, chip);
      }
    }
    function placeHeads() {
      for (const [h, chip] of heads) {
        if (!h.isConnected) {
          chip.remove();
          heads.delete(h);
          continue;
        }
        // At the end of the heading's words, not of its box.
        const range = document.createRange();
        range.selectNodeContents(h);
        const lines = [...range.getClientRects()].filter((r) => r.width);
        const end = lines.length ? toPage(lines[lines.length - 1]) : rectOf(h);
        put(chip, end.right + 12, end.top + (end.height - chip.offsetHeight) / 2);
      }
    }

    // ---- versions: the bar under a versioned block

    function fillAltBar(s) {
      const alt = s.target;
      const current = activeIn(alt);
      const what = document.createElement('span');
      what.className = 'pf-what';
      what.textContent = whatOf(alt);
      s.bar.append(what);
      for (const v of versionsOf(alt)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `pf-v${isEmpty(v) ? ' pf-hidden' : ''}`;
        b.textContent = labelOf(v);
        b.title = `${v === current ? 'On the site now' : 'Show this on the site'}: ${preview(v)}`;
        b.setAttribute('aria-pressed', String(v === current));
        b.addEventListener('click', () => setActive(alt, nameOf(v)));
        s.bar.append(b);
      }
      s.bar.append(Object.assign(document.createElement('span'), { className: 'pf-sep' }));
      const add = button(ICON.plus, 'New version, starting as a copy of the one showing', () => addVersion(alt));
      add.disabled = !nextName(alt);
      s.bar.append(add);
      if (!versionsOf(alt).some(isEmpty)) s.bar.append(button(ICON.eyeOff, 'Hide this on the site, keeping every version', () => hideBlock(alt)));
      s.bar.append(button(ICON.list, 'Every version, with what each one says', () => openVersions(alt, s.bar)));
    }

    // A block whose showing version is the empty one has no box to point at,
    // so while editing it gets a line saying what is hidden there.
    function deriveAlts(root) {
      for (const alt of within(root, 'marble-alt')) {
        let ghost = [...alt.children].find((c) => c.classList.contains('st-ghost'));
        if (!ghost) {
          ghost = chrome('div', 'st-ghost pf-ui');
          alt.append(ghost);
        }
        const current = activeIn(alt);
        alt.toggleAttribute('data-st-empty', Boolean(current && isEmpty(current)));
        ghost.textContent = `${whatOf(alt)} · hidden`;
        ghost.title = 'Nothing shows here on the site. Point at it for its versions.';
      }
    }

    // ---- following the pointer

    let pointer = null;
    let frameQueued = false;
    const FLOATING = '.st-pop, .pf-card, .marble-url, .marble-rt, .marble-lk, .marble-gal, .st-notes';

    function layout() {
      for (const s of slots) if (s.target) place(s);
      placeHeads();
      placeCard();
      if (urlPanel.hasAttribute('data-open') && hrefTarget?.isConnected) placeNear(urlPanel, hrefTarget.getBoundingClientRect());
      if (pop.hasAttribute('data-open')) {
        const s = slot('alt');
        if (s.target === popAnchor && !s.bar.hidden) placeNear(pop, s.bar.getBoundingClientRect());
      }
    }

    function frame() {
      if (frameQueued) return;
      frameQueued = true;
      requestAnimationFrame(() => {
        frameQueued = false;
        layout();
        sense();
      });
    }

    function sense() {
      if (drag || !pointer) return;
      const under = document.elementFromPoint(pointer.x, pointer.y);
      if (!under) return;
      const x = pointer.x + scrollX;
      const y = pointer.y + scrollY;
      const onLayer = under.closest('.pf-layer');
      const onFloating = under.closest(FLOATING);
      let ringFor = null;
      for (const s of slots) {
        const hit = onLayer || onFloating ? null : resolve(s.name, under);
        if (hit) {
          cancelHide(s);
          if (hit.el !== s.target) show(s, hit);
          continue;
        }
        if (!s.target) continue;
        const mine = onLayer && (s.bar.contains(under) || s.chips.some((c) => c.contains(under)));
        if (mine) {
          cancelHide(s);
          if (s.bar.contains(under)) ringFor = s;
        } else if (inside(s.keep, x, y)) {
          cancelHide(s);
        } else {
          scheduleHide(s, pointer.touch ? 0 : 340);
        }
      }
      // Pointing at a control outlines what it will act on; red for delete.
      for (const s of slots) {
        const on = s === ringFor && s.kind !== 'alt' && !sheet.hasAttribute('data-open');
        s.ring.hidden = !on;
        s.ring.classList.toggle('pf-danger', on && Boolean(under.closest('.pf-danger')));
      }
    }

    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      pointer = { x: e.clientX, y: e.clientY, touch: false };
      frame();
    }, { passive: true });
    // No hover on a touch screen: a tap is the pointing.
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      pointer = { x: e.clientX, y: e.clientY, touch: true };
      sense();
    }, { capture: true, passive: true });
    addEventListener('scroll', frame, { passive: true });
    addEventListener('resize', frame);
    document.documentElement.addEventListener('mouseleave', () => {
      pointer = null;
      for (const s of slots) scheduleHide(s);
    });
    // The keyboard points too: whatever holds the caret shows its controls.
    document.addEventListener('focusin', (e) => {
      if (drag || e.target.closest?.('.pf-layer') || e.target.closest?.(FLOATING)) return;
      for (const s of slots) {
        const hit = resolve(s.name, e.target);
        if (!hit) continue;
        if (hit.el !== s.target) show(s, hit);
        else cancelHide(s);
      }
    });
    document.addEventListener('input', frame);
    new ResizeObserver(frame).observe(document.body);
    document.fonts?.ready.then(frame);

    // Redrawn from the file's state after anything changes it: a control here,
    // an undo, another tab, an agent's write.
    let refreshQueued = false;
    function refresh() {
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        deriveAlts(document.body);
        for (const s of slots) {
          if (!s.target) continue;
          if (!s.target.isConnected) hide(s);
          else fill(s);
        }
        if (pop.hasAttribute('data-open')) {
          if (popAnchor?.isConnected) fillVersions(popAnchor);
          else closeVersions();
        }
        layout();
        sense();
      });
    }
    document.addEventListener('marble:history', refresh);

    // ---- a drag

    let drag = null;

    function handle(item) {
      const b = button(ICON.grip, 'Drag to move (or ⌘⇧↑ / ⌘⇧↓ while typing in it)', () => {}, 'pf-handle');
      b.setAttribute('aria-label', 'Move');
      b.addEventListener('pointerdown', (e) => startDrag(e, item));
      return b;
    }

    function dragLabel(item) {
      if (item.matches('article')) return textOf(item.querySelector('h3')) || 'Publication';
      if (item.matches('marble-alt')) return whatOf(item);
      return textOf(item) || 'Item';
    }

    // Which lists an item may land in: any list of its group, except that a
    // name or a link stays inside its own paper.
    function landing(item, from, group) {
      const under = document.elementFromPoint(drag.x, drag.y);
      let container = under?.closest(`[data-marble-sortable="${CSS.escape(group)}"]`);
      if (!container || isTransient(container)) container = item.parentElement;
      if (container !== from.parent && from.parent.closest('article')) container = item.parentElement;
      return container;
    }

    function markTargets(group, from) {
      if (from.closest('article')) return;
      for (const c of document.querySelectorAll(`[data-marble-sortable="${CSS.escape(group)}"]`)) {
        if (c !== from) c.classList.add('marble-drop');
      }
    }
    function clearTargets() {
      for (const c of document.querySelectorAll('.marble-drop')) c.classList.remove('marble-drop');
    }

    function startDrag(e, item) {
      if (e.button !== 0 || !item.isConnected) return;
      e.preventDefault();
      const from = { parent: item.parentElement, before: nextPersistentSibling(item) };
      const group = from.parent.getAttribute('data-marble-sortable');
      drag = { item, from, group, x: e.clientX, y: e.clientY, raf: 0 };
      try { document.documentElement.setPointerCapture(e.pointerId); } catch {}
      for (const s of slots) hide(s);
      closeUrl();
      item.classList.add('marble-dragging');
      document.documentElement.classList.add('marble-drag');
      markTargets(group, from.parent);
      drag.ghost = chrome('div', 'pf-ghost');
      drag.ghost.textContent = clip(dragLabel(item), 60);
      layer.append(drag.ghost);
      moveGhost();
      addEventListener('pointermove', onDragMove);
      addEventListener('pointerup', onDragUp);
      addEventListener('pointercancel', onDragCancel);
      drag.raf = requestAnimationFrame(autoScroll);
    }

    function moveGhost() {
      put(drag.ghost, drag.x + scrollX + 14, drag.y + scrollY + 12);
    }

    // The item itself moves through the list as the pointer passes each
    // neighbour's middle — down a column by height, along a row by width.
    function reposition() {
      const { item, from, group } = drag;
      const container = landing(item, from, group);
      const row = getComputedStyle(container).flexDirection.startsWith('row');
      const others = kids(container).filter((c) => c !== item);
      const before = others.find((c) => {
        const r = c.getBoundingClientRect();
        return row
          ? drag.y < r.top || (drag.y <= r.bottom && drag.x < r.left + r.width / 2)
          : drag.y < r.top + r.height / 2;
      }) ?? null;
      if (item.parentElement !== container || nextPersistentSibling(item) !== before) {
        const touched = [...new Set([item.parentElement, container])].flatMap((p) => kids(p));
        flip(touched, () => container.insertBefore(item, before));
      }
    }

    function autoScroll() {
      if (!drag) return;
      const edge = 72;
      let dy = 0;
      if (drag.y < edge) dy = -Math.ceil((edge - drag.y) / 4);
      else if (drag.y > innerHeight - edge) dy = Math.ceil((drag.y - (innerHeight - edge)) / 4);
      if (dy) {
        scrollBy(0, dy);
        reposition();
        moveGhost();
      }
      drag.raf = requestAnimationFrame(autoScroll);
    }

    function onDragMove(e) {
      drag.x = e.clientX;
      drag.y = e.clientY;
      moveGhost();
      reposition();
    }
    const onDragUp = () => finishDrag(true);
    const onDragCancel = () => finishDrag(false);

    function finishDrag(commit) {
      if (!drag) return;
      const { item, from, ghost } = drag;
      cancelAnimationFrame(drag.raf);
      removeEventListener('pointermove', onDragMove);
      removeEventListener('pointerup', onDragUp);
      removeEventListener('pointercancel', onDragCancel);
      item.classList.remove('marble-dragging');
      document.documentElement.classList.remove('marble-drag');
      clearTargets();
      ghost.remove();
      drag = null;
      if (!commit) {
        from.parent.insertBefore(item, from.before);
      } else {
        // The page already moved, live, as the pointer went; this files where
        // it came to rest.
        const parent = item.parentElement;
        const before = nextPersistentSibling(item);
        if (parent !== from.parent || before !== from.before) {
          const id = marble.id(item);
          const op = { type: 'move', id, parentId: marble.id(parent), beforeId: before ? marble.id(before) : null };
          const inverse = { type: 'move', id, parentId: marble.id(from.parent), beforeId: from.before ? marble.id(from.before) : null };
          marble.record({ redo: [op], undo: [inverse] });
          marble.op(op, { immediate: true });
        }
      }
      frame();
    }

    // The keyboard's drag: ⌘⇧↑ / ⌘⇧↓ moves whatever holds the caret one place.
    function nudge(item, step) {
      const list = kids(item.parentElement);
      const to = list.indexOf(item) + step;
      if (to < 0 || to >= list.length) return;
      const before = step < 0 ? list[to] : (list[to + 1] ?? null);
      const focused = document.activeElement;
      flip(list, () => play([{ type: 'move', id: marble.id(item), parentId: marble.id(item.parentElement), beforeId: before ? marble.id(before) : null }]));
      if (focused?.isConnected) {
        focused.focus();
        caretToEnd(focused);
      }
      item.scrollIntoView({ block: 'nearest' });
      frame();
    }

    // ------------------------------------------------------------------ keys

    // Undo/redo is a carrier capability; binding the keys is the page's call.
    // Native inputs keep the browser's own undo.
    addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (drag) { event.preventDefault(); finishDrag(false); return; }
        if (urlPanel.hasAttribute('data-open')) { closeUrl(); return; }
        if (pop.hasAttribute('data-open')) { closeVersions(); return; }
        if (sheet.hasAttribute('data-open')) { tryClose(); return; }
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;
      const target = event.target;

      if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        const item = target.closest?.('[data-marble-sortable] > :not([data-marble-transient])');
        if (item && marble.id(item) && !target.closest('input, textarea')) {
          event.preventDefault();
          nudge(item, event.key === 'ArrowUp' ? -1 : 1);
        }
        return;
      }

      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable &&
          !target.closest('[data-marble-editable], [data-marble-rich]'))
      ) {
        return;
      }
      // A staged proposal is not history yet — Mod+Z discards it instead.
      if (isUndo && typeof marble.discardStaged === 'function' && marble.discardStaged()) {
        event.preventDefault();
        return;
      }
      if (isUndo && marble.canUndo) {
        event.preventDefault();
        marble.undo();
      } else if (isRedo && marble.canRedo) {
        event.preventDefault();
        marble.redo();
      }
    });

    // ------------------------------------------------------------ wiring

    marble.address(document.querySelectorAll(ADDRESSABLE));

    // Runs now over the document as it stands, and again over anything that
    // arrives later — an insert, an accepted proposal, an edit made to the
    // file in another window.
    // Something arriving after the page is up — a paper added, a removal
    // undone, another tab's insert — fades in where it lands.
    let booted = false;
    const ARRIVING = 'article.paper, .authors > *, .res > *, .links > *';
    marble.register((root) => {
      wireEditable(root);
      wireHints(root);
      wireHeads(root);
      if (booted && root.matches?.(ARRIVING) && !isTransient(root)) enter(root, 'translateY(6px)', { duration: 220 });
      refresh();
    });
    requestAnimationFrame(() => (booted = true));
  };

  // The carrier is injected after the document has been parsed, so this waits
  // rather than the other way round. No carrier, no editor: the page is still
  // a page you can read, it just isn't one you can change.
  if (window.marble) begin(window.marble);
  else addEventListener('marble:ready', (event) => begin(event.detail), { once: true });
})();
