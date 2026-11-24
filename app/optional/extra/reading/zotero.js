// Reading notes: Zotero's annotations in, as plain functions. In Zotero, "Add Note from
// Annotations" then the note exported as Markdown gives each highlight as its words in quotation
// marks and a citation with its page, then the comment typed on it:
//
//   “There is grandeur in this view of life” ([Darwin, 1859, p. 490](zotero://select/…)) A comment.
//
// Each highlight becomes a quote with its page; each comment a comment under it; any other
// paragraph a note of its own. Zotero's links, headings and images are left out. Tested in
// tests/bibtex.test.js.

const OPEN = '“"‘«„';
const CLOSE = { '“': '”', '"': '"', '‘': '’', '«': '»', '„': '“' };

// Markdown links and Zotero's own addresses out: [words](zotero://…) → words; the link that opens the
// PDF ([pdf](zotero://open-pdf/…)) and bare (zotero://…) gone.
const unlink = (s) => String(s).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\(?\[[^\]]*\]\(zotero:\/\/open-pdf[^)]*\)\)?/g, '').replace(/\[([^\]]*)\]\((?:zotero|https?):[^)]*\)/g, '$1').replace(/\((?:zotero):[^)]*\)/g, '').replace(/<\/?[^>]+>/g, '');
// Markdown emphasis out (Zotero writes none in a highlight, but a comment may).
const plainMd = (s) => String(s).replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(^|\W)[*_](\S.*?\S|\S)[*_](?=\W|$)/g, '$1$2').replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1');

// A citation's page: "(Darwin, 1859, p. 490)", "(p. 12)", "(Darwin 1859:490)", "(pp. 12-14)".
const CITE = /\(\s*(?:[^()]*?[,\s])?(pp?\.?\s*)?((?:\d+|[ivxlcdm]+)(?:\s*[-–]\s*(?:\d+|[ivxlcdm]+))?)\s*\)/i;

// The notes of a Zotero note in Markdown: [{ quote: true, text, page }, { comment: true, text }
// (a comment under the quote before it), { text } (a note of its own)].
export function parseZotero(md) {
  const out = [];
  const paras = String(md || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (let raw of paras) {
    if (/^#{1,6}\s/.test(raw)) continue; // "# Annotations", a heading
    if (/^\(?\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw) || /^Annotations\b/i.test(raw)) continue; // its date line
    raw = unlink(raw).replace(/^>\s?/gm, '').replace(/\s*\n\s*/g, ' ').trim();
    if (!raw) continue;
    const first = raw[0];
    if (OPEN.includes(first)) {
      const end = raw.indexOf(CLOSE[first], 1);
      if (end > 0) {
        const quote = raw.slice(0, end + 1);
        let rest = raw.slice(end + 1).trim();
        const m = CITE.exec(rest);
        let page = '';
        if (m && m.index <= 2) {
          const [a, b] = m[2].split(/\s*[-–]\s*/);
          page = b && b !== a ? `pp. ${a}–${b}` : `p. ${a}`;
          rest = rest.slice(m.index + m[0].length).trim();
        }
        out.push({ quote: true, text: quote, page });
        const comment = plainMd(rest.replace(/^[-–—:]\s*/, '')).trim();
        if (comment) out.push({ comment: true, text: comment });
        continue;
      }
    }
    out.push({ text: plainMd(raw) });
  }
  return out;
}
