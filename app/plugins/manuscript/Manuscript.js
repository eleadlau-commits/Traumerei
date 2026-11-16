// Manuscript: a corpus plugin (open core 1.1.1) that reads a room as a manuscript, its chapters as
// headings in reading order, chapters within chapters to any depth, the loose thoughts last. It
// proves the join proposal with `from` (a drop moves a paragraph between chapters), the draft read
// (reads.marks.draft: the column makes room for the words being written), a kind of group's own
// fields (a chapter's `break`, drawn as a rule line) and a thin rule's choice setting (numbering).
//
// It is one way of seeing the room: chapters are groups held by part-of links, never folders. Every
// thought keeps its one home, the room; switch to Joyce or Pessoa and the same thoughts are there.
//
// Saved data: none of its own. A chapter is a group mark with its parts as links, and its `break`
// a field on it (Law 8: the tables are all that is saved).

import { Feature } from 'folio';
import { FAMILY, RULE, NUMBERS, lay, landing, dropping, chapterOf } from './rules.js';

export function install(t) {
  const measure = (text, width) => t.ui.measure(text, width);
  t.slots.groups.add({ id: FAMILY, name: 'Chapter', membership: 'many', keep: true, fields: ['break'],
    tidy: (g) => ({ ...g, break: g.break === true ? true : undefined }) });
  t.slots.rules.add({
    id: RULE, name: 'Manuscript', note: 'chapters as headings, in reading order',
    icon: '<path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/>',
    claims: [FAMILY],
    settings: [{ kind: 'choice', id: 'numbers', name: 'Numbering', options: NUMBERS, default: 'none' }],
    arrange: (reads, context, settings) => lay(reads, context, settings, measure).rows,
    draw: (reads, context, settings) => lay(reads, context, settings, measure).boxes,
    land: (reads, context, mark, x, y, settings) => landing(reads, context, mark, x, y, settings, measure),
    drop: (reads, context, mark, x, y, settings) => dropping(reads, context, mark, x, y, settings, measure),
    hand: false,
  });
  // A chapter from what is chosen (all of it: ui.chosen().marks), inside the chapter the first of
  // them is in, so chapters nest by links; one step. No keys of its own: under ? and commands.run.
  t.slots.commands.add({
    id: 'manuscript.chapter', words: 'Make a chapter of the chosen thoughts', zone: 'room', order: 60,
    when: () => { const c = t.ui.chosen(); return !!c?.marks?.length && t.marks.get(c.context)?.mode === RULE; },
    run: () => newChapter(t, t.ui.chosen()),
  });
}

// Makes a chapter of `marks` in `context`, inside the chapter the first is in (or at the top).
export function newChapter(t, { context, marks } = {}, title = 'New chapter') {
  if (!context || !marks?.length) return null;
  return t.together(() => {
    const made = t.marks.make({ kind: 'group', content: { title, of: FAMILY }, in: context });
    if (!made.ok) return null;
    const outer = chapterOf(t, marks[0]);
    if (outer) t.links.link(made.id, outer, 'part of', null, { at: Math.max(0, t.links.members(outer).indexOf(marks[0])) }); // where its first thought was
    for (const id of marks) {
      const from = chapterOf(t, id);
      t.links.link(id, made.id, 'part of');
      const link = from && t.links.from(id, 'part of').find((r) => r.to === from);
      if (link) t.links.unlink(link.id); // moved, not copied: each thought in one chapter of the manuscript
    }
    return made.id;
  });
}

export default class Manuscript extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
