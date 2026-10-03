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

