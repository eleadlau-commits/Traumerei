// Word count strip: the open room's word count in the strip at the foot of the canvas, a word on
// the room's bar (Words) and Ctrl+Alt+W that show or hide it, and a page of every room's count,
// from the ☰ menu. Seen from far off (the zoom's far band) the strip names the room instead, as
// a label for the map. A corpus plugin (open core, step 3): written against app/core/API.md
// alone, it proves slots.bar, slots.strip, slots.pages and ui.zoom. Saves nothing.
import { Feature, ui } from 'folio';

export const words = (text) => (String(text || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
const many = (n, one, more = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : more}`;

// A room's count: its words and its thoughts (every mark at home there but a group).
export function countRoom(t, context) {
  let n = 0, thoughts = 0;
  for (const m of t.marks.in(context)) {
    if (m.kind === 'group') continue;
    thoughts++;
    n += words(t.marks.text(m.id));
  }
  return { words: n, thoughts };
}

// What the strip says: the room's count (and the chosen thought's, when one is); under the far
// band, the room's name with its words, as a label.
export function stripText(t, context, count, band) {
  if (band === 'far') return `${t.marks.get(context)?.name || 'This room'} · ${many(count.words, 'word')}`;
  const chosen = t.ui.chosen();
  const mark = chosen && chosen.context === context && chosen.mark ? t.marks.get(chosen.mark) : null;
  const room = `${many(count.words, 'word')} in ${many(count.thoughts, 'thought')}`;
  return mark && mark.kind !== 'group' ? `${many(words(t.marks.text(mark.id)), 'word')} chosen · ${room}` : room;
}

export function install(t) {
  let shown = true; // shown while the plugin is on; the bar's word and Ctrl+Alt+W hide it again
  let band = t.ui.zoom.get()?.band || 'mid';
  // Counted once per change of the tables (moments.seq), not once per redraw.
  let memo = { context: null, seq: -1, count: null };
  const count = (context) => {
    const seq = t.moments.seq();
    if (memo.context !== context || memo.seq !== seq) memo = { context, seq, count: countRoom(t, context) };
    return memo.count;
  };
  const toggle = () => { shown = !shown; t.ui.toast(shown ? 'Word count shows in the strip' : 'Word count hidden'); };

  t.ui.zoom.on((z) => { band = z.band; });
  t.slots.strip.add({ id: 'word-count-strip', order: 50,
    visible: () => shown,
    text: (context) => stripText(t, context, count(context), band),
    title: () => 'Words in this room · click for every room\'s count',
    onClick: () => t.ui.open.page('word-counts') });
  t.slots.bar.add({ id: 'word-count-strip', label: 'Words', order: 50,
    on: () => shown, run: toggle, title: () => (shown ? 'Hide the word count · Ctrl+Alt+W' : 'Show the word count · Ctrl+Alt+W') });
  t.slots.commands.add({ id: 'word-count-strip.toggle', keys: ['Ctrl+Alt+W'], words: 'Show or hide the word count', zone: 'room', run: toggle });
  t.slots.pages.add({ id: 'word-counts', label: 'Word counts', icon: 'note', order: 55, idle: 'Every room\'s words, most first',
    render: () => {
      const rooms = t.marks.in(null).filter((m) => m.kind === 'room')
        .map((r) => ({ r, c: countRoom(t, r.id) })).sort((a, b) => b.c.words - a.c.words);
      if (!rooms.length) return ui.el('p', { class: 'hint' }, 'No rooms yet.');
      return ui.el('div', {}, ...rooms.map(({ r, c }) => ui.el('p', {},
        ui.el('button', { type: 'button', class: 'word', onclick: () => t.ui.open.room(r.id) }, r.name || 'Untitled'), ' ',
        ui.el('span', { class: 'hint small' }, `${many(c.words, 'word')} in ${many(c.thoughts, 'thought')}`))));
    } });
}

export default class WordCountStrip extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
