// The source editor: a thing's source as plain text (room Markdown, from the roomfile feature) in
// the side panel. Whoever opens it gives the text and two functions: check(text), which says what
// the text holds and what Apply would do, and apply(text), which does it. This feature knows
// nothing of rooms or Markdown; it is the box, the quiet lines above it and the words below it.
// Other features use it only through the `source` service (README.md lists it).

import { Feature, ui } from 'folio';
import { unfence } from './unfence.js';

const { el } = ui;
const CHECK = 220; // ms after the last key before the text is checked again
const SHOWN = 12;  // lines of a list shown before "and n more"

export default class Source extends Feature {
  start() {
    this.panel = this.use('panel');
    this.provide('source', {
      open: (o) => this.open(o),
      close: () => this.handle?.close() ?? Promise.resolve(true),
      isOpen: () => !!this.handle?.open,
      unfence,
    });
  }

  // Opens the editor in the panel. Resolves once it closes: true when Apply was used, else false.
  open({ kind = 'Source', title = '', text = '', readOnly = false, fileName = 'source.md', options = [],
    check = () => ({}), apply = null, full = (t) => t, reset = null } = {}) {
    return new Promise((resolve) => {
      let applied = false, base = text, timer = 0, asking = null;
      const chosen = Object.fromEntries(options.map((o) => [o.key, !!o.value]));
      const box = el('textarea', { class: 'code-box source-text', spellcheck: 'false', autocomplete: 'off', wrap: 'off', 'aria-label': title || 'Source', readonly: readOnly ? '' : null });
      box.value = text;
      const sum = el('div', { class: 'source-sum', 'aria-live': 'polite' });
      const lists = el('div', { class: 'source-lists' });
      const opts = el('div', { class: 'source-options' });
      const changed = () => box.value !== base;
      const say = (msg) => { sum.dataset.note = msg; sum.classList.add('noted'); clearTimeout(this.noteTimer); this.noteTimer = setTimeout(() => sum.classList.remove('noted'), 1800); };
      const list = (label, items, cls) => (items?.length ? el('section', { class: 'source-list ' + cls },
        el('div', { class: 'label' }, label),
        el('ul', {}, ...items.slice(0, SHOWN).map((t) => el('li', {}, t)), items.length > SHOWN ? el('li', { class: 'source-more' }, `and ${items.length - SHOWN} more`) : null)) : null);
      const run = () => {
        let r = {};
        try { r = check(unfence(box.value), { ...chosen }) || {}; } catch (err) { r = { report: [`The text couldn't be checked: ${err.message}`] }; }
        sum.textContent = [r.summary, changed() ? 'changed' : ''].filter(Boolean).join(' · ');
        lists.replaceChildren(...[
          list(readOnly ? 'In it' : 'Apply will', r.changes, 'source-changes'),
          list('Couldn\'t be read', r.report, 'source-report'),
        ].filter(Boolean));
        opts.replaceChildren(...(readOnly ? [] : (r.options || options).filter((o) => o.show !== false).map((o) => el('label', { class: 'source-option' },
          el('input', { type: 'checkbox', checked: chosen[o.key] ? '' : null, onchange: (e) => { chosen[o.key] = e.target.checked; run(); } }), ` ${o.label}`))));
        go && (go.disabled = !!r.blocked);
      };
      const soon = () => { clearTimeout(timer); timer = setTimeout(run, CHECK); };
      box.addEventListener('input', soon);
      box.addEventListener('keydown', (e) => {
        // A tab is two spaces (room Markdown indents with spaces).
        if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !readOnly) { e.preventDefault(); box.setRangeText('  ', box.selectionStart, box.selectionEnd, 'end'); soon(); }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !readOnly && apply) { e.preventDefault(); doApply(); }
      });

      const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'word ' + extra, onclick: fn }, label);
      const copy = async () => {
        try { await navigator.clipboard.writeText(box.value); say('Copied'); } catch { box.select(); say('Press Ctrl+C to copy'); }
      };
      const download = () => {
        const url = URL.createObjectURL(new Blob([full(box.value)], { type: 'text/markdown;charset=utf-8' }));
        const a = el('a', { href: url, download: fileName, hidden: true });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        say(`Downloaded ${fileName}`);
      };
      const paste = async () => {
        let t;
        try { t = await navigator.clipboard.readText(); } catch { box.focus(); say('Press Ctrl+V to paste into the box'); return; }
        if (!t) { say('The clipboard is empty'); return; }
        box.value = unfence(t);
        run();
        say('Pasted');
      };
      const doReset = () => {
        if (reset) base = reset();
        box.value = base;
        run();
        say('Back to what it holds now');
      };
      const doApply = async () => {
        if (!apply || go.disabled) return;
        go.disabled = true;
        let ok = false;
        try { ok = await apply(unfence(box.value), { ...chosen }); } catch (err) { console.warn('Source: apply', err); say('That couldn\'t be applied'); }
        go.disabled = false;
        if (!ok) { run(); return; }
        applied = true;
        handle?.close(true);
      };
      const go = readOnly || !apply ? null : word('Apply', doApply, 'source-go');
      // Closing with changes asks first, in a line at the foot.
      const ask = el('div', { class: 'source-ask', hidden: true });
      const beforeClose = () => {
        if (applied || readOnly || !changed()) return true;
        if (asking) return false;
        return new Promise((res) => {
          asking = res;
          const done = (yes) => { ask.hidden = true; asking = null; res(yes); if (!yes) box.focus(); };
          ask.replaceChildren(el('span', {}, 'Close without applying your changes?'),
            word('Close', () => done(true), 'source-go'), word('Keep editing', () => done(false)));
          ask.hidden = false;
          ask.querySelector('button').focus();
        });
      };
      const body = el('div', { class: 'source', onkeydown: (e) => { if (e.key === 'Escape' && asking) { e.preventDefault(); e.stopPropagation(); ask.hidden = true; const r = asking; asking = null; r(false); box.focus(); } } },
        sum, lists, box, opts,
        el('div', { class: 'source-words' },
          word('Copy', copy),
          word('Download', download),
          ...(readOnly ? [el('span', { class: 'sheet-keys' }, 'Read only')] : [word('Paste', paste), word('Reset', doReset), go,
            el('span', { class: 'sheet-keys' }, 'Ctrl+Enter applies · Escape closes')])),
        ask);
      let handle = null;
      this.panel.open({ key: 'source', kind, title, body, beforeClose, onClose: () => { clearTimeout(timer); if (this.handle === handle) this.handle = null; resolve(applied); } })
        .then((h) => {
          if (!h) { resolve(false); return; }
          handle = this.handle = h;
          run();
          box.focus({ preventScroll: true });
          box.setSelectionRange(0, 0);
          box.scrollTop = 0;
        });
    });
  }
}
