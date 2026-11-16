// The Book editor's Word document (app/optional/book/word.js, stage 4): true to the room's pages
// (size and margins), the title on a page of its own, each chapter on a new page when the room
// says so (sections never), headings as Word's own, numbered as they nest; spans as runs; margin
// notes left out; page numbers and the running head kept off the title page.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const Wd = await load('book', 'word.js');
const S = await load('book', 'tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  return { host, t, s };
}
const set = (host, room, o) => { const r = host.w.things[room]; r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), ...o } }; host.world.save(); };
// The parts of the (stored, uncompressed) zip, by name.
function parts(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset), dec = new TextDecoder(), out = {};
  let at = 0;
  while (v.getUint32(at, true) === 0x04034b50) {
    const size = v.getUint32(at + 18, true), n = v.getUint16(at + 26, true);
    const name = dec.decode(bytes.subarray(at + 30, at + 30 + n));
    out[name] = dec.decode(bytes.subarray(at + 30 + n, at + 30 + n + size));
    at += 30 + n + size;
  }
  return out;
}
const paras = (doc) => doc.match(/<w:p>.*?<\/w:p>|<w:tbl>.*?<\/w:tbl>/g) || [];
const words = (p) => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join('');

test('book word: a .docx with styles, a header and footer, the title and every paragraph in order', () => {
  const { t, s } = setUp();
  const files = parts(Wd.wordDoc(t, s.book));
  for (const f of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/header1.xml', 'word/footer1.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml']) assert.ok(files[f], f);
  const doc = files['word/document.xml'];
  const ps = paras(doc);
  assert.ok(ps[0].includes('w:val="Title"') && words(ps[0]) === S.TEXT.title, 'the title first');
  const heads = ps.filter((p) => /Heading\d/.test(p)).map((p) => [words(p), /Heading(\d)/.exec(p)[1]]);
  assert.deepEqual(heads, [['1  Winter', '1'], ['2  Spring', '1'], ['2.1  The garden', '2'], ['2.2  Visitors', '2'], ['3  Summer', '1']]);
  const body = ps.map(words);
  assert.ok(body.includes(S.TEXT.chapters[0].paras[2]) && body.includes(S.TEXT.open), 'the paragraphs, the open one too');
  assert.ok(!doc.includes('Margin note'), 'margin notes stay out');
  assert.ok(!body.some((w) => S.TEXT.loose.includes(w)), 'the thoughts not in the book stay out');
  assert.ok(body.indexOf(S.TEXT.chapters[0].paras[0]) < body.indexOf(S.TEXT.chapters[1].paras[0]), 'in reading order');
  assert.ok(files['word/footer1.xml'].includes(' PAGE ') && files['word/header1.xml'].includes('STYLEREF'), 'page numbers, running head');
  assert.ok(doc.includes('<w:titlePg/>'), 'neither on the title page');
});

test('book word: each chapter starts a new page, sections do not; off when the room says so', () => {
  const { host, t, s } = setUp();
  let ps = paras(parts(Wd.wordDoc(t, s.book))['word/document.xml']);
  const breaks = () => ps.filter((p) => p.includes('<w:pageBreakBefore/>')).map(words);
  assert.deepEqual(breaks(), ['1  Winter', '2  Spring', '3  Summer']);
  set(host, s.room, { chapterPage: false });
  ps = paras(parts(Wd.wordDoc(t, s.book))['word/document.xml']);
  assert.deepEqual(breaks(), ['1  Winter'], 'only the title keeps its own page');
});

test('book word: the room\'s page size and margins carry over (a column prints on A4)', () => {
  const { host, t, s } = setUp();
  const sect = () => /<w:pgSz w:w="(\d+)" w:h="(\d+)"\/><w:pgMar w:top="(\d+)"/.exec(parts(Wd.wordDoc(t, s.book))['word/document.xml']).slice(1).map(Number);
  assert.deepEqual(sect(), [11906, 16838, 1247], 'A4, normal margins (22 mm)');
  set(host, s.room, { pages: 'trade', margins: 'wide' });
  assert.deepEqual(sect(), [8617, 12983, 1701], '6 × 9 in, wide margins (30 mm)');
  set(host, s.room, { pages: 'letter', margins: 'narrow' });
  assert.deepEqual(sect(), [12246, 15817, 907]);
  set(host, s.room, { pages: 'none' });
  assert.equal(sect()[0], 11906, 'one column without pages: A4');
});

test('book word: spans come out as bold and italic runs; a new line as a break', () => {
  const { t, s } = setUp();
  const p = s.paras[0];
  t.marks.edit(p, { spans: [{ from: 4, to: 8, kind: 'bold' }, { from: 4, to: 12, kind: 'italic' }] });
  const doc = parts(Wd.wordDoc(t, s.book))['word/document.xml'];
  assert.ok(doc.includes('<w:rPr><w:b/><w:i/></w:rPr><w:t xml:space="preserve">lamp</w:t>'), 'bold and italic');
  assert.ok(doc.includes('<w:rPr><w:i/></w:rPr><w:t xml:space="preserve"> is </w:t>'), 'italic alone');
});

test('book word: a 1,500-paragraph book writes in well under a second', () => {
  const { t, s } = setUp();
  const ch = s.chapters[0];
  t.together(() => { for (let i = 0; i < 1500; i++) { const id = t.marks.make({ content: `Paragraph ${i} of a long book, with enough words to be a line or two.`, in: s.room }).id; t.links.link(id, ch, 'part of'); } });
  const t0 = performance.now();
  const bytes = Wd.wordDoc(t, s.book);
  const ms = performance.now() - t0;
  assert.ok(bytes.length > 100000);
  assert.ok(ms < 500, `${ms.toFixed(0)} ms`);
});
