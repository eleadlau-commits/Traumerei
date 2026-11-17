// The book as a Word document (.docx), true to the room's pages: their size and margins carry over,
// the title has a page of its own, and each chapter starts a new page when the room says so (its ⚙,
// "A chapter starts a page"). Headings are Word's own Heading 1–3 (so Word's navigation pane and
// table of contents see the chapters), numbered as they nest, as the page shows them; a chapter's
// heading keeps with what follows it, and a paragraph never leaves one line alone at a foot or a
// top. Page numbers at the foot and the chapter's title at the head, as on the page, but not on the
// title page. A thought's spans come out as bold, italic, underline and strike; a table as a table;
// a figure as its picture and caption. Margin notes stay out, as they do in every export.
// Plain functions over the read half of the tables; tested in api/tests/book-word.test.js.

import { tree, numberer, under, headingWords } from './rules.js';
import { SIZES, MARGINS } from './pages.js';
import { settingOf, typeOf } from './column.js';
import { zip } from './zip.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOOK = { bold: '<w:b/>', italic: '<w:i/>', underline: '<w:u w:val="single"/>', strike: '<w:strike/>', highlight: '<w:highlight w:val="yellow"/>' };
const twips = (mm) => Math.round((mm * 1440) / 25.4);
const EMU = 36000; // per millimetre

// The page a room's book is set on, in twentieths of a point: { w, h, m }. A room seen as one
// column (Pages: None) still prints on a page: A4, at its margins.
export function pageSetup(reads, room) {
  const size = SIZES[settingOf(reads, room, 'pages') ?? 'a4'] || SIZES.a4;
  const m = MARGINS[settingOf(reads, room, 'margins')] ?? MARGINS.normal;
  return { w: twips(size[0]), h: twips(size[1]), m: twips(m), mm: [size[0], size[1], m], chapterPage: settingOf(reads, room, 'chapterPage') !== false };
}

// A run of words with a look; new lines inside a thought become Word's line breaks.
const run = (words, look = '') => `<w:r>${look ? `<w:rPr>${look}</w:rPr>` : ''}${String(words).split('\n').map((l, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(l)}</w:t>`).join('')}</w:r>`;

// Words cut into runs at their spans' edges.
export function runs(text, spans = []) {
  const s = String(text ?? '');
  const cuts = new Set([0, s.length]);
  for (const sp of spans || []) { cuts.add(Math.max(0, Math.min(s.length, sp.from))); cuts.add(Math.max(0, Math.min(s.length, sp.to))); }
  const at = [...cuts].sort((a, b) => a - b);
  let out = '';
  for (let i = 0; i < at.length - 1; i++) {
    const a = at[i], b = at[i + 1];
    if (b <= a) continue;
    const look = [...new Set((spans || []).filter((sp) => sp.from <= a && sp.to >= b).map((sp) => LOOK[sp.kind]).filter(Boolean))].join('');
    out += run(s.slice(a, b), look);
  }
  return out;
}

const para = (inner, { style = null, pageBreak = false, extra = '' } = {}) => {
  const pPr = `${style ? `<w:pStyle w:val="${style}"/>` : ''}${pageBreak ? '<w:pageBreakBefore/>' : ''}${extra}`;
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inner}</w:p>`;
};

function cells(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^\|?[\s:|-]+\|?$/.test(l));
  const sep = lines.some((l) => l.includes('|')) ? '|' : lines.some((l) => l.includes('\t')) ? '\t' : ',';
  return lines.map((l) => l.replace(/^\||\|$/g, '').split(sep).map((c) => c.trim()));
}
const table = (rows) => `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:color="999999"/>`).join('')}</w:tblBorders></w:tblPr>${rows.map((r, i) => `<w:tr>${i ? '' : '<w:trPr><w:tblHeader/></w:trPr>'}${r.map((c) => `<w:tc><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(c, i ? '' : '<w:b/>')}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;

// A picture from a data address: { bytes, ext } or null.
function picture(src) {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(String(src || ''));
  if (!m || typeof atob !== 'function') return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, ext: m[1] === 'png' ? 'png' : 'jpeg' };
}
const drawing = (rid, n, cx, cy) => `<w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Figure ${n}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="figure${n}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

// The look, once: Georgia 12 pt as the printed page has it; headings as the page draws them (a
// chapter bold small capitals, a section bold, deeper italic), each kept with what follows.
const heading = (n, name, rPr, before, after) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="${after}"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr>${rPr}</w:rPr></w:style>`;
const STYLES = `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
  + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
  + '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr></w:style>'
  // Stepping down as they nest, as on the pages (column.js HEAD_SCALE, over 12 pt): 17.5, 14.5, 12.5 pt.
  + heading(1, 'heading 1', '<w:b/><w:smallCaps/><w:sz w:val="35"/><w:szCs w:val="35"/>', 0, 360)
  + heading(2, 'heading 2', '<w:b/><w:sz w:val="29"/><w:szCs w:val="29"/>', 360, 120)
  + heading(3, 'heading 3', '<w:i/><w:sz w:val="25"/><w:szCs w:val="25"/>', 240, 80)
  + '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:i/><w:sz w:val="20"/></w:rPr></w:style>'
  + '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:rPr><w:smallCaps/><w:sz w:val="18"/></w:rPr></w:style>'
  + '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>'
  + '</w:styles>';
// The styles at the room's Type size (column.js typeOf): every size and every space before and
// after a paragraph in proportion (the line spacing is a multiple already); the page as it is.
export function stylesFor(scale = 1) {
  if (scale === 1) return STYLES;
  return STYLES.replace(/(w:sz(?:Cs)?|w:before|w:after) ?(w:val)?="(\d+)"/g, (all, k, v, n) => all.replace(`"${n}"`, `"${Math.max(1, Math.round(+n * scale))}"`));
}
const field = (code) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
const HEADER = `<w:hdr xmlns:w="${W}"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr>${field('STYLEREF "heading 1" \\* MERGEFORMAT')}</w:p></w:hdr>`;
const FOOTER = `<w:ftr xmlns:w="${W}"><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>${field('PAGE')}</w:p></w:ftr>`;

// The body of a book's document: { body: [xml], media: [{ name, data, rid }] }.
export function bodyOf(reads, id, page) {
  const node = tree(reads, id);
  const body = [], media = [];
  if (!node) return { body, media };
  const widthMm = page.mm[0] - 2 * page.mm[2];
  // The title a third of the way down a page of its own, as the Book page sets it.
  const drop = Math.max(0, Math.round(page.h * 0.3 - page.m));
  body.push(para(run(node.title), { style: 'Title', extra: `<w:spacing w:before="${drop}"/>` }));
  let breakNext = true; // what follows the title starts the next page
  const brk = (chapter) => { const b = breakNext || (chapter && page.chapterPage); breakNext = false; return b; };
  const walk = (n, depth, prefix) => {
    const next = numberer(prefix); // an unnumbered chapter: no number, skipped (rules.js)
    for (const p of n.parts) {
      if (p.chapter) {
        const num = next(p.numbered);
        body.push(para(run(headingWords(num, p.title, '* * *')), { style: `Heading${Math.min(depth, 3)}`, pageBreak: brk(depth === 1) }));
        walk(p, depth + 1, under(num));
        continue;
      }
      const m = reads.marks.get(p.id);
      if (!m) continue;
      if (m.kind === 'table') {
        const rows = cells(m.text);
        if (!rows.length) continue;
        if (breakNext) body.push(para('', { pageBreak: brk(false) }));
        body.push(table(rows), para('', { extra: '<w:spacing w:after="0"/>' }));
        continue;
      }
      if (m.kind === 'figure') {
        const pic = picture(m.src);
        if (pic) {
          const n2 = media.length + 1, rid = `rIdImg${n2}`;
          media.push({ name: `word/media/figure${n2}.${pic.ext}`, data: pic.bytes, rid });
          const cx = Math.round(widthMm * EMU);
          body.push(para(drawing(rid, n2, cx, Math.round(cx * (m.ratio || 0.6))), { pageBreak: brk(false), extra: '<w:keepNext/><w:jc w:val="center"/>' }));
        }
        if (m.caption) body.push(para(run(m.caption), { style: 'Caption', pageBreak: brk(false) }));
        continue;
      }
      if (!String(p.text).trim()) continue;
      body.push(para(runs(p.text, m.kind === 'line' ? m.spans : null), { pageBreak: brk(false) }));
    }
  };
  walk(node, 1, '');
  return { body, media };
}

// The book as a .docx: its bytes.
export function wordDoc(reads, id) {
  const room = reads.places.home(id);
  const page = pageSetup(reads, room);
  const { body, media } = bodyOf(reads, id, page);
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="${page.w}" w:h="${page.h}"/><w:pgMar w:top="${page.m}" w:right="${page.m}" w:bottom="${page.m}" w:left="${page.m}" w:header="${Math.round(page.m / 2)}" w:footer="${Math.round(page.m / 2)}" w:gutter="0"/><w:titlePg/></w:sectPr>`;
  const enc = new TextEncoder();
  const xml = (s) => enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${s}`);
  const doc = `<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('')}${sect}</w:body></w:document>`;
  const main = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  const types = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="${main}.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${main}.styles+xml"/><Override PartName="/word/header1.xml" ContentType="${main}.header+xml"/><Override PartName="/word/footer1.xml" ContentType="${main}.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rIdHeader" Type="${R}/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="${R}/footer" Target="footer1.xml"/>${media.map((m) => `<Relationship Id="${m.rid}" Type="${R}/image" Target="media/${m.name.split('/').pop()}"/>`).join('')}</Relationships>`;
  const title = reads.marks.get(id)?.title || 'Untitled book';
  const core = `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title></cp:coreProperties>`;
  return zip([
    { name: '[Content_Types].xml', data: xml(types) },
    { name: '_rels/.rels', data: xml(rels) },
    { name: 'docProps/core.xml', data: xml(core) },
    { name: 'word/document.xml', data: xml(doc) },
    { name: 'word/styles.xml', data: xml(stylesFor(typeOf(reads, room))) },
    { name: 'word/header1.xml', data: xml(HEADER) },
    { name: 'word/footer1.xml', data: xml(FOOTER) },
    { name: 'word/_rels/document.xml.rels', data: xml(docRels) },
    ...media.map((m) => ({ name: m.name, data: m.data })),
  ]);
}

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
