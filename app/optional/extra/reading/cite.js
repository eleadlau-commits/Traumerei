// Reading notes: citations and the Markdown export, as plain functions. Markdown cites with Pandoc
// keys ([@darwin1859origin, p. 490]); Word with one formatted style, Chicago author-date: in the
// text (Darwin 1859, 490), and a References list. Tested in tests/cite.test.js.

import { sourcesIn, streamOf, quoteOf, familyName, editionOf } from './rules.js';

// ---- Chicago author-date ----

// "Darwin", "Darwin and Wallace", "Darwin, Wallace, and Bates", "Darwin et al." (four or more).
export function citeNames(src) {
  const a = (src?.authors || []).map(familyName).filter(Boolean);
  if (!a.length) return src?.container || src?.publisher || shortTitle(src?.title);
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  if (a.length === 3) return `${a[0]}, ${a[1]}, and ${a[2]}`;
  return `${a[0]} et al.`;
}
const shortTitle = (t) => { const w = String(t || 'Untitled').split(/\s+/); return w.length > 4 ? `${w.slice(0, 4).join(' ')}…` : w.join(' '); };

// The page as Chicago writes it in a citation: "490", "112–13" (the second number shortened as
// Chicago does), "xiv".
export function chicagoPages(anchor) {
  const m = /(\d+|[ivxlcdm]+)(?:\s*[-–]\s*(\d+|[ivxlcdm]+))?/i.exec(String(anchor || '').replace(/^pp?\.\s*/, ''));
  if (!m) return '';
  if (!m[2]) return m[1];
  return `${m[1]}–${shortenRange(m[1], m[2])}`;
}
// Chicago's inclusive numbers: 71–72, 100–104, 101–8, 1103–4, 321–28, 1087–89, 498–532,
// 1496–1504 (a range that crosses a hundred is written whole).
function shortenRange(a, b) {
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return b;
  const n = Number(a), m = Number(b);
  if (m <= n || n < 100 || n % 100 === 0 || Math.floor(n / 100) !== Math.floor(m / 100)) return b;
  return n % 100 < 10 ? String(m % 100) : String(m % 100).padStart(2, '0');
}

// In the text: (Darwin 1859, 490); (Darwin 1859) with no page.
export function inText(src, anchor = '') {
  const p = chicagoPages(anchor);
  return `(${citeNames(src)} ${src?.year || 'n.d.'}${p ? `, ${p}` : ''})`;
}

// An author's name as the References list writes it: the first "Family, Given", the others
// "Given Family".
const turned = (n) => { const [fam, given] = String(n).split(/,\s*/); return given ? `${given} ${fam}` : fam; };
function refNames(src) {
  const a = (src?.authors || []).filter(Boolean);
  if (!a.length) return '';
  if (a.length === 1) return a[0];
  const rest = a.slice(1).map(turned);
  if (a.length === 2) return `${a[0]}, and ${rest[0]}`;
  if (a.length <= 10) return `${a[0]}, ${rest.slice(0, -1).join(', ')}, and ${rest.at(-1)}`;
  return `${a[0]}, ${rest.slice(0, 6).join(', ')}, et al.`;
}
const stop = (s) => (/[.?!]$/.test(s) ? s : `${s}.`);
// "6th ed."; a first edition is not named (Chicago).
const editionWords = (e) => { const s = String(e || '').trim(); if (!s || /^(1|1st|first)\b/i.test(s)) return ''; return /ed\.?$/i.test(s) ? s : `${s.replace(/\s*edition$/i, '')} ed.`; };

// A References entry as runs: [{ text, italic? }] (a book's title or a journal's name in italic).
export function reference(src) {
  const out = [];
  const t = (text, italic = false) => { if (text) out.push(italic ? { text, italic } : { text }); };
  const who = refNames(src);
  const year = src?.year || 'n.d.';
  t(who ? `${stop(who)} ${year}. ` : '');
  const title = String(src?.title || 'Untitled');
  const ed = editionWords(src?.edition);
  const tail = [];
  switch (src?.type) {
    case 'article':
      if (!who) t(`${year}. `);
      t(`“${stop(title)}” `);
      t(src.container || '', true);
      t(`${src.volume ? ` ${src.volume}` : ''}${src.issue ? ` (${src.issue})` : ''}${src.pages ? `: ${chicagoPages(src.pages)}` : ''}. `);
      break;
    case 'chapter':
      if (!who) t(`${year}. `);
      t(`“${stop(title)}” `);
      if (src.container) { t('In '); t(src.container, true); t(src.pages ? `, ${chicagoPages(src.pages)}. ` : '. '); }
      if (ed) tail.push(ed);
      if (src.publisher) tail.push(src.publisher);
      break;
    case 'web':
      if (!who) t(`${year}. `);
      t(`“${stop(title)}” `);
      if (src.container || src.publisher) tail.push(src.container || src.publisher);
      break;
    default:
      if (!who) t(`${year}. `);
      t(stop(title).replace(/\.$/, ''), true);
      t('. ');
      if (ed) tail.push(ed);
      if (src?.publisher) tail.push(src.publisher);
  }
  if (tail.length) t(`${tail.map(stop).join(' ')} `);
  const link = src?.doi ? `https://doi.org/${String(src.doi).replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '')}` : src?.url || '';
  if (link) t(`${link}.`);
  // Tidy: no space before the end, no doubled stops.
  const last = out.at(-1);
  if (last) last.text = last.text.replace(/\s+$/, '');
  return out;
}
export const referenceText = (src) => reference(src).map((r) => r.text).join('');

// The References list, sorted as Chicago sorts it: by the first author's family name, then year.
export function references(list) {
  return [...list].sort((a, b) => (refNames(a) || a.title || '').localeCompare(refNames(b) || b.title || '') || String(a.year || '').localeCompare(String(b.year || '')));
}

// ---- Pandoc Markdown ----

// [@darwin1859origin, p. 490]; [@darwin1859origin] with no page.
export const pandoc = (src, anchor = '') => `[@${src?.citekey || 'nokey'}${anchor ? `, ${anchor}` : ''}]`;

// The library as Markdown, by source: each source a heading, its quotes as block quotes cited
// with Pandoc keys, its comments as paragraphs (a quote's comments right after it). A source with
// no notes is left out. Tags stay as typed. → the file's words.
export function markdownOf(reads, room, title = 'Reading notes') {
  const out = ['---', `title: "${String(title).replace(/"/g, '\\"')}"`, '---', ''];
  for (const src of sourcesIn(reads, room)) {
    const stream = streamOf(reads, src.id);
    if (!stream.length) continue;
    const main = editionOf(reads, src.id);
    out.push(`## ${src.title || 'Untitled'} [@${src.citekey || 'nokey'}]`, '');
    if (main || src.edition) out.push(`*${[src.edition ? `${src.edition} edition` : '', src.year].filter(Boolean).join(', ')}*`, '');
    for (const { id } of stream) {
      const m = reads.marks.get(id);
      const words = String(m?.text || '').trim();
      if (!words) continue;
      const q = quoteOf(reads, id);
      if (q) out.push(`> ${words.replace(/\n/g, '\n> ')} ${pandoc(src, q.label || '')}`, '');
      else out.push(words, '');
    }
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

