// Reading notes: BibTeX and BibLaTeX in and out, as plain functions. Reading takes the entries'
// metadata (never an abstract or any text of the work) into a source's fields; writing gives each
// source as an entry under its citation key. Zotero's metadata comes in this way (Export → BibTeX
// or Better BibLaTeX). Tested in tests/bibtex.test.js.

// Entry types, BibTeX and BibLaTeX → a source's type, and back.
const IN_TYPE = { book: 'book', mvbook: 'book', booklet: 'book', collection: 'book', proceedings: 'book', article: 'article', periodical: 'article',
  incollection: 'chapter', inbook: 'chapter', inproceedings: 'chapter', conference: 'chapter', online: 'web', www: 'web', electronic: 'web',
  phdthesis: 'thesis', mastersthesis: 'thesis', thesis: 'thesis', techreport: 'report', report: 'report' };
const OUT_TYPE = { book: 'book', article: 'article', chapter: 'incollection', web: 'online', thesis: 'phdthesis', report: 'techreport', other: 'misc' };

// LaTeX accents and escapes to plain letters ({\"o} → ö, \& → &, {Darwin} → Darwin).
const ACCENT = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', '=': '̄', '.': '̇', u: '̆', v: '̌', H: '̋', c: '̧', k: '̨', r: '̊' };
const SPECIAL = { ss: 'ß', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', l: 'ł', L: 'Ł', i: 'ı' };
export function unlatex(s) {
  let out = String(s ?? '');
  out = out.replace(/\{?\\([`'"^~=.uvHckr])\s*\{?([A-Za-z]|\\i)\}?\}?/g, (_, a, ch) => (ch === '\\i' ? 'i' : ch) + ACCENT[a]);
  out = out.replace(/\{?\\(ss|ae|AE|oe|OE|aa|AA|o|O|l|L|i)\b\s*\}?/g, (_, w) => SPECIAL[w]);
  out = out.replace(/\\([&%$#_{}])/g, '$1').replace(/---/g, '—').replace(/--/g, '–').replace(/~/g, ' ');
  out = out.replace(/\\(textit|emph|textbf|textsc|mkbibquote|enquote)\s*\{([^{}]*)\}/g, '$2');
  out = out.replace(/[{}]/g, '');
  return out.normalize('NFC').replace(/\s+/g, ' ').trim();
}
// Plain words to BibTeX's own: & % $ # _ escaped, braces kept as they are not.
const latex = (s) => String(s ?? '').replace(/([&%$#_])/g, '\\$1').replace(/[{}]/g, '');

// ---- Reading ----

// The entries of a .bib file: [{ type, key, fields: { name: value } }]; @string macros used,
// @comment and @preamble skipped. A broken entry is skipped, never the file.
export function parseBib(text) {
  const s = String(text || '');
  const macros = { jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June', jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December' };
  const out = [];
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  // A value: "…", {…} (nested braces) or a bare word or number, joined with #.
  const value = () => {
    let v = '';
    for (;;) {
      ws();
      if (s[i] === '{') { let d = 0, j = i; for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; } if (j >= s.length) throw new Error('unclosed'); v += s.slice(i + 1, j); i = j + 1; }
      else if (s[i] === '"') { let d = 0, j = i + 1; for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') d--; else if (s[j] === '"' && d === 0 && s[j - 1] !== '\\') break; } v += s.slice(i + 1, j); i = j + 1; }
      else { const m = /^[^\s,#}]+/.exec(s.slice(i)); if (!m) break; const w = m[0]; v += macros[w.toLowerCase()] ?? w; i += w.length; }
      ws();
      if (s[i] === '#') { i++; continue; }
      return v;
    }
    return v;
  };
  while (i < s.length) {
    const at = s.indexOf('@', i);
    if (at < 0) break;
    i = at + 1;
    const m = /^([A-Za-z]+)\s*([{(])/.exec(s.slice(i));
    if (!m) continue;
    const type = m[1].toLowerCase();
    i += m[0].length;
    const close = m[2] === '{' ? '}' : ')';
    if (type === 'comment' || type === 'preamble') { let d = 1; while (i < s.length && d) { if (s[i] === m[2]) d++; else if (s[i] === close) d--; i++; } continue; }
    try {
      if (type === 'string') {
        ws(); const n = /^[^\s=]+/.exec(s.slice(i))[0]; i += n.length; ws(); if (s[i] === '=') i++;
        macros[n.toLowerCase()] = value(); ws(); if (s[i] === close) i++;
        continue;
      }
      ws();
      const k = /^[^,\s}]*/.exec(s.slice(i))[0];
      i += k.length; ws(); if (s[i] === ',') i++;
      const fields = {};
      for (;;) {
        ws();
        if (i >= s.length) throw new Error('unclosed');
        if (s[i] === close) { i++; break; }
        const nm = /^[A-Za-z0-9_:.+-]+/.exec(s.slice(i));
        if (!nm) { i++; continue; }
        i += nm[0].length; ws();
        if (s[i] !== '=') continue;
        i++;
        fields[nm[0].toLowerCase()] = value();
        ws(); if (s[i] === ',') i++;
      }
      out.push({ type, key: k.trim(), fields });
    } catch { /* a broken entry: skipped */ }
  }
  return out;
}

// "Darwin, Charles and Wallace, Alfred Russel" (or "Charles Darwin and …") → ['Darwin, Charles', …].
// A name in braces ({World Health Organization}) stays whole.
export function namesOf(field) {
  const s = String(field || '');
  const parts = [];
  let d = 0, cur = '';
  const words = s.split(/(\s+and\s+|[{}])/i);
  for (const w of words) {
    if (w === '{') { d++; cur += w; } else if (w === '}') { d--; cur += w; }
    else if (/^\s+and\s+$/i.test(w) && d === 0) { parts.push(cur); cur = ''; } else cur += w;
  }
  parts.push(cur);
  return parts.map((p) => {
    const whole = /^\s*\{([^{}]*)\}\s*$/.exec(p);
    if (whole) return unlatex(whole[1]);
    const n = unlatex(p);
    if (!n || n.includes(',')) return n;
    const bits = n.split(' ');
    if (bits.length < 2) return n;
    // "Charles Robert Darwin" → "Darwin, Charles Robert"; "Ludwig van Beethoven" → "van Beethoven, Ludwig".
    let k = bits.length - 1;
    while (k > 1 && /^[a-z]/.test(bits[k - 1])) k--;
    return `${bits.slice(k).join(' ')}, ${bits.slice(0, k).join(' ')}`;
  }).filter(Boolean);
}

// An entry as a source's fields: { title, type, citekey, authors, year, … } (editors when there
// are no authors). Never an abstract, a note or a file's text.
export function entryToSource(e) {
  const f = e.fields || {};
  const get = (...names) => { for (const n of names) if (f[n] != null && String(f[n]).trim()) return unlatex(f[n]); return ''; };
  const year = (get('year') || get('date')).match(/\d{4}/)?.[0] || '';
  const pages = get('pages').replace(/\s*[-–—]+\s*/g, '–');
  const src = {
    title: get('title') || 'Untitled', type: IN_TYPE[e.type] || 'other', citekey: e.key || '',
    authors: namesOf(f.author || f.editor || ''), year,
    edition: get('edition'), container: get('journaltitle', 'journal', 'booktitle'), volume: get('volume'), issue: get('number', 'issue'),
    pages, publisher: get('publisher', 'institution', 'school', 'organization'), doi: get('doi'), url: get('url'), isbn: get('isbn', 'issn'),
  };
  for (const k of Object.keys(src)) if (src[k] === '' || (Array.isArray(src[k]) && !src[k].length)) delete src[k];
  return src;
}

// ---- Writing ----

// A source as an entry: @book{darwin1859origin, author = {Darwin, Charles}, …}.
export function sourceToEntry(src) {
  const type = OUT_TYPE[src.type] || 'misc';
  const rows = [];
  const put = (name, v) => { if (v != null && String(v).trim()) rows.push(`  ${name} = {${latex(v)}}`); };
  // A name with no comma (an organisation) in its own braces, so it stays whole.
  const names = (src.authors || []).map((n) => (n.includes(',') ? latex(n) : `{${latex(n)}}`)).join(' and ');
  if (names) rows.push(`  author = {${names}}`);
  put('title', src.title);
  if (type === 'article') put('journal', src.container); else if (type === 'incollection') put('booktitle', src.container);
  put('year', src.year);
  put('edition', src.edition);
  put('volume', src.volume);
  put('number', src.issue);
  put('pages', String(src.pages || '').replace(/–/g, '--'));
  put(type === 'phdthesis' ? 'school' : type === 'techreport' ? 'institution' : 'publisher', src.publisher);
  put('doi', src.doi);
  put('url', src.url);
  put('isbn', src.isbn);
  return `@${type}{${src.citekey || 'nokey'},\n${rows.join(',\n')}\n}\n`;
}
// A library's sources as a .bib file.
export const writeBib = (sources) => sources.map(sourceToEntry).join('\n');
