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
    `;