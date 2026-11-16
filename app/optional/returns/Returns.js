// Returns: what comes back to you. A thought can be asked to come back due by a day, to be
// revisited on a day, or with a note left for the next time it or its room is opened (the
// kernel's moments ahead, app/core/KERNEL.md, phase 7). When its time comes, or its room is gone
// into, it is back: in the Returns tab of the left dock, beside Loose, where each one is met,
// put off, or refused, and every answer is a moment in the record (Ctrl+Z takes it back). The
// tab opens by itself when something comes back; Ctrl+Alt+R shows or hides it. An Editor section
// asks for a return on the chosen thought.
//
// A plugin. It reaches the app only through the plugin API, the `traumerei` service
// (app/core/API.md: t.moments.ahead/returns/next/due/revisit/note/meet/refuse/clear), never
// another feature's files; the compiler leaves out a plugin that does. Everything it adds through
// the API is taken away again when it is switched off in Settings → Plugins.
//
// Saved data: none (what is to come is the world's own, in the moments table).

import { Feature, ui } from 'folio';
import { why, stateLine, morning, fromField, firstLine, label, LATER } from './rules.js';

const { el } = ui;
const KEY = 'returns';

export default class Returns extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;
    this.seen = new Set(); // marks already shown back this session: a new one opens the tab
    t.slots.editor.add({ id: 'returns', order: 45, when: (x) => !!t.marks.get(x.id), render: (x) => this.section(x) });
    t.slots.commands.add({ id: 'returns.show', keys: ['Ctrl+Alt+R'], zone: 'everywhere', order: 62,
      words: 'Returns: show or hide what came back to you', run: () => this.toggle() });
    t.slots.commands.add({ id: 'returns.note', keys: ['Ctrl+Alt+N'], zone: 'room', order: 63,
      words: 'Returns: leave a note for the next visit to this room', when: () => !!t.ui.chosen(), run: () => this.show(true) });
    t.slots.more.add({ id: 'returns', label: 'Returns', order: 30, run: () => this.toggle(), on: () => !!t.ui.docks?.left.isShowing(KEY),
      icon: 'bell', title: () => 'Show or hide Returns: what came back to you' });
    t.moments.on(() => this.changed());
    this.on('room:open', () => setTimeout(() => this.render(), 0)); // the note field follows the room open
    setTimeout(() => this.changed(), 0); // what came back while the app was shut: shown once the docks stand
  }

  get dock() { return this.t.ui.docks?.left || null; }

  // Something landed: the tab shows what is back now, and opens by itself for a new return.
  changed() {
    const back = this.t.moments.returns();
    const fresh = back.some((r) => !this.seen.has(r.mark));
    for (const r of back) this.seen.add(r.mark);
    if (this.dock?.isOpen(KEY)) this.render();
    else if (fresh) this.show(false);
  }

  toggle() { if (this.dock?.isShowing(KEY)) this.dock.close(KEY, true); else this.show(false); }

  // Opens the tab (or brings it to the front); note: the field for a note to the room has focus.
  async show(note) {
    if (!this.dock) return;
    if (!this.dock.isOpen(KEY)) {
      this.body = el('div', { class: 'returns' });
      this.handle = await this.dock.open({ key: KEY, tab: 'Returns', kind: '', title: '', label: label(0), body: this.body,
        onClose: () => { this.handle = null; this.body = null; } });
      if (!this.handle) return;
    } else this.dock.show(KEY);
    this.render();
    if (note) this.body?.querySelector('.returns-note input')?.focus();
  }

  // The tab's body: what is back, a note for this room, what is still to come.
  render() {
    if (!this.body) return;
    const t = this.t, now = Date.now();
    const back = t.moments.returns();
    const coming = t.moments.ahead();
    this.handle?.setLabel?.(label(back.length));
    this.handle?.setTitle?.(back.length ? `${back.length} back` : 'Nothing back');
    const act = (r) => { if (!r.ok) t.ui.toast(r.reason); };
    const word = (text, title, onclick) => el('button', { type: 'button', class: 'word', title, onclick }, text);
    const item = (r, buttons) => el('li', { class: 'returns-item' },
      el('div', { class: 'returns-what' }, firstLine(t.marks.text(r.mark) || t.marks.get(r.mark)?.name)),
      el('div', { class: 'returns-why' }, why(r, now), this.where(r.mark)),
      r.note ? el('div', { class: 'returns-note-text' }, r.note) : null,
      el('div', { class: 'returns-words' }, ...buttons));
    const parts = [];
    if (back.length) {
      parts.push(el('ul', { class: 'returns-list' }, ...back.map((r) => item(r, [
        word('Go', 'Go to it', () => this.go(r.mark)),
        word('Met', 'Taken up: it leaves Returns', () => act(t.moments.meet(r.mark))),
        word('Tomorrow', 'Put it off to tomorrow morning', () => act(t.moments.revisit(r.mark, morning(Date.now(), 1), r.note || ''))),
        word('Refuse', 'Turn it down: the refusal stays in the record', () => act(t.moments.refuse(r.mark))),
      ]))));
    } else parts.push(el('p', { class: 'hint' }, 'Nothing has come back. Ask a thought to come back from the Editor: due on a day, to revisit, or with a note for the next visit.'));
    if (t.ui.chosen()) {
      const input = el('input', { type: 'text', placeholder: 'A note for the next visit to this room', 'aria-label': 'A note for the next visit to this room' });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.ctrlKey) return;
        e.preventDefault();
        const room = t.ui.chosen()?.context; // (the room open when Enter is pressed)
        if (!room) { t.ui.toast('Go into a room to leave it a note'); return; }
        const r = t.moments.note(room, input.value);
        if (r.ok) { input.value = ''; t.ui.toast('It will be here when you come back'); } else act(r);
      });
      parts.push(el('div', { class: 'returns-note' }, el('div', { class: 'label' }, 'Next time'), input));
    }
    if (coming.length) {
      parts.push(el('div', { class: 'label' }, 'Coming'));
      parts.push(el('ul', { class: 'returns-list returns-coming' }, ...coming.slice(0, 30).map((r) => item(r, [
        word('Take back', 'It will not come back', () => act(t.moments.clear(r.mark))),
      ]))));
    }
    this.body.replaceChildren(...parts);
  }

  // " · in Thesis", for a mark that sits in a room.
  where(mark) {
    const home = this.t.places.home(mark);
    const room = home && this.t.marks.get(home);
    return room && room.kind === 'room' ? ` · in ${room.name || 'a room'}` : '';
  }

  go(mark) {
    const th = this.t.marks.get(mark);
    if (!th) return;
    this.t.ui.open.room(th.kind === 'room' ? mark : this.t.places.home(mark));
  }

  // The Editor's section: the thought's return as it is, and how to ask for one.
  section(x) {
    const t = this.t;
    const r = t.moments.next(x.id);
    const act = (out) => { if (out.ok) x.refresh(); else t.ui.toast(out.reason); };
    const off = x.locked ? '' : null;
    const word = (text, title, onclick) => el('button', { type: 'button', class: 'word', title, onclick, disabled: off }, text);
    const date = el('input', { type: 'date', 'aria-label': 'Due on', disabled: off });
    date.addEventListener('change', () => { const at = fromField(date.value); if (at != null) act(t.moments.due(x.id, at)); });
    const note = el('input', { type: 'text', placeholder: 'A note for next time', 'aria-label': 'A note for the next visit', disabled: off });
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); act(t.moments.note(x.id, note.value)); } });
    const live = r && (r.state === 'waiting' || r.state === 'back');
    return el('div', { class: 'returns-section' },
      el('div', { class: 'label' }, 'Return'),
      r ? el('div', { class: 'returns-line' }, stateLine(r), r.note ? ` · ${r.note}` : '') : null,
      el('div', { class: 'returns-words' },
        ...LATER.map((l) => word(l.label, `Revisit ${l.label.toLowerCase()}, in the morning`, () => act(t.moments.revisit(x.id, morning(Date.now(), l.days))))),
        live ? word('Take back', 'It will not come back', () => act(t.moments.clear(x.id))) : null),
      el('label', { class: 'returns-due' }, 'Due ', date),
      note);
  }
}
