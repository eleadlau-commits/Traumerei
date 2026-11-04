// Room files: a room in and out as one Markdown file ("room Markdown", roomfile.js). A file comes
// in as a new room or into a room; before anything changes, a quiet card says what will arrive and
// what couldn't be read, and Import brings it all in as one step. A room goes out as a download.
// Create asks for all of it through the `roomfile` service below (README.md lists it), and says
// where: which cell and floor, which room, where in it. The world is the world feature's.

import { Feature, ui } from 'folio';
import { bind, room, shut, keepOrShrink } from './world.js';
import { parse, say, importRoom, importInto, exportRoom, fileName, copyWorld, unfetched } from './roomfile.js';

const { el } = ui;
const MD = /\.(md|markdown|txt)$/i;
const isRoomFile = (f) => !!f && (MD.test(f.name || '') || /markdown/.test(f.type || ''));
const REPORT = 8; // lines of the report the card shows

export default class Roomfile extends Feature {
  start() {
    this.w = this.use('world');
    bind(this.w.lib);
    this.provide('roomfile', {
      isRoomFile,
      importRoom: (o) => this.importRoom(o),
      importInto: (roomId, o) => this.importInto(roomId, o),
      exportRoom: (id) => this.exportRoom(id),
      cancel: () => this.card?.close(),
    });
  }

  pick() {
    this.picker ||= ui.filePicker('.md,.markdown,.txt,text/markdown,text/plain');
    return this.picker.pick();
  }

  // The file read, its pictures fetched and shrunk as pasted ones are. One that can't be fetched
  // becomes a line saying so. Returns the parsed file (roomfile.js), or null.
  async read(file) {
    let text;
    try { text = await file.text(); } catch { this.toast('That file couldn\'t be read.'); return null; }
    const parsed = parse(text);
    const lists = [parsed.loose, ...parsed.groups.map((g) => g.items)];
    if (lists.some((l) => l.some((x) => x.kind === 'picture' && x.url))) this.toast('Fetching pictures…');
    for (const list of lists) {
      for (let k = 0; k < list.length; k++) {
        const it = list[k];
        if (it.kind !== 'picture') continue;
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

  // A new room from a file (picked, if none is given) in `cell` (or the first free one) of floor
  // `page`. ok(): whether it is still wanted (asked before the card shows and on Import). Resolves
  // with the new room once it is in the world (the caller saves), or null.
  async importRoom({ file = null, cell = null, page = 0, cols = 6, ok = () => true } = {}) {
    file ||= await this.pick();
    if (!file) return null;
    const parsed = await this.read(file);
    if (!parsed || !ok()) return null;
    const opts = () => ({
      ontologies: this.w.ontologies, now: Date.now(), cell, cols, page,
      globals: this.w.globals, name: file.name.replace(MD, '') || 'Untitled',
    });
    const dry = importRoom(copyWorld(this.w.world), parsed, opts());
    if (!await this.ask('Import a room', dry.room?.name || 'A new room', dry) || !ok()) return null;
    const out = importRoom(this.w.world, parsed, opts());
    if (!out.room) { this.toast('A room couldn\'t be made.'); return null; }
    return out.room;
  }

  // A file's groups and thoughts into a room, as its own mode sees them. at(): where new trains
  // start; ok(): whether it is still wanted; before(): called just before the world changes.
  // Resolves true once they are in the world (the caller saves).
  async importInto(roomId, { file = null, at = () => null, ok = () => true, before = () => {} } = {}) {
    if (shut(this.w.world, roomId)) { this.toast('This room is locked.'); return false; }
    file ||= await this.pick();
    if (!file) return false;
    const parsed = await this.read(file);
    if (!parsed || !ok()) return false;
    const opts = () => ({ ontologies: this.w.ontologies, now: Date.now(), at: at() });
    const dry = importInto(copyWorld(this.w.world), roomId, parsed, opts());
    if (!await this.ask('Import into this room', room(this.w.world, roomId)?.name || '', dry)) return false;
    if (!ok() || shut(this.w.world, roomId)) return false;
    before();
    importInto(this.w.world, roomId, parsed, opts());
    return true;
  }

  // The quiet card: what will arrive ("12 groups, 85 thoughts, 2 pictures") and what couldn't be
  // read, with Import (Enter) and Cancel (Escape). Resolves true for Import.
  ask(kind, title, { made, report }) {
    this.card?.close();
    return new Promise((resolve) => {
      const box = el('div', { class: 'roomfile-card', role: 'dialog', 'aria-label': 'Import', onpointerdown: (e) => e.stopPropagation() });
      const close = (yes = false) => { box.remove(); if (this.card === card) this.card = null; resolve(yes); };
      const card = { close };
      this.card = card;
      const shown = report.slice(0, REPORT);
      const any = made.groups || made.thoughts;
      box.append(...[
        el('div', { class: 'roomfile-kind' }, kind),
        el('div', { class: 'roomfile-title' }, title),
        el('div', { class: 'roomfile-sum' }, any ? say(made) : 'Nothing to bring in'),
        report.length ? el('ul', { class: 'roomfile-report', 'aria-label': 'What couldn\'t be read' },
          ...shown.map((r) => el('li', {}, r)),
          report.length > REPORT ? el('li', {}, `and ${report.length - REPORT} more`) : null) : null,
        el('div', { class: 'roomfile-words' },
          any ? el('button', { type: 'button', class: 'roomfile-word roomfile-go', onclick: () => close(true) }, 'Import') : null,
          el('button', { type: 'button', class: 'roomfile-word', onclick: () => close() }, 'Cancel'),
          el('span', { class: 'roomfile-keys' }, 'Enter imports · Escape cancels')),
      ].filter(Boolean));
      box.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'Enter' && !e.target.matches('button')) { e.preventDefault(); close(true); }
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
