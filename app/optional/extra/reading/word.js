// Reading notes as a Word document (.docx): the library's notes by source, each source a heading
// (Word's Heading 1, so the navigation pane sees them), its quotes cited in Chicago author-date
// in the text, (Darwin 1859, 490), its comments as paragraphs (a comment on a quote indented under
// it), and a References list at the end, sorted as Chicago sorts it. A source with no notes is
// left out of the notes but kept in References. Plain functions of the read half of the tables;
// tested in tests/cite.test.js and app/core/api/tests/reading.test.js. The zip is Book's (zip.js).

import { sourcesIn, streamOf, quoteOf, authorYear } from './rules.js';
import { inText, reference, references } from './cite.js';
import { zip } from './zip.js';

const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A run of words (new lines as Word's line breaks), in italic when asked.
const wrun = (words, italic = false) => `<w:r>${italic ? '<w:rPr><w:i/></w:rPr>' : ''}${String(words).split('\n').map((l, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xmlEsc(l)}</w:t>`).join('')}</w:r>`;
// A paragraph of runs, in a style.
const wpara = (inner, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${inner}</w:p>`;

// The document's paragraphs: [xml].
export function bodyOf(reads, room, title) {
  const body = [wpara(wrun(title || 'Reading notes'), 'Title')];
  const all = sourcesIn(reads, room);
  for (const src of all) {
    const stream = streamOf(reads, src.id);
    if (!stream.length) continue;
    body.push(wpara(wrun(`${src.title || 'Untitled'}`), 'Heading1'));
    body.push(wpara(wrun(`${authorYear(src)}${src.edition ? `, ${src.edition} ed.` : ''} · ${src.citekey || ''}`), 'Subtle'));
    for (const { id, under } of stream) {
      const m = reads.marks.get(id);
      const words = String(m?.text || '').trim();
      if (!words) continue;
      const q = quoteOf(reads, id);
      if (q) body.push(wpara(`${wrun(words)}${wrun(` ${inText(src, q.label || '')}`)}`, 'Quote'));
      else body.push(wpara(wrun(words), under ? 'Comment' : ''));
    }
  }
  if (all.length) {
    body.push(wpara(wrun('References'), 'Heading1'));
    for (const src of references(all)) body.push(wpara(reference(src).map((r) => wrun(r.text, !!r.italic)).join(''), 'Reference'));
  }
  return body;
}

// The styles: Title, Heading 1, a quote set in from both sides, a comment set in under it, and a
// reference with a hanging indent, as Chicago lays a References list.
const STYLES = `<w:styles xmlns:w="${WNS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtle"><w:name w:val="Source line"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="200"/></w:pPr><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="567" w:right="567"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Comment"><w:name w:val="Comment on a quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="1134"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Reference"><w:name w:val="Reference"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="567" w:hanging="567"/><w:spacing w:after="120"/></w:pPr></w:style>
</w:styles>`;

// The library as a .docx: its bytes.
export function wordDoc(reads, room, title) {
  const enc = new TextEncoder();
  const xml = (s) => enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${s}`);
  const sect = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  const doc = `<w:document xmlns:w="${WNS}" xmlns:r="${RNS}"><w:body>${bodyOf(reads, room, title).join('')}${sect}</w:body></w:document>`;
  const main = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  const types = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="${main}.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${main}.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${RNS}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="${RNS}/styles" Target="styles.xml"/></Relationships>`;
  const core = `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEsc(title || 'Reading notes')}</dc:title></cp:coreProperties>`;
  return zip([
    { name: '[Content_Types].xml', data: xml(types) },
    { name: '_rels/.rels', data: xml(rels) },
    { name: 'docProps/core.xml', data: xml(core) },
    { name: 'word/document.xml', data: xml(doc) },
    { name: 'word/styles.xml', data: xml(STYLES) },
    { name: 'word/_rels/document.xml.rels', data: xml(docRels) },
  ]);
}
