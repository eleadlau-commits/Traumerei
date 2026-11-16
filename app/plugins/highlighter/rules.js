// Highlighter's rules: plain functions that don't need the screen, so tests can check them.
// Written from app/core/API.md alone by an author who had read nothing else (API 3 freeze check).

export const KIND = 'mark-up';
const WORD = /[\p{L}\p{N}_'’-]/u;
const CAPS = /(?<![\p{L}\p{N}])\p{Lu}{2,}(?![\p{L}\p{N}])/gu;

// The thoughts of a room (not groups, not rooms nested in it).
export const thoughtsIn = (t, context) =>
  (t.marks.in(context) || []).filter((m) => m.kind !== 'group' && m.kind !== 'room' && m.kind !== 'context');

export const carriesMarkUp = (m) => Array.isArray(m.spans) && m.spans.some((s) => s.kind === KIND && s.to > s.from);

// The selection, or the word around the caret when nothing is selected.
export function rangeAtCaret(c) {
  if (c.from !== c.to) return [Math.min(c.from, c.to), Math.max(c.from, c.to)];
  const text = c.text || '';
  let from = c.from, to = c.to;
  while (from > 0 && WORD.test(text[from - 1])) from--;
  while (to < text.length && WORD.test(text[to])) to++;
  return from === to ? null : [from, to];
}

// Words in ALL CAPITALS (two letters or more), drawn with `caps`.
export function capitals(text) {
  const out = [];
  if (!text) return out;
  for (const m of text.matchAll(CAPS)) out.push({ from: m.index, to: m.index + m[0].length, class: 'caps' });
  return out;
}

export const countLine = (n) => (n ? `${n} highlighted thought${n === 1 ? '' : 's'}` : '');

export const fileName = (title) => `${String(title).replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'room'}.md`;
