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
