// __NAME__: __DESCRIPTION__
//
// A plugin. It reaches the app only through the plugin API, the `traumerei` service
// (app/core/API.md), never another feature's files; the compiler leaves out a plugin that does.
// Everything it adds through the API is taken away again when it is switched off in
// Settings → Plugins, so stop() only undoes what it made itself.
//
// Saved data: none. (What a plugin keeps lives in the six tables: a mark, a link, a rule row. Law 8:
// nothing else is saved.)

import { Feature, ui } from 'folio';
import { words, wordsLine } from './rules.js';

const { el } = ui;

export default class __CLASS__ extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;

    // A section in the Editor for the chosen thought: how many words it holds.
    t.slots.editor.add({
      id: '__ID__',
      order: 90,
      when: (x) => !!t.marks.get(x.id),
      render: (x) => el('p', { class: 'hint __ID__-count' }, wordsLine(words(t.marks.text(x.id)))),
    });
  }

  // Undo here only what the API did not add for you: timers, nodes put on the page, listeners on
  // window. (this.listenTo, this.attach and this.whenStopped do it for you.)
  stop() {}
}
