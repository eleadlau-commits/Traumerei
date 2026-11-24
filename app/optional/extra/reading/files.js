// Reading notes: linked attachments, as plain functions. A source's file stays outside the room,
// as Zotero keeps a PDF: the room keeps only `file: { rel, name, bytes, sha256, pageOffset }` (a
// path relative to the library folder, its name, size and SHA-256, and how far its pages run
// from the printed ones); the library folder is this computer's, kept in the plugin's t.store,
// never in the .traum. No text of the file is ever read into the room. Tested in tests/files.test.js.

import { pageOf } from './rules.js';

// A path's separator: the one it uses (Windows' \ or /).
const sepOf = (p) => (String(p).includes('\\') && !String(p).includes('/') ? '\\' : '/');
const trimEnd = (p) => String(p || '').replace(/[\\/]+$/, '');
// A path's parts, either separator.
const partsOf = (p) => String(p || '').split(/[\\/]+/).filter((x, i) => x !== '' || i === 0);

export const baseName = (p) => partsOf(trimEnd(p)).at(-1) || '';
export function dirName(p) {
  const s = trimEnd(p);
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return i <= 0 ? (i === 0 ? s[0] : '') : s.slice(0, i);
}
// Whether a path is whole (C:\…, \\server\…, /…, ~/…) rather than relative.
export const isAbsolute = (p) => /^([A-Za-z]:[\\/]|\\\\|\/|~[\\/])/.test(String(p || ''));
// The same folder? Windows paths are compared without case.
const same = (a, b, win) => (win ? a.toLowerCase() === b.toLowerCase() : a === b);

// A file's path relative to the library folder, or null when it is not inside it.
export function relPath(folder, path) {
  const f = trimEnd(folder), p = String(path || '');
  if (!f || !p) return null;
  const win = /^[A-Za-z]:|\\/.test(f + p);
  const fp = partsOf(f), pp = partsOf(p);
  if (pp.length <= fp.length || !fp.every((x, i) => same(x, pp[i], win))) return null;
  return pp.slice(fp.length).join('/');
}
// The whole path of a file kept relative to the folder (a path kept whole stays as it is).
export function fullPath(folder, rel) {
  const r = String(rel || '');
  if (!r || isAbsolute(r)) return r;
  const f = trimEnd(folder);
  if (!f) return r;
  const sep = sepOf(f);
  return `${f}${sep}${r.split('/').join(sep)}`;
}

// What the room keeps of a file picked (and its path pasted): { rel, name, bytes, sha256,
// pageOffset }, its path relative to the folder when inside it, else whole. A folder not set yet
// becomes the file's own folder: → { file, folder } (folder: the one to keep, when it is new).
export function attachment({ name, bytes, sha256 }, path, folder, pageOffset = 0) {
  const p = String(path || '').trim().replace(/^"(.*)"$/, '$1');
  let use = folder || '';
  if (!use && isAbsolute(p)) use = dirName(p);
  const rel = (use && relPath(use, p)) || p || name;
  return { file: { rel, name: name || baseName(p), bytes: bytes | 0, sha256: String(sha256 || ''), pageOffset: offsetOf(pageOffset) }, folder: !folder && use ? use : null };
}

// A page offset typed ("18", "+18", "-2"), as a whole number.
export const offsetOf = (v) => { const n = parseInt(String(v ?? '0').replace(/^\+/, ''), 10); return Number.isFinite(n) ? n : 0; };

// The file's page of a quote's printed page: printed + offset ("p. 112" + 18 = 130). Front matter
// (p. xiv) has none: null.
export function filePage(anchor, offset) {
  const p = pageOf(anchor);
  return /^\d+$/.test(p) ? Number(p) + offsetOf(offset) : null;
}

// Whether a file picked again is the one kept: 'same', 'changed' (same name, other bytes) or 'other'.
export function verify(kept, got) {
  if (!kept || !got) return 'other';
  if (kept.sha256 && got.sha256 === kept.sha256) return 'same';
  return got.name === kept.name ? 'changed' : 'other';
}

// The words Copy path puts on the clipboard: the whole path, and for a quote its page and the
// file's page ("…/darwin.pdf, p. 112 (PDF page 130)").
export function pathAndPage(file, folder, anchor = '') {
  if (!file?.rel) return '';
  const path = fullPath(folder, file.rel);
  if (!anchor) return path;
  const fp = filePage(anchor, file.pageOffset);
  return `${path}, ${anchor}${fp != null && fp !== Number(pageOf(anchor)) ? ` (file page ${fp})` : ''}`;
}

// A file's size in words: 812 KB, 3.4 MB.
export function sizeOf(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} bytes`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// A DOI or URL as an https address to open, or null.
export function linkOf(src) {
  const doi = String(src?.doi || '').trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '');
  if (doi && /^10\.\S+\/\S+$/.test(doi)) return `https://doi.org/${doi}`;
  const url = String(src?.url || '').trim();
  return /^https:\/\//i.test(url) ? url : /^http:\/\//i.test(url) ? url.replace(/^http:/i, 'https:') : null;
}
