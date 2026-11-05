// Room files: a room in and out as one Markdown file ("room Markdown", format.js). A file comes
// in as a new room or into a room; before anything changes, a quiet card says what will arrive and
// what couldn't be read, and Import brings it all in as one step. A room goes out as a download.
// The rooms page and the room ask for all of it through the `roomfile` service below (README.md
// lists it), and say where: which cell and floor, which room, where in it.
// The world is the world feature's.

import { Feature, ui } from 'folio';
import { bind, room, shut, keepOrShrink, chapterName, isGroup } from './world.js';
import {
  parse, say, importRoom, importInto, exportRoom, exportGroup, plan, apply, shortPictures, badMaths,
  fileName, copyWorld, unfetched,
} from './format.js';

const { el } = ui;
const MD = /\.(md|markdown|txt)$/i;
const isRoomFile = (f) => !!f && (MD.test(f.name || '') || /markdown/.test(f.type || ''));
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
    this.picker ||= ui.filePicker('.md,.markdown,.txt,text/markdown,text/plain');
    return this.picker.pick();
  }

  // The file read, its pictures fetched and shrunk as pasted ones are. One that can't be fetched
  // becomes a line saying so. Returns the parsed file (format.js), or null.
  async read(file) {
    let text;
    try { text = await file.text(); } catch { this.toast('That file couldn\'t be read.'); return null; }
    return this.fetchPictures(parse(text));
  }

  // The text read's pictures at an address (or as data) fetched and shrunk; a short reference
  // (picture:3, from the Markdown window) is left for plan() to read.
  async fetchPictures(parsed) {
    const lists = [parsed.loose, ...parsed.groups.map((g) => g.items)];
    const wanted = (x) => x.kind === 'picture' && !/^picture:\d+$/.test(x.url || '');
    if (lists.some((l) => l.some((x) => wanted(x) && x.url))) this.toast('Fetching pictures…');
    for (const list of lists) {
      for (let k = 0; k < list.length; k++) {
        const it = list[k];
        if (!wanted(it)) continue;
        try {
          let blob;
          if (it.src) blob = await (await fetch(it.src)).blob();
          else if (/^https?:\/\//i.test(it.url)) {
            const res = await fetch(it.url);
            if (!res.ok) throw new Error(res.status);
            blob = await res.blob();
          } else throw new Error('no address');
          if (!blob.type.startsWith('image/')) throw new Error('not a picture');
          const { url, ...rest } = it;
          list[k] = { ...rest, src: await keepOrShrink(blob, it.src) };
        } catch {
          list[k] = unfetched(it, parsed.report);
        }
      }
    }
    return parsed;
  }

  // A new room from a file (picked, if none is given) on floor `page`, placed by the floors feature:
  // in `cell` if it is free, else that floor's first free one, else a new floor (its `page` says
  // which). ok(): whether it is still wanted (asked before the card shows and on Import). Resolves
  // with the new room once it is in the world (the caller saves), or null.
  async importRoom({ file = null, cell = null, page = 0, ok = () => true } = {}) {
    file ||= await this.pick();
    if (!file) return null;
    const parsed = await this.read(file);
    if (!parsed || !ok()) return null;
    const opts = () => ({
      ontologies: this.w.ontologies, now: Date.now(), page,
      globals: this.w.globals, name: file.name.replace(MD, '') || 'Untitled',
    });
    const dry = importRoom(copyWorld(this.w.world), parsed, opts());
    if (!await this.ask('Import a room', dry.room?.name || 'A new room', dry) || !ok()) return null;
    const out = importRoom(this.w.world, parsed, opts());
    if (!out.room) { this.toast('A room couldn\'t be made.'); return null; }
    this.floors?.place(out.room.id, cell);
    return out.room;
  }

  // A file's groups and thoughts into a room, as its own mode sees them. at(): where new trains
  // start; ok(): whether it is still wanted; before(): called just before the world changes. When
  // a heading matches a group already there, the card offers to replace the matching groups.
  // Resolves true once they are in the world (the caller saves).
  async importInto(roomId, { file = null, at = () => null, ok = () => true, before = () => {} } = {}) {
    if (shut(this.w.world, roomId)) { this.toast('This room is locked.'); return false; }
    file ||= await this.pick();
    if (!file) return false;
    const parsed = await this.read(file);
    if (!parsed || !ok()) return false;
    const opts = () => ({ ontologies: this.w.ontologies, now: Date.now(), at: at() });
    const dry = importInto(copyWorld(this.w.world), roomId, parsed, opts());
    const p = plan(this.w.world, roomId, parsed, { scope: 'import', ontologies: this.w.ontologies });
    const name = room(this.w.world, roomId)?.name || '';
    let choice;
    if (p.replace.length) {
      const n = p.replace.length, word = p.word;
      choice = await this.ask('Import into this room', name, {
        sum: `${say(dry.made)}. ${n} ${n === 1 ? `${word} has` : `${word}s have`} the name of one already here.`,
        report: [...p.arrowChanges, ...p.report],
        buttons: [['replace', 'Replace matching groups'], ['add', 'Add all as new']],
      });
    } else choice = (await this.ask('Import into this room', name, dry)) ? 'add' : null;
    if (!choice || !ok() || shut(this.w.world, roomId)) return false;
    before();
    if (choice === 'replace') apply(this.w.world, roomId, plan(this.w.world, roomId, parsed, { scope: 'import', ontologies: this.w.ontologies }));
    else importInto(this.w.world, roomId, parsed, opts());
    return true;
  }

  // ---- Editing as Markdown, in the source editor ----

  // A group (scope 'group', groupId) or the whole room (scope 'room') as room Markdown in the
  // source editor, with what Apply would do checked as it is typed. A locked room shows it read
  // only. before(): called just before the world changes; ok(): whether it is still wanted.
  // Resolves true once Apply has changed the world (the caller saves, as one step).
  async edit(roomId, { scope, groupId = null, before = () => {}, ok = () => true }) {
    const w = () => this.w.world;
    if (!this.source) return false;
    if (!room(w(), roomId) || (scope === 'group' && !isGroup(w().things[groupId]))) return false;
    const pictures = shortPictures();
    const ontologies = () => this.w.ontologies;
    const write = () => (scope === 'group' ? exportGroup(w(), roomId, groupId, { pictures }) : exportRoom(w(), roomId, { ontologies: ontologies(), pictures }));
    const title = scope === 'group' ? chapterName(w(), groupId) || 'Untitled' : room(w(), roomId).name;
    const readOnly = shut(w(), roomId);
    const opts = { scope, groupId, ontologies: ontologies(), pictures };
    const check = (text, chosen = {}) => {
      const parsed = parse(text);
      const p = plan(w(), roomId, parsed, opts);
      const n = { groups: parsed.groups.length, thoughts: parsed.loose.length + parsed.groups.reduce((s, g) => s + g.items.length, 0) };
      const holds = `${count(n.groups, p.word)}, ${count(n.thoughts, 'thought')}`;
      const c = p.counts;
      const doing = c && !readOnly ? [c.kept && `${c.kept} kept`, c.made && `${c.made} new`, c.deleted && `${c.deleted} deleted`].filter(Boolean).join(', ') : '';
      const t = (id) => `"${w().things[id]?.title || `an untitled ${p.word}`}"`;
      const missing = p.missing.map(t);
      const changes = readOnly ? [] : [
        ...p.meta.map((m) => m.text),
        ...p.renames.map((r) => `${r.from ? `"${r.from}"` : `The untitled ${p.word}`} is renamed "${r.to}"`),
        ...p.folds.map((f) => `${t(f.id)} is ${f.folded ? 'folded' : 'unfolded'}`),
        ...p.arrowChanges,
        ...p.add.filter((g) => g.items.length).map((g) => `A new ${p.word}: ${g.title ? `"${g.title}"` : 'untitled'}`),
        ...(p.looseAdd?.length ? [`${count(p.looseAdd.length, 'thought')} above the first heading ${p.looseAdd.length === 1 ? 'is' : 'are'} added as loose`] : []),
        ...(missing.length ? [`${chosen.remove ? 'Removed' : 'Not in the text, left as they are'}: ${missing.join(', ')}`] : []),
      ];
      const report = [...p.report, ...badMaths(text).map((b) => `Line ${b.line}: KaTeX can't draw ${b.tex.length > 50 ? b.tex.slice(0, 47) + '…' : b.tex}`)];
      return {
        summary: [holds, doing].filter(Boolean).join(' · '), changes, report,
        options: scope === 'room' ? [{ key: 'remove', label: `Remove ${p.word}s not in the text`, show: !!missing.length }] : [],
        blocked: !p.of,
      };
    };
    const applyText = async (text, chosen = {}) => {
      const parsed = await this.fetchPictures(parse(text));
      if (!ok() || shut(w(), roomId)) return false;
      const p = plan(w(), roomId, parsed, opts);
      if (!p.of) { this.toast(p.report.at(-1) || 'That couldn\'t be applied.'); return false; }
      before();
      apply(w(), roomId, p, { removeMissing: !!chosen.remove });
      return true;
    };
    return this.source.open({
      kind: scope === 'group' ? 'Source' : 'Source · whole room', title, text: write(), readOnly,
      fileName: fileName(title), full: (t) => pictures.full(t), reset: write,
      options: scope === 'room' ? [{ key: 'remove', label: 'Remove groups not in the text', value: false }] : [],
      check, apply: readOnly ? null : applyText,
      draft: scope === 'group' ? `group:${groupId}` : `room:${roomId}`, // changes closed unapplied come back next time
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

  // Downloads a room as <its name>.md (a locked room too).
  exportRoom(id) {
    const r = room(this.w.world, id);
    if (!r) return;
    const text = exportRoom(this.w.world, id, { ontologies: this.w.ontologies });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = el('a', { href: url, download: fileName(r.name), hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.toast(`Exported ${fileName(r.name)}`);
  }
}
