// Word document: a format that takes a room out as a .docx, in reading order: each group's title
// as a heading and its parts in its order, then the loose marks, oldest first. A thought's spans
// come out as Word's bold, italic, underline and strike; a table kind as a table; a figure as its
// picture and caption. A corpus plugin (open core, step 5): written against app/core/API.md alone;
// several formats may take a room out, and each is offered in the room's ⋯ More.
import { Feature } from 'folio';
import { zip } from './zip.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOOK = { bold: '<w:b/>', italic: '<w:i/>', underline: '<w:u w:val="single"/>', strike: '<w:strike/>', highlight: '<w:highlight w:val="yellow"/>' };
const TEXT_WIDTH = 5486400; // six inches, in EMU

// The reading order of a room: [{ heading, level } | { mark }].
export function order(reads, room) {
  const all = reads.marks.in(room), seen = new Set(), out = [];
  const walk = (g, level) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    if (g.title) out.push({ heading: g.title, level });
    for (const id of reads.links.members(g.id)) {
      const m = reads.marks.get(id);
      if (!m || seen.has(id)) continue;
      if (m.kind === 'group') walk(m, Math.min(6, level + 1)); // six levels of heading, as Word has
      else { seen.add(id); out.push({ mark: m }); }
    }
  };
  all.filter((m) => m.kind === 'group' && !reads.links.holders(m.id).length).sort((a, b) => a.at - b.at).forEach((g) => walk(g, 1));
  for (const m of all.filter((m) => m.kind !== 'group' && !seen.has(m.id)).sort((a, b) => a.at - b.at)) out.push({ mark: m });
  return out;
}

// A run of words with a look; new lines inside a thought become Word's breaks.
const run = (words, look = '') => `<w:r>${look ? `<w:rPr>${look}</w:rPr>` : ''}${String(words).split('\n').map((l, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(l)}</w:t>`).join('')}</w:r>`;

// A thought as a paragraph, its spans cut into runs.
export function paragraph(text, spans = []) {
  const s = String(text ?? '');
  const cuts = new Set([0, s.length]);
  for (const sp of spans || []) { cuts.add(Math.max(0, sp.from)); cuts.add(Math.min(s.length, sp.to)); }
  const at = [...cuts].sort((a, b) => a - b);
  let runs = '';
  for (let i = 0; i < at.length - 1; i++) {
    const a = at[i], b = at[i + 1];
    if (b <= a) continue;
    const look = [...new Set((spans || []).filter((sp) => sp.from <= a && sp.to >= b).map((sp) => LOOK[sp.kind]).filter(Boolean))].join('');
    runs += run(s.slice(a, b), look);
  }
  return `<w:p>${runs}</w:p>`;
}

function cells(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^\|?[\s:|-]+\|?$/.test(l));
  const sep = lines.some((l) => l.includes('|')) ? '|' : lines.some((l) => l.includes('\t')) ? '\t' : ',';
  return lines.map((l) => l.replace(/^\||\|$/g, '').split(sep).map((c) => c.trim()));
}
const table = (rows) => `<w:tbl><w:tblPr><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:color="999999"/>`).join('')}</w:tblBorders></w:tblPr>${rows.map((r, i) => `<w:tr>${r.map((c) => `<w:tc><w:p>${run(c, i ? '' : '<w:b/>')}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl><w:p/>`;

// A picture from a data address: { bytes, ext } or null.
function picture(src) {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(String(src || ''));
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, ext: m[1] === 'png' ? 'png' : 'jpeg' };
}
const drawing = (rid, n, cx, cy) => `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Figure ${n}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="figure${n}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

// The room as a .docx: its bytes.
export function docx(t, room) {
  const body = [], media = [];
  const name = t.marks.get(room)?.name;
  if (name) body.push(`<w:p>${run(name, '<w:b/><w:sz w:val="40"/>')}</w:p>`);
  for (const item of order(t, room)) {
    if (item.heading) { body.push(`<w:p>${run(item.heading, `<w:b/><w:sz w:val="${[0, 32, 28, 24, 22, 21, 20][item.level]}"/>`)}</w:p>`); continue; }
    const m = item.mark;
    if (m.kind === 'table') { body.push(table(cells(m.text))); continue; }
    if (m.kind === 'figure') {
      const pic = picture(m.src);
      if (pic) {
        const n = media.length + 1, rid = `rIdImg${n}`;
        media.push({ name: `word/media/figure${n}.${pic.ext}`, data: pic.bytes, rid, ext: pic.ext });
        body.push(drawing(rid, n, TEXT_WIDTH, Math.round(TEXT_WIDTH * (m.ratio || 0.6))));
      }
      if (m.caption) body.push(`<w:p>${run(m.caption, '<w:i/>')}</w:p>`);
      continue;
    }
    body.push(paragraph(m.kind === 'line' ? m.text : t.marks.text(m.id), m.kind === 'line' ? m.spans : null));
  }
  const enc = new TextEncoder();
  const xml = (s) => enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${s}`);
  const doc = `<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const types = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${media.map((m) => `<Relationship Id="${m.rid}" Type="${R}/image" Target="media/${m.name.split('/').pop()}"/>`).join('')}</Relationships>`;
  return zip([
    { name: '[Content_Types].xml', data: xml(types) },
    { name: '_rels/.rels', data: xml(rels) },
    { name: 'word/document.xml', data: xml(doc) },
    { name: 'word/_rels/document.xml.rels', data: xml(docRels) },
    ...media.map((m) => ({ name: m.name, data: m.data })),
  ]);
}

export function install(t) {
  t.slots.formats.add({
    id: 'docx', name: 'Word document (.docx)',
    accepts: () => false, // (it only takes rooms out)
    exportRoom: (id) => t.ui.files.save(`${t.marks.get(id)?.name || 'room'}.docx`, new Blob([docx(t, id)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  });
}

export default class Docx extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
