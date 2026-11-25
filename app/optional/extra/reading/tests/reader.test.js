// Tests for the text reader (reader.js): plain text, Gutenberg HTML and EPUB read into words and
// printed pages, a quote found by its letters, a page found by its anchor. Small books made here.

import { test, assert } from 'folio/testing';
import { readable, readBook, pageAt, pageNamed, pageText, findQuote, SCREEN } from '../reader.js';

const enc = (s) => new TextEncoder().encode(s);
const GUT = (body) => `The Project Gutenberg eBook of Test\r\n\r\nLicence words.\r\n\r\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\r\n\r\n${body}\r\n\r\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\r\n\r\nMore licence.`;

test('reader: which files read here', () => {
  assert.ok(readable('a.txt') && readable('B.EPUB') && readable('c.html') && readable('d.htm'));
  assert.ok(!readable('e.pdf') && !readable('f.docx') && !readable(''));
});

test('reader: plain text: Gutenberg\'s own words left out, wrapped lines one paragraph, screens when no page is marked', async () => {
  const para = 'Someone must have been telling lies about Josef K., he knew he had\r\ndone nothing wrong but, one morning, he was arrested.';
  const b = await readBook('trial.txt', enc(GUT(`Chapter One\r\n\r\n${para}\r\n\r\n${'More words here. '.repeat(400)}`)));
  assert.ok(b.text.startsWith('Chapter One\n\nSomeone must'), 'starts at the book');
  assert.ok(!b.text.includes('Licence') && !b.text.includes('More licence'));
  assert.ok(b.text.includes('he knew he had done nothing'), 'a wrapped line joined');
  assert.equal(b.printed, false);
  assert.ok(b.pages.length >= 3);
  for (let i = 1; i < b.pages.length; i++) assert.ok(b.pages[i].at - b.pages[i - 1].at <= SCREEN * 1.5 + 20);
  assert.equal(pageNamed(b, 'p. 3'), -1, 'no printed pages');
});

test('reader: Latin-1 text reads as Latin-1', async () => {
  const one = [...enc('Ein M'), 0xe4, ...enc('dchen. ')];
  const many = new Uint8Array(Array(30).fill(one).flat());
  const b = await readBook('old.txt', many);
  assert.ok(b.text.includes('Mädchen'));
});

test('reader: Gutenberg HTML: its page numbers are the pages, a quote found on its page and lit', async () => {
  const html = `<!DOCTYPE html><html><head><title>x</title><style>p{}</style></head><body>
    <p>The Project Gutenberg eBook. Licence.</p><p>*** START OF THE PROJECT GUTENBERG EBOOK LANDARZT ***</p>
    <h2>Inhalt</h2><p>Vor dem Gesetz 49</p>
    <span class="pagenum"><a id="Page_49">[49]</a></span><h2>Vor dem Gesetz.</h2>
    <p>Vor dem Gesetz steht ein Türhüter. Zu diesem Türhüter kommt ein Mann vom Lande.</p>
    <p class="x"><span class="pagenum">[50]</span>Der Türhüter gibt ihm einen Schemel.</p>
    <span class="pagenum">[Pg 56]</span><p>»Hier konnte niemand sonst Einlaß erhalten, denn dieser
    Eingang war nur für dich bestimmt. Ich gehe jetzt und schließe ihn.«</p>
    <span class="pagenum">[57]</span><h2>Schakale und Araber.</h2><p>Wir lagerten in der Oase.</p>
    <p>*** END OF THE PROJECT GUTENBERG EBOOK LANDARZT ***</p><p>Licence again.</p></body></html>`;
  const b = await readBook('landarzt.html', enc(html));
  assert.equal(b.printed, true);
  assert.deepEqual(b.pages.map((p) => p.label), [null, '49', '50', '56', '57'], 'front matter, then the printed pages');
  assert.ok(!b.text.includes('Licence') && !b.text.includes('[49]'), 'no licence, no page numbers in the words');
  const p56 = pageNamed(b, 'p. 56');
  assert.equal(b.pages[p56].label, '56');
  assert.equal(pageNamed(b, 'pp. 49–50'), 1);
  assert.equal(pageNamed(b, 'Kap. 9'), -1);
  const [a, z] = pageText(b, p56);
  assert.ok(b.text.slice(a, z).includes('nur für dich bestimmt'));
  const q = findQuote(b, '"Hier konnte niemand sonst Einlass erhalten, denn dieser Eingang war nur für dich bestimmt."', p56);
  assert.ok(q, 'found, though typed with ss and other quotation marks');
  assert.equal(pageAt(b, q.from), p56);
  assert.ok(b.text.slice(q.from, q.to).startsWith('Hier konnte'));
  assert.ok(b.text.slice(q.from, q.to).endsWith('bestimmt'));
  assert.equal(findQuote(b, 'not in this book at all, no'), null);
  assert.ok(findQuote(b, 'Vor dem Gesetz steht ein Türhüter. Zu diesem Türhüter kommt ein Mann vom Lande und bittet um Eintritt'), 'its start is enough');
});

// A zip made here: each file stored or deflated (CompressionStream), as an EPUB is.
async function zip(files) {
  const parts = [], dir = [];
  let at = 0;
  const u16 = (n) => [n & 255, (n >> 8) & 255], u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, words, deflate] of files) {
    const raw = enc(words);
    const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw;
    const n = enc(name);
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(deflate ? 8 : 0), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(raw.length), ...u16(n.length), ...u16(0)];
    parts.push(new Uint8Array(head), n, data);
    dir.push([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(deflate ? 8 : 0), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(raw.length), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(at), ...n]);
    at += head.length + n.length + data.length;
  }
  const cd = new Uint8Array(dir.flat());
  const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cd.length), ...u32(at), ...u16(0)];
  return new Uint8Array(await new Blob([...parts, cd, new Uint8Array(end)]).arrayBuffer());
}

test('reader: EPUB: chapters in the spine\'s order, its page breaks the pages', async () => {
  const x = (body) => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>c</title></head><body>${body}</body></html>`;
  const book = await zip([
    ['mimetype', 'application/epub+zip', false],
    ['META-INF/container.xml', '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', true],
    ['OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="b" href="text/two.xhtml"/><item id="a" href="text/one.xhtml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>', true],
    ['OEBPS/text/one.xhtml', x('<span epub:type="pagebreak" title="1"/><h1>Erstes Kapitel</h1><p>Jemand mußte Josef K. verleumdet haben.</p><span role="doc-pagebreak" aria-label="2"/><p>Die Köchin kam diesmal nicht.</p>'), true],
    ['OEBPS/text/two.xhtml', x('<span epub:type="pagebreak" title="3"/><h1>Zweites Kapitel</h1><p>K. war telephonisch verständigt worden.</p>'), true],
  ]);
  const b = await readBook('process.epub', book);
  assert.equal(b.printed, true);
  assert.deepEqual(b.pages.map((p) => p.label), ['1', '2', '3']);
  assert.ok(b.text.indexOf('Erstes') < b.text.indexOf('Zweites'), 'the spine\'s order, not the manifest\'s');
  const q = findQuote(b, 'Jemand musste Josef K. verleumdet haben');
  assert.equal(pageAt(b, q.from), 0);
  assert.equal(pageAt(b, findQuote(b, 'telephonisch verständigt').from), 2);
  let bad = null;
  try { await readBook('broken.epub', enc('not a zip')); } catch (err) { bad = err; }
  assert.ok(bad, 'a file that is no zip is refused');
});

test('reader: a book of 500,000 letters reads, and a quote is found, quickly', async () => {
  const pages = Array.from({ length: 200 }, (_, i) => `<span class="pagenum">[${i + 1}]</span><p>${'Er war zu müde, um alle Folgerungen der Geschichte übersehn zu können. '.repeat(35)} Seite ${i + 1} ende.</p>`).join('');
  const html = `<html><body>${pages}<p>Wie ein Hund! sagte er, es war, als sollte die Scham ihn überleben.</p></body></html>`;
  const t0 = performance.now();
  const b = await readBook('big.html', enc(html));
  const t1 = performance.now();
  const q = findQuote(b, '"Wie ein Hund!" sagte er, es war, als sollte die Scham ihn überleben.');
  const t2 = performance.now();
  const q2 = findQuote(b, 'Seite 150 ende', pageNamed(b, 'p. 150'));
  const t3 = performance.now();
  assert.ok(b.text.length > 450000);
  assert.equal(b.pages.length, 200);
  assert.ok(q && pageAt(b, q.from) === 199);
  assert.equal(pageAt(b, q2.from), 149);
  assert.ok(t1 - t0 < 400, `read in ${Math.round(t1 - t0)} ms`);
  assert.ok(t2 - t1 < 300, `first quote in ${Math.round(t2 - t1)} ms (letters indexed once)`);
  assert.ok(t3 - t2 < 30, `next quote in ${Math.round(t3 - t2)} ms`);
});
