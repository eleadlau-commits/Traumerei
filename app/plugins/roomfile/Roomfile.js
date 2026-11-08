// Room files: a room in and out as one .traum file (traum.js; FORMAT.md is the spec). A file comes
// in as a new room or into a room; before anything changes, a quiet card says what will arrive and
// what couldn't be read, and Import brings it all in as one step. A room goes out as a download.
// The rooms page and the room ask for all of it through the `roomfile` service below (README.md
// lists it), and say where: which cell and floor, which room, where in it.
// The world is the world feature's.

import { Feature, ui } from 'folio';
import { bind, room, shut, keepOrShrink, chapterName, isGroup } from './world.js';
import * as edit from './edit.js';
import * as traum from './traum.js';
import { parse as parseTraum } from './grammar.js';
import { plain } from './plain.js';

const { el } = ui;
const FILE = /\.(traum|md|markdown|txt)$/i;
const isRoomFile = (f) => !!f && (FILE.test(f.name || '') || /markdown|text\/plain/.test(f.type || ''));
// A .traum file, or text written in its shape (front matter with format:, or a # Objects line);
// anything else is plain Markdown, brought in as loose thoughts.
const isTraum = (name, text) => /\.traum$/i.test(name || '') || /^---\s*\n(?:.*\n)*?format:\s/.test(text) || /^#\s+Objects\s*$/m.test(text);
const say = traum.say;
const REPORT = 8; // lines of the report the card shows
const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

export default class Roomfile extends Feature {
  start() {
    this.w = this.use('world');
    bind(this.w.lib);
    this.source = this.use('source'); // the source editor, for editing as Markdown, or null
    this.floors = this.use('floors'); // where a new room goes on the rooms page, or null
    this.provide('roomfile', {
      isRoomFile,
      importRoom: (o) => this.importRoom(o),
      importInto: (roomId, o) => this.importInto(roomId, o),
      exportRoom: (id) => this.exportRoom(id),
      canEdit: !!this.source,
      editGroup: (roomId, groupId, o) => this.edit(roomId, { scope: 'group', groupId, ...o }),
      editRoom: (roomId, o) => this.edit(roomId, { scope: 'room', ...o }),
      cancel: () => this.card?.close(),
    });
  }

  pick() {
    this.picker ||= ui.filePicker('.traum,.md,.markdown,.txt,text/markdown,text/plain');
    return this.picker.pick();
  }

  // The file read into parts (grammar.js; a plain Markdown file as loose thoughts, plain.js), its
  // pictures fetched and shrunk as pasted ones are. Returns the parts, or null.
  async read(file) {
    let text;
    try { text = await file.text(); } catch { this.toast('That file couldn\'t be read.'); return null; }
    return this.fetchObjectPictures(isTraum(file.name, text) ? parseTraum(text) : plain(text));
  }

  // The parts' pictures at an address (or as data) fetched and shrunk; one that can't be fetched
  // keeps its address, and comes in as a line saying so.
  async fetchObjectPictures(parts) {
    const pics = parts.objects.filter((o) => o.kind === 'picture' && o.lines.join('').trim() && !/^picture:\d+$/.test(o.lines.join('').trim()));
    if (pics.some((o) => /^https?:/i.test(o.lines.join('').trim()))) this.toast('Fetching pictures…');
    for (const o of pics) {
      const at = o.lines.join('').trim();
      try {
        let blob;
        if (at.startsWith('data:')) blob = await (await fetch(at)).blob();
        else if (/^https?:\/\//i.test(at)) {
          const res = await fetch(at);
          if (!res.ok) throw new Error(res.status);
          blob = await res.blob();
        } else throw new Error('no address');
        if (!blob.type.startsWith('image/')) throw new Error('not a picture');
        o.lines = [await keepOrShrink(blob, at.startsWith('data:') ? at : undefined)];
      } catch { /* left as it is: traum.js makes it a line that says so */ }
    }
    return parts;
  }

  // A new room from a file (picked, if none is given) on floor `page`, placed by the floors feature:
  // in `cell` if it is free, else that floor's first free one, else a new floor (its `page` says
  // which). ok(): whether it is still wanted (asked before the card shows and on Import). Resolves
  // with the new room once it is in the world (the caller saves), or null.
  async importRoom({ file = null, cell = null, page = 0, ok = () => true } = {}) {
    file ||= await this.pick();
    if (!file) return null;
    const parts = await this.read(file);
    if (!parts || !ok()) return null;
    const opts = () => ({
      ontologies: this.w.ontologies, now: Date.now(), page,
      globals: this.w.globals, name: file.name.replace(FILE, '') || 'Untitled',
    });
    const dry = traum.importRoom(edit.copyWorld(this.w.world), parts, opts());
    if (!await this.ask('Import a room', dry.room?.name || 'A new room', dry) || !ok()) return null;
    const out = traum.importRoom(this.w.world, parts, opts());
    if (!out.room) { this.toast('A room couldn\'t be made.'); return null; }
    this.floors?.place(out.room.id, cell);
    return out.room;
  }

  // A file's objects and placement into a room, as new thoughts and groups (its front matter is
  // for new rooms only). at(): where new trains start; ok(): whether it is still wanted; before():
  // called just before the world changes. Resolves true once they are in the world (the caller
  // saves).
  async importInto(roomId, { file = null, at = () => null, ok = () => true, before = () => {} } = {}) {
    if (shut(this.w.world, roomId)) { this.toast('This room is locked.'); return false; }
    file ||= await this.pick();
    if (!file) return false;
    const parts = await this.read(file);
    if (!parts || !ok()) return false;
    const opts = () => ({ ontologies: this.w.ontologies, now: Date.now(), at: at() });
    const dry = traum.importInto(edit.copyWorld(this.w.world), roomId, parts, opts());
    const name = room(this.w.world, roomId)?.name || '';
    if (!await this.ask('Import into this room', name, dry) || !ok() || shut(this.w.world, roomId)) return false;
    before();
    traum.importInto(this.w.world, roomId, parts, opts());
    return true;
  }

  // ---- Editing as .traum text, in the source editor ----

  // A group (scope 'group', groupId) or the whole room (scope 'room') as .traum text in the source
  // editor (edit.js), with what Apply would do checked as it is typed. A locked room shows it read
  // only. before(): called just before the world changes; ok(): whether it is still wanted.
  // Resolves true once Apply has changed the world (the caller saves, as one step).
  async edit(roomId, { scope, groupId = null, before = () => {}, ok = () => true }) {
    const w = () => this.w.world;
    if (!this.source) return false;
    if (!room(w(), roomId) || (scope === 'group' && !isGroup(w().things[groupId]))) return false;
    const pictures = edit.shortPictures();
    const ontologies = () => this.w.ontologies;
    let session = edit.open(w(), roomId, { scope, groupId, ontologies: ontologies(), pictures });
    const title = scope === 'group' ? chapterName(w(), groupId) || 'Untitled' : room(w(), roomId).name;
    const readOnly = shut(w(), roomId);
    const opts = (chosen = {}) => ({ ontologies: ontologies(), pictures, removeMissing: !!chosen.remove });
    const check = (text, chosen = {}) => {
      const parts = parseTraum(text);
      const n = traum.summary(parts);
      const r = edit.apply(edit.copyWorld(w()), roomId, session, parts, opts(chosen));
      const c = r.counts;
      const doing = !readOnly ? [c.kept && `${c.kept} kept`, c.changed && `${c.changed} changed`, c.made && `${c.made} new`, c.deleted && `${c.deleted} deleted`].filter(Boolean).join(', ') : '';
      const report = [...r.report, ...edit.badMaths(parts).map((b) => `Line ${b.line}: KaTeX can't draw ${b.tex.length > 50 ? b.tex.slice(0, 47) + '…' : b.tex}`)];
      return {
        summary: [say(n), doing].filter(Boolean).join(' · '), changes: readOnly ? [] : r.changes, report,
        options: scope === 'room' ? [{ key: 'remove', label: 'Delete what isn\'t in the text', show: !!r.missing.length }] : [],
        blocked: r.blocked,
      };
    };
    const applyText = async (text, chosen = {}) => {
      const parts = await this.fetchObjectPictures(parseTraum(text));
      if (!ok() || shut(w(), roomId)) return false;
      const dry = edit.apply(edit.copyWorld(w()), roomId, session, parts, opts(chosen));
      if (dry.blocked) { this.toast(dry.report.at(-1) || 'That couldn\'t be applied.'); return false; }
      before();
      edit.apply(w(), roomId, session, parts, opts(chosen));
      return true;
    };
    const reset = () => { session = edit.open(w(), roomId, { scope, groupId, ontologies: ontologies(), pictures }); return session.text; };
    return this.source.open({
      kind: scope === 'group' ? 'Source' : 'Source · whole room', title, text: session.text, readOnly,
      fileName: traum.fileName(title), full: (t) => pictures.full(t), reset,
      options: scope === 'room' ? [{ key: 'remove', label: 'Delete what isn\'t in the text', value: false }] : [],
      check, apply: readOnly ? null : applyText,
      draft: scope === 'group' ? `traum-group:${groupId}` : `traum-room:${roomId}`, // changes closed unapplied come back next time
    });
  }

  // The quiet card: what will arrive ("12 groups, 85 thoughts, 2 pictures") and what couldn't be
  // read, with Import (Enter) and Cancel (Escape); or, given buttons ([[value, label], …]), a choice
  // between them (the first is Enter's). Resolves true for Import, the button's value, or null.
  ask(kind, title, { made = null, report = [], sum = null, buttons = null }) {
    this.card?.close();
    return new Promise((resolve) => {
      const box = el('div', { class: 'panel sheet roomfile-card', role: 'dialog', 'aria-label': 'Import', onpointerdown: (e) => e.stopPropagation() });
      const close = (yes = null) => { box.remove(); if (this.card === card) this.card = null; resolve(yes); };
      const card = { close: () => close(null) };
      this.card = card;
      const shown = report.slice(0, REPORT);
      const any = buttons || made.groups || made.thoughts;
      const choices = buttons || (any ? [[true, 'Import']] : []);
      box.append(...[
        el('div', { class: 'label' }, kind),
        el('div', { class: 'roomfile-title' }, title),
        el('div', { class: 'roomfile-sum' }, sum || (any ? say(made) : 'Nothing to bring in')),
        report.length ? el('ul', { class: 'roomfile-report', 'aria-label': 'What couldn\'t be read' },
          ...shown.map((r) => el('li', {}, r)),
          report.length > REPORT ? el('li', {}, `and ${report.length - REPORT} more`) : null) : null,
        el('div', { class: 'sheet-words' },
          ...choices.map(([value, label], k) => el('button', { type: 'button', class: 'word' + (k ? '' : ' roomfile-go'), onclick: () => close(value) }, label)),
          el('button', { type: 'button', class: 'word', onclick: () => close() }, 'Cancel'),
          el('span', { class: 'sheet-keys' }, choices.length ? `Enter ${buttons ? 'replaces' : 'imports'} · Escape cancels` : 'Escape cancels')),
      ].filter(Boolean));
      box.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'Enter' && !e.target.matches('button') && choices.length) { e.preventDefault(); close(choices[0][0]); }
      };
      (document.getElementById('folio-root') || document.body).append(box);
      (box.querySelector('.roomfile-go') || box.querySelector('button'))?.focus({ preventScroll: true });
    });
  }

  // Downloads a room as <its name>.traum (a locked room too).
  exportRoom(id) {
    const r = room(this.w.world, id);
    if (!r) return;
    const text = traum.exportRoom(this.w.world, id, { ontologies: this.w.ontologies });
    const name = traum.fileName(r.name);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = el('a', { href: url, download: name, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.toast(`Exported ${name}`);
  }
}
