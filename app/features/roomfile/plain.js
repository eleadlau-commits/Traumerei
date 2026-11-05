// A plain Markdown (or text) file, brought in as loose thoughts: the same parts a .traum file reads
// into (grammar.js), with objects only. No screen here (tests/plain.test.js).
//
//   - a list item              a line thought each (indented lines under it stay in it)
//   # A heading                a passage: the heading is its title, the paragraph under it its body
//   A paragraph                a line when it is one line, else a passage with no title
//   ![caption](address)        a picture
//
// Paragraphs are split by blank lines, except inside display maths ($$ … $$). A front matter block
// at the top is left out. Everything is kept as written, LaTeX included.

const HEADING = /^#{1,6}\s+(.*?)\s*#*\s*$/;
const ITEM = /^\s{0,3}[-*+]\s+(.*)$/;
const PICTURE = /^!\[(.*)\]\((\S+)\)\s*$/;
const dollars = (s) => (s.match(/\$\$/g) || []).length;

// The file's text as parts: { front: [], objects, sections: [], report }.
export function plain(text) {
  let lines = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const report = [];
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, k) => k > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end > 0) { lines = lines.map((l, k) => (k <= end ? '' : l)); report.push(`Lines 1–${end + 1}: the front matter isn't used in a plain Markdown file.`); }
  }
  // Paragraphs: runs of lines between blank ones (display maths stays whole).
  const blocks = [];
  let cur = null;
  lines.forEach((l, k) => {
    if (!l.trim() && !(cur && dollars(cur.lines.join('\n')) % 2)) { cur = null; return; }
    if (!cur) { cur = { lines: [], line: k + 1 }; blocks.push(cur); }
    cur.lines.push(l);
  });
  const objects = [];
  const add = (kind, title, body, line) => objects.push({ id: String(objects.length + 1), kind, title, lines: body ? body.split('\n') : [], line, first: line });
  for (const b of blocks) {
    const [first, ...rest] = b.lines;
    const pic = b.lines.length === 1 && PICTURE.exec(first);
    if (pic) { add('picture', pic[1], pic[2], b.line); continue; }
    const h = HEADING.exec(first);
    if (h) {
      if (rest.length) add('passage', h[1], rest.join('\n'), b.line);
      else add('line', null, h[1], b.line);
      continue;
    }
    if (ITEM.test(first)) {
      let item = null;
      b.lines.forEach((l, k) => {
        const m = ITEM.exec(l);
        if (m) { add('line', null, m[1], b.line + k); item = objects.at(-1); } else item.lines.push(l.trim());
      });
      continue;
    }
    if (b.lines.length === 1) add('line', null, first, b.line);
    else add('passage', '', b.lines.join('\n'), b.line);
  }
  return { front: [], objects, sections: [], report };
}
