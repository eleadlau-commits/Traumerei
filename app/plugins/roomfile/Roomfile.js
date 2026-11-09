// Room files: a room in and out as one .traum file, and edited as one. The file is the six tables
// as text (Law 8): the world's own carrier reads and writes it (t.carriers; FORMAT.md is the spec),
// so this plugin only says where, shows the card and downloads. A file comes in as a new room or
// into a room; before anything changes, a quiet card says what will arrive and what couldn't be
// read, and Import lands it all as one step. A plain Markdown file comes in as loose thoughts.

import { Feature, ui } from 'folio';
import { plain } from './plain.js';

const { el } = ui;
const FILE = /\.(traum|md|markdown|txt)$/i;
const isRoomFile = (f) => !!f && (FILE.test(f.name || '') || /markdown|text\/plain/.test(f.type || ''));
const REPORT = 8; // lines of the report the card shows
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
export const fileName = (name) => `${String(name || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'}.traum`;

// What a read file holds, in words: "2 groups, 12 thoughts, 1 picture" (the root left out).
export function summary(got) {
  const n = { groups: 0, thoughts: 0, pictures: 0, rooms: 0 };
  for (const m of got.tables.marks) {
    if (m.id === got.root) continue;
    const k = m.body?.kind;
    if (k === 'group') n.groups++; else if (k === 'room') n.rooms++; else if (k !== 'context') { n.thoughts++; if (k === 'picture') n.pictures++; }
  }
  n.text = [n.rooms && plural(n.rooms, 'room'), plural(n.groups, 'group'), plural(n.thoughts, 'thought'), n.pictures && plural(n.pictures, 'picture')].filter(Boolean).join(', ');
  return n;
}

// Pictures in an edited text show as picture:N, so a line is not a page of letters; full() puts
// them back. One table per editing session.
function shortPictures() {
  const full = new Map(), short = new Map();
  return {
    short: (text) => text.replace(/^(src|content\.src): (data:\S+)$/gm, (all, k, data) => {
      if (!short.has(data)) { const id = `picture:${short.size + 1}`; short.set(data, id); full.set(id, data); }
      return `${k}: ${short.get(data)}`;
    }),
    full: (text) => text.replace(/^(src|content\.src): (picture:\d+)$/gm, (all, k, id) => `${k}: ${full.get(id) ?? id}`),
  };
}

export default class Roomfile extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Room files needs the plugin API');
    this.t = t;
    this.source = this.use('source'); // the source editor (the source plugin), for editing as text, or null
    t.slots.formats.add({
      id: 'traum',
      name: 'Room file (.traum)',
      accepts: isRoomFile,
      importRoom: (o) => this.importRoom(o),
      importInto: (roomId, o) => this.importInto(roomId, o),
      exportRoom: (id) => this.exportRoom(id),
      canEdit: () => !!this.source,
      editGroup: (roomId, groupId, o) => this.edit(groupId, o),
      editRoom: (roomId, o) => this.edit(roomId, o),
      cancel: () => this.card?.close(),
    });
  }

  // Switched off: an open card goes (as Cancel).
  stop() { this.card?.close(); }

  pick() { return this.t.ui.files.open('.traum,.md,.markdown,.txt,text/markdown,text/plain'); }

  // The file read as the six tables ({ tables, root, report }): a traum/3 file by the carrier,
  // anything else as plain Markdown. Pictures at an https address are fetched and shrunk as pasted
  // ones are; one that can't be keeps its address and says so. Null when it can't be read.
  async read(file) {
    let text;
    try { text = await file.text(); } catch { this.toast('That file couldn\'t be read.'); return null; }
    const name = file.name.replace(FILE, '') || 'Untitled';
    if (/^\s*---\s*\n(?:.*\n)*?format:\s*room\/2/.test(text)) { this.toast('That room file is of an older format (room/2), which is no longer read.'); return null; }
    const got = this.t.carriers.read(text);
    const out = got ? JSON.parse(JSON.stringify(got)) : plain(text, name);
    for (const m of out.tables.marks) {
      const src = m.body?.kind === 'picture' ? m.body.content?.src : null;
      if (typeof src !== 'string' || !/^https?:\/\//i.test(src)) continue;
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(res.status);
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) throw new Error('not a picture');
        m.body.content.src = await this.t.parts.pictures.keepOrShrink(blob);
      } catch { out.report.push(`The picture at ${src} couldn't be fetched, so it came in as its address.`); m.body = { kind: 'line', content: { text: src } }; }
    }
    return out;
  }

  // A new room from a file (picked, if none is given) on floor `page`, in `cell` if it is free
  // (else that floor's first free one, else a new floor). ok(): whether it is still wanted. One
  // step; resolves with the new room's id, or null.
  async importRoom({ file = null, cell = null, page = 0, ok = () => true } = {}) {
    file ||= await this.pick();
    if (!file) return null;
    const got = await this.read(file);
    if (!got || !ok()) return null;
    const name = got.tables.marks.find((m) => m.id === got.root)?.body?.content?.name || 'A new room';
    if (!await this.ask('Import a room', name, got) || !ok()) return null;
    const out = this.t.carriers.land(got, { page, cell });
    if (!out.ok) { this.toast(out.reason); return null; }
    return this.t.marks.get(out.id);
  }

  // A file's marks into a room, as new ones (the file's own room gives only what is in it).
  // before(): called just before the world changes. One step; resolves true once landed.
  async importInto(roomId, { file = null, ok = () => true, before = () => {} } = {}) {
    if (this.t.distance.shut(roomId)) { this.toast('This room is locked.'); return false; }
    file ||= await this.pick();
    if (!file) return false;
    const got = await this.read(file);
    if (!got || !ok()) return false;
    if (!await this.ask('Import into this room', this.t.marks.get(roomId)?.name || '', got) || !ok()) return false;
    before();
    const out = this.t.carriers.land(got, { into: roomId });
    if (!out.ok) { this.toast(out.reason); return false; }
    return true;
  }

  // A room, or a group with its parts, as .traum text in the source editor (the world's own ids,
  // so Apply writes it back over what it was: the carrier's replace). What Apply would do is
  // checked as it is typed. A locked room shows it read only. One step.
  async edit(id, { before = () => {}, ok = () => true } = {}) {
    if (!this.source || !this.t.marks.get(id)) return false;
    const pictures = shortPictures();
    const mark = this.t.marks.get(id);
    const title = mark.kind === 'room' ? mark.name : mark.title || 'A group';
    const text = () => pictures.short(this.t.carriers.text(id, { ids: 'real' }));
    const readOnly = this.t.distance.shut(id);
    const check = (typed) => {
      const got = this.t.carriers.read(pictures.full(typed));
      if (!got) return { summary: 'Not a traum/3 text', changes: [], report: ['The front matter must say format: traum/3.'], blocked: true };
      const n = this.t.carriers.check(id, got);
      const doing = n.ok ? [n.kept && `${n.kept} kept`, n.changed && `${n.changed} changed`, n.made && `${n.made} new`, n.deleted && `${n.deleted} deleted`].filter(Boolean).join(', ') : '';
      return { summary: [summary(got).text, readOnly ? '' : doing].filter(Boolean).join(' · '), changes: [], report: [...got.report, ...(n.ok ? [] : [n.reason])], blocked: !n.ok };
    };
    const apply = async (typed) => {
      const got = this.t.carriers.read(pictures.full(typed));
      if (!got || !ok() || this.t.distance.shut(id)) return false;
      const n = this.t.carriers.check(id, got);
      if (!n.ok) { this.toast(n.reason); return false; }
      before();
      const out = this.t.carriers.replace(id, got);
      if (!out.ok) this.toast(out.reason);
      return out.ok;
    };
    return this.source.open({
      kind: mark.kind === 'room' ? 'Source · whole room' : 'Source', title, text: text(), readOnly,
      fileName: fileName(title), full: (t) => pictures.full(t), reset: text, options: [],
      check, apply: readOnly ? null : apply,
      draft: `traum:${id}`, // changes closed unapplied come back next time
    });
  }

  // The quiet card: what will arrive ("2 groups, 12 thoughts") and what couldn't be read, with
  // Import (Enter) and Cancel (Escape). Resolves true for Import, or null.
  ask(kind, title, got) {
    this.card?.close();
    const n = summary(got), report = got.report || [];
    return new Promise((resolve) => {
      const box = el('div', { class: 'panel sheet roomfile-card', role: 'dialog', 'aria-label': 'Import', onpointerdown: (e) => e.stopPropagation() });
      const close = (yes = null) => { box.remove(); if (this.card === card) this.card = null; resolve(yes); };
      const card = { close: () => close(null) };
      this.card = card;
      const any = n.groups || n.thoughts || n.rooms;
      box.append(...[
        el('div', { class: 'label' }, kind),
        el('div', { class: 'roomfile-title' }, title),
        el('div', { class: 'roomfile-sum' }, any ? n.text : 'Nothing to bring in'),
        report.length ? el('ul', { class: 'roomfile-report', 'aria-label': 'What couldn\'t be read' },
          ...report.slice(0, REPORT).map((r) => el('li', {}, r)),
          report.length > REPORT ? el('li', {}, `and ${report.length - REPORT} more`) : null) : null,
        el('div', { class: 'sheet-words' },
          any ? el('button', { type: 'button', class: 'word roomfile-go', onclick: () => close(true) }, 'Import') : null,
          el('button', { type: 'button', class: 'word', onclick: () => close() }, 'Cancel'),
          el('span', { class: 'sheet-keys' }, any ? 'Enter imports · Escape cancels' : 'Escape cancels')),
      ].filter(Boolean));
      box.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'Enter' && !e.target.matches('button') && any) { e.preventDefault(); close(true); }
      };
      (document.getElementById('folio-root') || document.body).append(box);
      (box.querySelector('.roomfile-go') || box.querySelector('button'))?.focus({ preventScroll: true });
    });
  }

  // Saves a room as <its name>.traum (a locked room too): a download, or the Save dialog in the desktop app.
  async exportRoom(id) {
    const r = this.t.marks.get(id);
    if (!r) return;
    const name = fileName(r.name);
    if (await this.t.ui.files.save(name, this.t.carriers.text(id))) this.toast(`Exported ${name}`);
  }
}
