// Part of the home feature: the quick-thought line under Create. Faint words, "Note down a messy
// thought…",
// and nothing else: no box, no buttons. It is a plain text field underneath, so every ordinary
// text key works (arrows, selection, Backspace, Ctrl+Z, copy and paste).
//
// - Typing anywhere on Home (no field chosen, no pop-up open) starts writing here.
// - Enter drops the thought (`drop(text)`, true when it went): the words fade, and the line is
//   empty and ready again. Ctrl+Enter (Cmd+Enter) puts a new line in; the line grows to hold it.
// - Escape lets go of the line, keeping its words.
//
// quickLine({ drop(text) → bool, live() → whether Home shows }) → { el, focus() }

import { ui } from 'folio';

const { el } = ui;
const FADE_MS = 420;

export function quickLine({ drop, live }) {
  const field = el('textarea', { class: 'home-quick', rows: 1, spellcheck: 'true', placeholder: 'Note down a messy thought…',
    'aria-label': 'A quick thought, dropped in Messy thoughts', 'data-hint': 'Enter drops it in Messy thoughts · Ctrl+Enter new line' });

  const fit = () => { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px`; };
  field.addEventListener('input', fit);

  field.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mod) { field.setRangeText('\n', field.selectionStart, field.selectionEnd, 'end'); fit(); return; }
      const text = field.value.trim();
      if (!text || field.classList.contains('dropping') || !drop(text)) return;
      field.classList.add('dropping');
      setTimeout(() => { field.value = ''; fit(); field.classList.remove('dropping'); }, FADE_MS);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); field.blur(); }
  });

  // A letter typed anywhere on Home lands here: the line takes the focus before the key does.
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const a = document.activeElement;
    if (a === field || a?.matches?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (!field.isConnected || !live()) return;
    field.focus();
  });

  return { el: field, focus: () => field.focus() };
}
