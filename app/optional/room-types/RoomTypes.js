// Room types: Settings → Room types. Lists every type a room can be seen through (built in, from a
// plugin, or made here); adds one from a Markdown file (file.js), edits its name and code in place,
// saves it as a rule (types.js), exports it as a .traumplug (pack.js), removes it. Copy guide puts
// the guide a model follows (guide.js) on the clipboard. Written against app/core/API.md alone.
import { Feature, ui } from 'folio';
import { makeTypes } from './types.js';
import { read, STARTER } from './file.js';
import { pack } from './pack.js';
import { COPIED } from './guide.js';

// A type's hairline icon (an SVG drawing on a 24 × 24 grid, as the rail shows it).
function iconOf(drawing) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'room-types-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = drawing || '';
  return svg;
}

export default class RoomTypes extends Feature {
  start() {
    this.t = this.use('traumerei').connect(this);
    this.types = makeTypes(this.t);
    this.types.start();
    this.editing = null; // { was, md } while the editor is open
    this.add('settings', { id: 'room-types', title: 'Room types', order: 85, render: () => {
      const box = ui.el('div', { class: 'settings-section room-types' });
      this.redraw = () => box.replaceChildren(...(this.editing ? this.editor() : this.list()));
      this.redraw();
      return box;
    } });
  }

  stop() { this.types?.stop(); }

  toast(text) { this.t.ui.toast(text); }

  // The list: every type, then the ones made here with their words.
  list() {
    const made = new Map(this.types.made().map((m) => [m.id, m]));
    const word = (label, onclick) => ui.el('button', { type: 'button', class: 'word', onclick }, label);
    const rows = [...(this.t.slots.rules.all || [])].sort((a, b) => (a.order ?? 60) - (b.order ?? 60) || String(a.name).localeCompare(b.name)).map((r) => {
      const mine = made.get(r.id);
      return ui.el('div', { class: 'feature-row' },
        iconOf(r.icon),
        ui.el('div', { class: 'feature-text' },
          ui.el('span', {}, r.name),
          ui.el('span', { class: 'hint small' }, [r.note, mine ? 'made here' : 'built in'].filter(Boolean).join(' · ')),
          mine?.errors.length ? ui.el('span', { class: 'error small' }, mine.errors[0]) : null),
        mine ? ui.el('div', { class: 'page-actions' }, word('Edit', () => this.edit(r.id)), word('Export', () => this.export(r.id)), word('Remove', () => this.remove(r.id))) : null);
    });
    // A saved type that would not start (its file broke, or its name is taken now).
    const off = [...made.values()].filter((m) => !m.on).map((m) => ui.el('div', { class: 'feature-row' },
      ui.el('div', { class: 'feature-text' }, ui.el('span', {}, m.name), ui.el('span', { class: 'error small' }, this.types.check(m.md, m.id) || 'Not started')),
      ui.el('div', { class: 'page-actions' }, word('Edit', () => this.edit(m.id)), word('Remove', () => this.remove(m.id)))));
    return [
      ui.el('p', { class: 'hint' }, 'Every way a room can be seen. Add one from a Markdown file: a name, a line on what it is for, and how it arranges thoughts, in words or in code. Copy guide gives a model everything it needs to write one.'),
      ui.el('div', { class: 'page-actions' }, word('Add from file…', () => this.fromFile()), word('New', () => this.open(null, STARTER)), word('Copy guide', () => this.copyGuide())),
      ui.el('div', { class: 'feature-list' }, ...rows, ...off),
    ];
  }

  // The editor: the type's Markdown in one box, so its name (the first heading) and its code are one file.
  editor() {
    const { was, md } = this.editing;
    const area = ui.el('textarea', { class: 'code-box room-types-text', spellcheck: 'false', rows: '22' });
    area.value = md;
    const err = ui.errorBox();
    const save = () => {
      this.editing.md = area.value;
      const r = this.types.save(area.value, was);
      if (!r.ok) { err.show(r.reason); return; }
      this.editing = null;
      this.toast(`${read(area.value).name} saved. A room in it lays out anew.`);
      this.redraw();
    };
    area.addEventListener('keydown', (e) => { if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } });
    requestAnimationFrame(() => area.focus());
    return [
      ui.el('p', { class: 'hint' }, was ? 'Edit the name (the first heading), the note and the code. Save checks it first.' : 'A new room type. Save checks it first.'),
      area, err,
      ui.el('div', { class: 'page-actions' },
        ui.el('button', { type: 'button', class: 'word', onclick: save }, 'Save'),
        ui.el('button', { type: 'button', class: 'word', onclick: () => { this.editing = null; this.redraw(); } }, 'Cancel')),
    ];
  }

  open(was, md) { this.editing = { was, md }; this.redraw?.(); }
  edit(id) { this.open(id, this.types.md(id) ?? ''); }

  async fromFile() {
    const f = await this.t.ui.files.open('.md,.markdown,.txt,text/markdown,text/plain');
    if (!f) return;
    const md = await f.text();
    const r = this.types.save(md);
    if (r.ok) { this.toast(`${read(md).name} added.`); this.redraw?.(); return; }
    this.toast(`${f.name}: ${r.reason}. Opened in the editor to fix.`);
    this.open(null, md); // what's wrong is shown, and fixed, in the editor
  }

  async export(id) {
    const file = this.types.file(id);
    if (!file) return;
    const ok = await this.t.ui.files.save(`${id}.traumplug`, pack(file, this.types.md(id), { minApp: ['draw', 'drop', 'land'].some((h) => file.hooks[h]) ? '1.0.2' : '1.0.0' }), 'text/javascript');
    if (ok) this.toast(`${file.name} exported. Import it in Settings → Plugins on another computer.`);
  }

  remove(id) {
    const name = this.types.file(id)?.name || id;
    this.types.remove(id);
    this.toast(`${name} removed. A room in it opens in Pessoa and keeps its places; add the type again to bring it back.`);
    this.redraw?.();
  }

  async copyGuide() {
    try { await navigator.clipboard.writeText(COPIED); this.toast('The guide is on the clipboard: paste it to a model, ask for a room type, save the answer as .md, then Add from file….'); }
    catch { this.t.ui.files.save('ROOM-TYPES.md', COPIED, 'text/markdown'); }
  }
}
