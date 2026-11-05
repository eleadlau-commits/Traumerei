// Mathematics in a thought's words: $…$ is inline maths and $$…$$ is display maths, on a line of
// its own. \$ is a dollar sign. The words are kept as typed (the LaTeX source); only the drawing
// changes, so search, peeks and the Timeline still read the source, and writing shows the source.
//
// Every item's node() (and a closed group's) draws its words with maths(text), so a new kind of
// item gets mathematics for free. KaTeX (vendor/, MIT, its fonts inside its CSS) draws them at
// once, so whatever measures a thought after drawing (Joyce, clear.js) sees its real size.
//
// When does a $ open? As in Pandoc: an opening $ has something other than a space just after it,
// and the closing $ has something other than a space just before it and no digit just after it
// (so "$5 and $6" stays words). Inline maths stays on one line; display maths may span lines.
// A $ that never closes, and an empty $$ $$, stay as words.

import katex from './vendor/katex.js';

const SPACE = /\s/;
const DIGIT = /[0-9]/;

// The words cut into pieces: { type: 'text' | 'inline' | 'display', value }. Text has \$ made $;
// maths is the source between its dollars, as written.
export function split(text) {
  const s = String(text ?? '');
  const out = [];
  let words = '';
  const flush = () => { if (words) out.push({ type: 'text', value: words }); words = ''; };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '$') { words += '$'; i += 2; continue; }
    if (c !== '$') { words += c; i += 1; continue; }
    if (s[i + 1] === '$') { // $$ … $$
      const end = closing(s, i + 2, true);
      if (end > 0 && s.slice(i + 2, end).trim()) {
        flush();
        out.push({ type: 'display', value: s.slice(i + 2, end) });
        i = end + 2;
      } else { words += '$$'; i += 2; }
      continue;
    }
    const end = SPACE.test(s[i + 1] ?? ' ') ? -1 : closing(s, i + 1, false);
    if (end > 0) {
      flush();
      out.push({ type: 'inline', value: s.slice(i + 1, end) });
      i = end + 1;
    } else { words += '$'; i += 1; }
  }
  flush();
  return out;
}

// Where the maths that starts at `from` closes (the index of its closing $ or $$), or -1.
function closing(s, from, display) {
  for (let k = from; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') { k += 1; continue; } // \$, \\ and the like belong to the maths
    if (display) { if (c === '$' && s[k + 1] === '$') return k; continue; }
    if (c === '\n') return -1;
    if (c === '$' && !SPACE.test(s[k - 1]) && !DIGIT.test(s[k + 1] ?? '')) return k;
  }
  return -1;
}

// The formulas in some words that KaTeX can't draw: [{ tex, display, line }], line counted from 0
// within the words. (The roomfile feature's Markdown window lists them before anything changes.)
export function broken(text) {
  const s = String(text ?? '');
  if (!s.includes('$')) return [];
  const out = [];
  let from = 0;
  for (const p of split(s)) {
    if (p.type === 'text') continue;
    const open = p.type === 'display' ? '$$' : '$';
    const at = s.indexOf(open + p.value, from);
    if (at >= 0) from = at + open.length + p.value.length;
    try {
      katex.renderToString(p.value, { displayMode: p.type === 'display', throwOnError: true, strict: 'ignore' });
    } catch {
      out.push({ tex: p.value, display: p.type === 'display', line: at < 0 ? 0 : (s.slice(0, at).match(/\n/g) || []).length });
    }
  }
  return out;
}

// Formulas already drawn, as HTML (a room is redrawn after every change).
const DRAWN = new Map();
const KEEP = 800;

function formula(tex, display) {
  const key = (display ? 'D' : 'I') + tex;
  let html = DRAWN.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: 'ignore', output: 'htmlAndMathml' });
    } catch {
      html = null; // doesn't parse: shown as its source, quietly
    }
    if (DRAWN.size >= KEEP) DRAWN.clear();
    DRAWN.set(key, html);
  }
  const node = document.createElement('span');
  node.className = 'room-maths' + (display ? ' display' : '');
  if (html === null) {
    node.classList.add('unparsed');
    node.textContent = display ? `$$${tex}$$` : `$${tex}$`;
    node.title = 'This formula doesn\'t parse';
  } else node.innerHTML = html;
  return node;
}

// The words to draw: the text itself when it holds no maths, or a list of strings and nodes.
// The line break just before and after display maths is its own line, so it is left out.
export function maths(text) {
  const s = String(text ?? '');
  if (!s.includes('$')) return s;
  const parts = split(s);
  return parts.map((p, n) => {
    if (p.type !== 'text') return formula(p.value, p.type === 'display');
    let v = p.value;
    if (parts[n - 1]?.type === 'display') v = v.replace(/^[ \t]*\n/, '');
    if (parts[n + 1]?.type === 'display') v = v.replace(/\n[ \t]*$/, '');
    return v;
  }).filter((p) => p !== '');
}
