// Part of Create. Room Markdown (roomfile.js): a file brought in as a new room (rooms page: an
// empty cell's choices, the menu, or a file dropped on the page) or into the open room (Add, or a
// file dropped on the canvas), and a room taken out as a file (its properties, or Add inside).
// Before anything changes, a quiet card says what will arrive and what couldn't be read; Import
// brings it all in as one step, so one Ctrl+Z takes it back.
// Its methods join the Create class (see mixIn in Create.js), so `this` is Create.

import { ui } from 'folio';
import { room, keepOrShrink } from './world.js';
import { parse, say, importRoom, importInto, exportRoom, fileName, copyWorld, unfetched } from './roomfile.js';
import { el } from './shared.js';

const MD = /\.(md|markdown|txt)$/i;
export const isRoomFile = (f) => !!f && (MD.test(f.name || '') || /markdown/.test(f.type || ''));
const REPORT = 8; // lines of the report the card shows

export class Files {
  // Files dropped anywhere in Create: on the rooms page a new room, in a room into it.
  listenForFiles() {
    const files = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    this.root.addEventListener('dragover', (e) => { if (files(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.root.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(isRoomFile);
      if (!file) { this.toast('Only a room Markdown file (.md) can be dropped here.'); return; }
      if (this.roomId) this.importIntoRoom(file); else this.importRoomFile(file);
    });
  }

  pickRoomFile() {
    this.mdPicker ||= ui.filePicker('.md,.markdown,.txt,text/markdown,text/plain');
    return this.mdPicker.pick();
  }

  // The file read, its pictures fetched and shrunk as pasted ones are. One that can't be fetched
  // becomes a line saying so. Returns the parsed file (roomfile.js), or null.
  async readRoomFile(file) {
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

  // On the rooms page: a new room from a file, in `cell` (or the first free one).
  async importRoomFile(file = null, cell = null) {
    file ||= await this.pickRoomFile();
    if (!file) return;
    const parsed = await this.readRoomFile(file);
    if (!parsed || this.root.hidden) return;
    const page = this.shelf ? 0 : this.page;
    const opts = () => ({
      ontologies: this.ontologies, now: Date.now(), cell, cols: this.cols || this.gridSize().cols, page,
      globals: this.ontPrefs, name: file.name.replace(MD, '') || 'Untitled',
    });
    const dry = importRoom(copyWorld(this.world), parsed, opts());
    this.askImport('Import a room', dry.room?.name || 'A new room', dry, () => {
      const out = importRoom(this.world, parsed, opts());
      if (!out.room) { this.toast('A room couldn\'t be made.'); return; }
      this.making = this.roomSel = null;
      this.roomPick = out.room.id;
      this.save();
      if (this.roomId) this.showRooms();
      if (this.shelf) this.toggleShelf();
      if (this.page !== page) this.showPage(page); else this.drawRooms();
      this.toast(`${out.room.name} is here. Ctrl+Z takes it back.`);
    });
  }

  // In a room: the file's groups and thoughts join it, as its own mode sees them.
  async importIntoRoom(file = null) {
    if (!this.roomId) return;
    if (this.locked) { this.toast('This room is locked.'); return; }
    file ||= await this.pickRoomFile();
    if (!file) return;
    const roomId = this.roomId;
    const parsed = await this.readRoomFile(file);
    if (!parsed || this.roomId !== roomId) return;
    const opts = () => ({ ontologies: this.ontologies, now: Date.now(), at: this.freeSpot() });
    const dry = importInto(copyWorld(this.world), roomId, parsed, opts());
    this.askImport('Import into this room', room(this.world, roomId)?.name || '', dry, () => {
      if (this.roomId !== roomId || this.locked) return;
      if (this.draft) this.commit();
      importInto(this.world, roomId, parsed, opts());
      this.sel = null;
      this.save();
      this.drawRoom();
      this.toast('Imported. Ctrl+Z takes it back.');
    });
  }

  // The quiet card: what will arrive ("12 groups, 85 thoughts, 2 pictures") and what couldn't be
  // read, with Import (Enter) and Cancel (Escape).
  askImport(kind, title, { made, report }, go) {
    const box = this.importBox;
    const close = () => { box.hidden = true; box.replaceChildren(); };
    const yes = () => { close(); go(); };
    const shown = report.slice(0, REPORT);
    box.replaceChildren(...[
      el('div', { class: 'create-sheet-kind' }, kind),
      el('div', { class: 'create-import-title' }, title),
      el('div', { class: 'create-import-sum' }, made.groups || made.thoughts ? say(made) : 'Nothing to bring in'),
      report.length ? el('ul', { class: 'create-import-report', 'aria-label': 'What couldn\'t be read' },
        ...shown.map((r) => el('li', {}, r)),
        report.length > REPORT ? el('li', {}, `and ${report.length - REPORT} more`) : null) : null,
      el('div', { class: 'create-sheet-words' },
        made.groups || made.thoughts ? el('button', { type: 'button', class: 'create-word create-import-go', onclick: yes }, 'Import') : null,
        el('button', { type: 'button', class: 'create-word', onclick: close }, 'Cancel'),
        el('span', { class: 'create-keys' }, 'Enter imports · Escape cancels')),
    ].filter(Boolean));
    box.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Enter' && !e.target.matches('button')) { e.preventDefault(); yes(); }
    };
    box.hidden = false;
    (box.querySelector('.create-import-go') || box.querySelector('button'))?.focus({ preventScroll: true });
  }

  // Downloads a room as <its name>.md (a locked room too).
  exportRoomFile(id = this.roomId) {
    const r = room(this.world, id);
    if (!r) return;
    const text = exportRoom(this.world, id, { ontologies: this.ontologies });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = el('a', { href: url, download: fileName(r.name), hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.toast(`Exported ${fileName(r.name)}`);
  }
}
