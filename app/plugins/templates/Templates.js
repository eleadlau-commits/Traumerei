// Templates: where a first run starts. The first time the app opens with nothing written, a
// chooser sits over Home: four rooms that start in a shape people already know (a to-do list, an
// essay, reading notes, a weekly plan), each of which runs out within the first hour where one of
// the primitives takes over, or Start empty. A choice lands the room on the first floor and goes
// into it. Afterwards the chooser is under ⋯ More (Templates) and is a command.
//
// The rooms are .traum text (rules.js), landed through t.carriers: a template adds no primitive,
// mode or plugin, only marks, places, links, gaps and moments.
//
// A plugin. It reaches the app only through the plugin API, the `traumerei` service
// (app/core/API.md: t.marks.in, t.parts.model.MESSY, t.carriers.read/land, t.ui.open.room,
// t.slots.more, t.slots.commands), never another feature's files.
//
// Saved data: 'seen' → true once the chooser has been answered (a template, or Start empty).

import { Feature, ui } from 'folio';
import { TEMPLATES, fresh } from './rules.js';

const { el } = ui;

export default class Templates extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;
    t.slots.more.add({ id: 'templates', label: 'Templates', order: 80, run: () => this.show(),
      icon: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
      title: () => 'A new room from a template' });
    t.slots.commands.add({ id: 'templates.show', zone: 'everywhere', order: 80,
      words: 'Templates: a new room that starts as a to-do list, an essay, reading notes or a weekly plan', run: () => this.show() });
    if (this.isFresh()) this.show();
  }

  isFresh() {
    try {
      const rooms = this.t.marks.in(null).length;
      const inMessy = this.t.marks.in(this.t.parts.model.MESSY).length;
      return fresh({ seen: !!this.storage.get('seen', false), rooms, inMessy });
    } catch { return false; }
  }

  // The chooser: a sheet over a faint shade. Escape, a click on the shade or Start empty put it away.
  show() {
    if (this.layer) return;
    const row = (name, note, run) => el('button', { type: 'button', class: 'pick templates-pick', onclick: run },
      el('span', {}, name), el('span', { class: 'pick-note' }, note));
    const sheet = el('div', { class: 'panel sheet templates-sheet', role: 'dialog', 'aria-label': 'Start from a template' },
      el('div', { class: 'sub-head' }, 'Start from something familiar'),
      el('p', { class: 'hint' }, 'Each is a ready room in a shape you know. Within the first hour it runs out, and Träumerei takes over: that is the point of it.'),
      el('div', { class: 'templates-list' }, TEMPLATES.map((tpl) => row(tpl.name, tpl.note, () => this.choose(tpl)))),
      el('div', { class: 'sheet-words' },
        el('button', { type: 'button', class: 'word', onclick: () => this.close(true) }, 'Start empty'),
        el('span', { class: 'sheet-keys' }, 'Esc')));
    this.layer = el('div', { class: 'templates-layer' }, el('div', { class: 'shade', onclick: () => this.close(true) }), sheet);
    this.layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(true); } });
    this.attach(this.layer);
    this.whenStopped(() => this.close(false));
    sheet.querySelector('.templates-pick')?.focus();
  }

  close(answered) {
    if (answered) this.storage.set('seen', true);
    this.layer?.remove();
    this.layer = null;
  }

  // A template chosen: its room lands on the first floor as one step, and the app goes into it.
  choose(tpl) {
    const got = this.t.carriers.read(tpl.make(Date.now()));
    const out = got ? this.t.carriers.land(got) : { ok: false };
    this.close(true);
    if (!out.ok) { this.t.ui.toast(`${tpl.name} could not be made${out.reason ? `: ${out.reason}` : ''}`); return; }
    this.t.ui.open.room(out.id);
  }
}
