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

