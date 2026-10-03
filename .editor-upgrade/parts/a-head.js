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
