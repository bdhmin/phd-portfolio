
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
