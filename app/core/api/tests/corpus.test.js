// The conformance suite (kernel phase 8, the stress corpus): every corpus plugin, written against
// app/core/API.md alone, is run through one host (host.js) and must hold:
//   - the eight laws, with it on and after everything it offers has been used;
//   - its proposes refuse in words or land as steps, and never throw;
//   - switching it off takes away all it added and loses no row; on again it works the same;
//   - a .traum round-trip of the room is stable with it on;
//   - its rule arranges a 1,500-thought room within the budget (50 ms), on a frozen world (Law 3).
// The compiler checks the last rule of the corpus: no reach past the API (a plugin that imports
// another feature's files is left out of the build, and api.test.js / the build say so).

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws, deepFreeze, bigRoom } from './host.js';

// A plugin's module, from where the tests run: the built app has every feature side by side
// (features/<id>/), the source keeps plugins in their own folder (app/plugins/<id>/).
async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../plugins/${id}/${file}`, import.meta.url).href); }
}
const { zip, unzip } = await load('markdown-vault', 'zip.js');
const grid = await load('grid', 'Grid.js');
const timeline = await load('timeline', 'Timeline.js');
const calendar = await load('calendar', 'Calendar.js');
const kanban = await load('kanban', 'Kanban.js');
const outline = await load('outline', 'Outline.js');
const random = await load('random', 'Random.js');
const links = await load('links', 'Links.js');
const cites = await load('cites', 'Cites.js');
const contradicts = await load('contradicts', 'Contradicts.js');
const duplicates = await load('duplicates', 'Duplicates.js');
const translates = await load('translates', 'Translates.js');
const exampleOf = await load('example-of', 'ExampleOf.js');
const checkbox = await load('checkbox', 'Checkbox.js');
const quote = await load('quote', 'Quote.js');
const codeBlock = await load('code-block', 'CodeBlock.js');
const audioNote = await load('audio-note', 'AudioNote.js');
const pdfPage = await load('pdf-page', 'PdfPage.js');
const table = await load('table', 'Table.js');
const wordCount = await load('word-count', 'WordCount.js');
const oldestGap = await load('oldest-gap', 'OldestGap.js');
const linkGraph = await load('link-graph', 'LinkGraph.js');
const printView = await load('print-view', 'PrintView.js');
const roomOutline = await load('room-outline', 'RoomOutline.js');
const markdownVault = await load('markdown-vault', 'MarkdownVault.js');
const csvMarks = await load('csv-marks', 'CsvMarks.js');
const jsonTables = await load('json-tables', 'JsonTables.js');
const ankiDeck = await load('anki-deck', 'AnkiDeck.js');
const plainText = await load('plain-text', 'PlainText.js');
const wordLinker = await load('word-linker', 'WordLinker.js');
const dueFinder = await load('due-finder', 'DueFinder.js');
const nonsenseReader = await load('nonsense-reader', 'NonsenseReader.js');
const focusMode = await load('focus-mode', 'FocusMode.js');
const roomStats = await load('room-stats', 'RoomStats.js');
const exportRoom = await load('export-room', 'ExportRoom.js');
const pageFlow = await load('page-flow', 'PageFlow.js');
const sketch = await load('sketch', 'Sketch.js');
const chart = await load('chart', 'Chart.js');
const firstLetters = await load('first-letters', 'FirstLetters.js');
const spellMarks = await load('spell-marks', 'SpellMarks.js');
const boldItalic = await load('bold-italic', 'BoldItalic.js');
const figure = await load('figure', 'Figure.js');
const docx = await load('docx', 'Docx.js');
const wordCountStrip = await load('word-count-strip', 'WordCountStrip.js');
const highlighter = await load('highlighter', 'Highlighter.js');
const manuscript = await load('manuscript', 'Manuscript.js');
const provoke = await load('provoke', 'Provoke.js'); // phase 9's reader, held to the same suite



export const CORPUS = { grid, timeline, calendar, kanban, outline, random,
  links, cites, contradicts, duplicates, translates, 'example-of': exampleOf,
  checkbox, quote, 'code-block': codeBlock, 'audio-note': audioNote, 'pdf-page': pdfPage, table,
  'word-count': wordCount,
  'oldest-gap': oldestGap,
  'link-graph': linkGraph,
  'print-view': printView,
  'room-outline': roomOutline,
  'markdown-vault': markdownVault,
  'csv-marks': csvMarks,
  'json-tables': jsonTables,
  'anki-deck': ankiDeck,
  'plain-text': plainText,
  'word-linker': wordLinker,
  'due-finder': dueFinder,
  'nonsense-reader': nonsenseReader,
  'focus-mode': focusMode,
  'room-stats': roomStats,
  'export-room': exportRoom,
  'page-flow': pageFlow, 'first-letters': firstLetters, 'spell-marks': spellMarks, 'bold-italic': boldItalic, figure, docx,
  'word-count-strip': wordCountStrip, sketch, chart, highlighter, manuscript,
  provoke };
// A plugin that is the hands for others' additions is tried with one of them on.
const WITH = { links: ['cites'] };
// What a plugin's block says it needs, where the API checks it (a surface needs 'surface').
const NEEDS = { sketch: ['surface'], chart: ['surface'] };
const block = (id) => (NEEDS[id] ? { needs: NEEDS[id] } : {});
// A mark of each kind a plugin adds, made through the API (so its kind's fields are tried, and the
// round-trip carries it); the fields a person would write.
const SAMPLES = {
  checkbox: { text: 'buy bread' }, quote: { text: 'To be, or not', source: 'Hamlet' }, code: { code: 'let x = 1;\n  x++', lang: 'js' },
  'audio-note': { src: 'data:audio/ogg;base64,AAAA', text: 'hum' }, 'pdf-page': { src: 'data:application/pdf;base64,JVBE', page: '3', name: 'paper' },
  table: { text: 'a | b\n1 | 2' }, sketch: { strokes: [[10, 10, 40, 30, 80, 20]], text: 'a hill' }, figure: { src: 'data:image/png;base64,iVBORw0KGgo=', caption: 'A river', ratio: 0.5 },
  suggestion: { says: 'the two may speak of the same thing', act: 'link' },
};

const json = (o) => JSON.stringify(o);

// Makes a mark of each kind the plugin added, and links of each kind it declared, through the API.
function samples(host, t, id) {
  for (const { slot, item } of host.added(id)) {
    if (slot === 'world.items') {
      const r = t.marks.make({ kind: item.kind, content: SAMPLES[item.kind], in: host.room });
      assert.ok(r.ok, `${id}: a ${item.kind} could not be made: ${r.reason}`);
      assert.equal(t.marks.get(r.id).kind, item.kind);
      assert.ok(t.marks.text(r.id).length > 0, `${id}: a ${item.kind} reads no words`);
    }
    if (slot === 'links.kinds') {
      const r = t.links.link(host.ids[7], host.ids[8], item.kind, null, { note: 'why' });
      assert.ok(r.ok, `${id}: ${r.reason}`);
      assert.equal(t.links.link(host.ids[7], host.ids[8], item.kind).ok, false); // once each way
      assert.ok(t.links.link(host.ids[1], host.lib.model.roomItems(host.w, host.other)[0].id, item.kind).ok, `${id}: links cross rooms`);
    }
  }
}
const tablesOf = (host) => json(host.world.carriers.tables());

// Uses everything a plugin added, as a person would: every rule laid out and asked, every
// command run, every Editor section drawn, every link kind tried, every format sent out.
async function drive(host, t, added) {
  const errors = [];
  const tryIt = async (what, fn) => { try { await fn(); } catch (err) { errors.push(`${what}: ${err.message}`); } };
  host.choose(host.room, host.ids[4]);
  for (const { slot, item } of added) {
    if (slot === 'world.ontologies') {
      await tryIt(`rule ${item.id} lays out`, () => { const l = t.rules.layout(item.id, host.room); assert.ok(l.length > 0, `rule ${item.id} placed nothing`); });
      await tryIt(`rule ${item.id} on a frozen world`, () => { const copy = deepFreeze(JSON.parse(JSON.stringify(host.w))); item.layout(copy, host.room); });
      await tryIt(`rule ${item.id} admits`, () => t.rules.admit(item.id, { kind: 'place', mark: host.ids[5], context: host.room, position: { x: 1, y: 2 } }));
    } else if (slot === 'keys') {
      if (item.run && (!item.when || item.when())) await tryIt(`command ${item.id}`, () => item.run({ preventDefault() {} }));
    } else if (slot === 'room.editor') {
      const x = { id: host.ids[4], roomId: host.room, mode: 'joyce', locked: false, refresh() {} };
      if (!item.when || item.when(x)) await tryIt(`editor ${item.id}`, () => item.render(x));
    } else if (slot === 'links.kinds') {
      await tryIt(`link kind ${item.kind}`, () => {
        const r = t.links.link(host.ids[3], host.ids[6], item.kind);
        assert.ok(r.ok || typeof r.reason === 'string', `link kind ${item.kind} neither landed nor said why`);
      });
    } else if (slot === 'world.formats') {
      if (item.exportRoom) await tryIt(`format ${item.id} out`, () => item.exportRoom(host.room));
    } else if (slot === 'rail.more') {
      await tryIt(`more ${item.id}`, () => item.run?.());
    } else if (slot === 'room.strip') { // since 1.1.0: the strip, the room's bar, a page of its own
      await tryIt(`strip ${item.id}`, () => {
        if (item.visible) item.visible(host.room);
        assert.equal(typeof item.text(host.room), 'string', `strip ${item.id} says no words`);
        item.title?.(host.room);
        item.onClick?.(host.room);
      });
    } else if (slot === 'room.bar') {
      await tryIt(`bar ${item.id}`, () => { item.visible?.(host.room); item.on?.(host.room); item.title?.(host.room); item.run(host.room); item.run(host.room); });
    } else if (slot === 'pages.plugin') {
      await tryIt(`page ${item.id}`, () => { const out = item.sections ? item.sections() : item.render(); assert.ok(out, `page ${item.id} draws nothing`); });
    } else if (slot === 'room.surfaces') {
      // A surface (since 1.1.0): drawn for a mark of the kind that asks for it (or for a box, with
      // no mark), then one gesture as a person would make it (down, moves, up: one step), a key,
      // the wheel, focus and blur, and left.
      await tryIt(`surface ${item.id}`, () => {
        const kind = added.find((a) => a.slot === 'world.items' && a.item.surface === item.id)?.item.kind;
        const mark = kind ? t.marks.ofKind(kind).find((m) => t.places.home(m.id) === host.room)?.id ?? null : null;
        const box = kind ? null : t.rules.draws(added.find((a) => a.slot === 'world.ontologies')?.item.id, host.room).boxes.find((b) => b.surface === item.id) || null;
        const size = box ? { width: box.w, height: box.h } : { width: item.width || 240, height: item.height || 160 };
        const el = typeof document === 'undefined' ? null : document.createElement('div');
        const ctx = (focused) => Object.freeze({ surface: item.id, mark, context: host.room, box, ...size, focused, el });
        item.draw(el, ctx(false));
        item.focus?.(ctx(true));
        const steps = host.log.undo?.length;
        const done = item.hold();
        const at = (type, x, y) => Object.freeze({ type, x, y, pressure: 0.5, buttons: type === 'up' ? 0 : 1, pointer: 'pen', shift: false, alt: false, ctrl: false });
        item.pointer?.(at('down', 10, 10), ctx(true));
        for (let i = 1; i <= 5; i++) item.pointer?.(at('move', 10 + i * 8, 10 + i * 4), ctx(true));
        item.pointer?.(at('up', 50, 30), ctx(true));
        done();
        if (steps !== undefined) assert.ok(host.log.undo.length - steps <= 1, `surface ${item.id}: one gesture made more than one step`);
        item.key?.(Object.freeze({ key: 'a', code: 'KeyA', shift: false, alt: false, ctrl: false }), ctx(true));
        item.wheel?.(Object.freeze({ x: 5, y: 5, dx: 0, dy: 40, ctrl: false, shift: false }), ctx(true));
        item.blur?.(ctx(false));
        if (mark && t.marks.get(mark)) item.draw(el, ctx(false));
        item.leave?.(el, ctx(false));
      });
    }
  }
  return errors;
}

for (const [id, mod] of Object.entries(CORPUS)) {
  test(`corpus ${id}: the laws hold with it on, it is used without an error, and off and on again loses no row`, async () => {
    const host = makeHost();
    assert.equal(typeof mod.install, 'function', `${id} exports install(t)`);
    for (const other of WITH[id] || []) host.plug(other, CORPUS[other].install);
    const { t, off } = host.plug(id, mod.install, block(id));
    samples(host, t, id);
    const added = host.added(id);
    assert.ok(added.length > 0, `${id} added nothing`);
    const errors = await drive(host, t, added);
    assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
    assert.deepEqual(brokenLaws(host.w), [], `${id} broke a law`);
    const before = tablesOf(host);
    off();
    assert.equal(host.added(id).length, 0, `${id} left something behind when switched off`);
    assert.equal(tablesOf(host), before, `${id} switched off lost or changed a row`);
    const again = host.plug(id, mod.install, block(id));
    assert.equal(host.added(id).length, added.length, `${id} on again adds the same`);
    assert.deepEqual(await drive(host, again.t, host.added(id)), []);
    again.off();
  });

  test(`corpus ${id}: a .traum round-trip of a room is stable with it on`, () => {
    const host = makeHost();
    for (const other of WITH[id] || []) host.plug(other, CORPUS[other].install);
    const { t } = host.plug(id, mod.install, block(id));
    samples(host, t, id);
    const text = t.carriers.text(host.room, { ids: 'real' });
    const check = t.carriers.check(host.room, t.carriers.read(text));
    assert.ok(check.ok, check.reason);
    assert.deepEqual([check.changed, check.made, check.deleted], [0, 0, 0], `${id}: writing the room back over itself would change it`);
  });
}

// The speed budget, for every corpus rule: a 1,500-thought room, cold, under 50 ms.
test('corpus rules: each lays out a 1,500-thought room within the budget', () => {
  const host = makeHost();
  const big = bigRoom(host);
  const slow = [];
  for (const [id, mod] of Object.entries(CORPUS)) {
    const { t, off } = host.plug(id, mod.install, block(id));
    for (const { slot, item } of host.added(id)) {
      if (slot !== 'world.ontologies') continue;
      const start = performance.now();
      const n = t.rules.layout(item.id, big).length;
      const ms = performance.now() - start;
      if (ms > 50 || n < 1500) slow.push(`${item.id}: ${n} marks in ${ms.toFixed(1)} ms`);
    }
    off();
  }
  assert.deepEqual(slow, []);
});

// What each does, beyond the suite: a few lines each, through the API only.
test('corpus rules place what they say: grid cells, kanban columns, an indented outline, days ahead', () => {
  const host = makeHost();
  const at = (t, rule) => new Map(t.rules.layout(rule, host.room).map((r) => [r.mark, r.position]));
  const g = host.plug('grid', grid.install).t;
  const cells = at(g, 'grid');
  assert.deepEqual([cells.get(host.ids[0]), cells.get(host.ids[3]), cells.get(host.ids[6])], [{ x: 0, y: 0 }, { x: 720, y: 0 }, { x: 0, y: 160 }]); // oldest first, six to a row
  const k = host.plug('kanban', kanban.install).t;
  const board = at(k, 'kanban');
  assert.ok(board.get(host.ids[0]).x > 0 && board.get(host.ids[0]).x === board.get(host.ids[2]).x); // a train's parts in its column
  assert.ok(board.get(host.ids[0]).y < board.get(host.ids[1]).y);
  assert.equal(board.get(host.ids[5]).x, 0); // in no group: the first column
  const o = host.plug('outline', outline.install).t;
  const tree = at(o, 'outline');
  assert.deepEqual([tree.get(host.ids[0]).x, tree.get(host.ids[5]).x], [outline.INDENT, 0]); // under its train; in none
  const c = host.plug('calendar', calendar.install).t;
  assert.ok(c.moments.due(host.ids[6], Date.UTC(2030, 0, 2, 12), 'pay').ok);
  assert.ok(c.moments.due(host.ids[7], Date.UTC(2030, 0, 3, 12)).ok);
  const days = at(c, 'calendar');
  assert.ok(days.get(host.ids[7]).x > days.get(host.ids[6]).x && days.get(host.ids[5]).x < 0); // next day to the right; nothing ahead waits on the left
});

test('corpus link kinds refuse in words what they cannot be, and the Links hands list both ways', () => {
  const host = makeHost();
  const t = host.plug('example-of', exampleOf.install).t;
  host.plug('translates', translates.install);
  host.plug('contradicts', contradicts.install);
  const [a, b] = [host.ids[4], host.ids[5]];
  assert.ok(t.links.link(a, b, 'example of').ok);
  assert.equal(t.links.link(b, a, 'example of').reason, 'That one is already an example of this one');
  assert.ok(t.links.link(a, b, 'contradicts').ok);
  assert.equal(t.links.link(b, a, 'contradicts').ok, false); // read both ways: one row for the pair
  const twin = t.marks.make({ content: t.marks.text(a), in: host.room }).id;
  assert.equal(t.links.link(a, twin, 'translates').reason, 'The same words are not a translation');
  const l = host.plug('links', links.install).t;
  assert.deepEqual(links.linesOf(l, b).map((x) => [x.kind, x.out]).sort(), [['contradicts', false], ['example of', false]]);
  assert.equal(l.links.named('example of').name, 'Example of');
  const steps = host.world.saved;
  assert.ok(l.links.unlink(links.linesOf(l, b)[0].id).ok && host.world.saved === steps + 1);
});

test('corpus checkbox: the tick is the gap, so a group of checkboxes shows its progress', () => {
  const host = makeHost();
  const t = host.plug('checkbox', checkbox.install).t;
  const group = host.train;
  const box = t.marks.make({ kind: 'checkbox', content: { text: 'bread' }, in: group }).id;
  const steps = host.world.saved;
  assert.ok(checkbox.tick(t, box).ok && checkbox.ticked(t.gaps.of(box)));
  assert.equal(host.world.saved, steps + 1); // opened and resolved: one step (together)
  assert.equal(t.gaps.progress(group).resolved, 1);
  assert.ok(checkbox.tick(t, box).ok && !checkbox.ticked(t.gaps.of(box)));
});

test('corpus nonsense reader: every nonsense proposal is refused in words, and nothing changes', () => {
  const host = makeHost();
  const t = host.plug('nonsense-reader', nonsenseReader.install).t;
  const before = json(host.world.carriers.tables()), steps = host.world.saved;
  const r = nonsenseReader.run(t);
  assert.deepEqual(r.answers.filter((a) => a.ok !== false || !a.reason).map((a) => `${a.label}: ${a.reason}`), []);
  assert.equal(r.refused, r.of);
  assert.equal(json(host.world.carriers.tables()), before);
  assert.equal(host.world.saved, steps); // a refusal is never a step
});

test('corpus carriers: Markdown, CSV, JSON and plain text come in as rooms in one step and go out again', async () => {
  const host = makeHost();
  const md = host.plug('markdown-vault', markdownVault.install).t;
  const steps = host.world.saved;
  const first = markdownVault.land(md, [markdownVault.parse('Seeds.md', '# Spring\n- sow [[Beans]]\n- water\n\nloose words\nrun on'), markdownVault.parse('Beans.md', 'broad beans')]);
  assert.equal(host.world.saved, steps + 1);
  assert.equal(markdownVault.note(md, first), '## Spring\n\n- sow [[Beans]]\n- water\n- loose words run on\n'); // a heading's group holds what follows it
  assert.equal(md.links.from(md.links.members(md.marks.in(first)[0].id)[0], 'mentions').length, 1); // the wikilink, to the Beans room
  const files = [{ name: 'a.md', text: 'ä words' }, { name: 'b/c.md', text: '' }];
  assert.deepEqual(await unzip(zip(files)), files);
  const csv = host.plug('csv-marks', csvMarks.install).t;
  const room = csvMarks.land(csv, 'Sheet', 'id,text\n1,"one, with comma"\n2,two\n');
  assert.deepEqual(csv.marks.in(room).map((m) => m.text), ['one, with comma', 'two']);
  assert.match(csvMarks.csv(csv, room), /^id,kind,text,made,edited,gap,due\n.*,line,"one, with comma",/);
  const js = host.plug('json-tables', jsonTables.install).t;
  const back = jsonTables.land(js, jsonTables.out(js, room));
  assert.ok(back.ok, back.reason);
  assert.deepEqual(js.marks.in(back.id).map((m) => m.text), ['one, with comma', 'two']);
  assert.equal(jsonTables.land(js, '{"format":"other"}').ok, false);
  const txt = host.plug('plain-text', plainText.install).t;
  const r2 = plainText.land(txt, 'Notes', 'first\nline\n\nsecond\n');
  assert.equal(plainText.text(txt, r2), 'NOTES\n\nfirst line\n\nsecond\n');
});

test('corpus: Anki cards, echoes, dates named in words, statistics and the oldest gap read the tables', () => {
  const host = makeHost();
  const t = host.plug('word-linker', wordLinker.install).t;
  const a = t.marks.make({ content: 'Granite weathers into clay', in: host.room }).id;
  const b = t.marks.make({ content: 'clay from granite, slowly', in: host.room }).id;
  assert.deepEqual(wordLinker.pairs(t, host.room).map((x) => [x.from, x.to, x.words.sort()]), [[a, b, ['clay', 'granite']]]);
  const anki = host.plug('anki-deck', ankiDeck.install).t;
  assert.ok(t.links.link(a, b, 'echoes').ok);
  assert.deepEqual(ankiDeck.cards(anki, host.room), [['Granite weathers into clay', 'Echoes: clay from granite, slowly']]); // a train with no title gives no backs
  const now = new Date(2026, 10, 8, 9).getTime();
  assert.equal(new Date(dueFinder.dateIn('pay by 12 Nov', now)).getDate(), 12);
  assert.equal(new Date(dueFinder.dateIn('2027-01-05 dentist', now)).getFullYear(), 2027);
  assert.equal(new Date(dueFinder.dateIn('call tomorrow', now)).getDate(), 9);
  assert.equal(dueFinder.dateIn('no date here', now), null);
  const s = host.plug('room-stats', roomStats.install).t;
  assert.ok(s.gaps.open(host.ids[5], 'from world').ok);
  const st = roomStats.stats(s, host.room);
  assert.deepEqual([st.thoughts, st.groups, st.open, st.links.echoes], [14, 1, 1, 1]);
  const o = host.plug('oldest-gap', oldestGap.install).t;
  assert.equal(oldestGap.oldest(o).mark, host.ids[5]);
  assert.equal(oldestGap.oldest(o).room, host.room);
});

test('a rule\'s three hooks: Calendar draws its days, a drop or a new thought on a day makes it due then', () => {
  const host = makeHost();
  const t = host.plug('calendar', calendar.install).t;
  const rule = host.added('calendar').find((a) => a.slot === 'world.ontologies').item;
  const boxes = t.rules.draws('calendar', host.room).boxes;
  assert.ok(boxes.length >= 35 && boxes.every((b) => b.w === calendar.W && b.h === calendar.H)); // five weeks of days at least
  assert.ok(boxes.some((b) => b.note === 'today') && /^Mon \d/.test(boxes[0].label));
  const day = boxes[9]; // the second week's Wednesday
  const mark = host.ids[3];
  rule.drop(host.w, host.room, mark, day.x + 20, day.y + 20);
  const due = t.moments.next(mark);
  assert.equal(due.kind, 'due');
  assert.equal(new Date(due.at).getHours(), 12);
  const spot = t.rules.layout('calendar', host.room).find((r) => r.mark === mark).position;
  assert.ok(spot.x > day.x && spot.x < day.x + day.w && spot.y > day.y && spot.y < day.y + day.h); // and it sits in that day
  rule.drop(host.w, host.room, mark, -100, 40); // left of the days: nothing ahead
  assert.equal(t.moments.next(mark), null);
  rule.land(host.w, host.room, host.ids[4], boxes[2].x + 5, boxes[2].y + 5);
  assert.equal(t.rules.layout('calendar', host.room).find((r) => r.mark === host.ids[4]).position.x, boxes[2].x + calendar.W / 2);
  // A hook that throws or proposes nonsense changes nothing; a frozen world is never written.
  const off = host.plug('odd', (k) => k.slots.rules.add({ id: 'odd', name: 'Odd', arrange: () => [], draw: () => { throw new Error('no'); }, drop: () => ({ fly: true }), land: () => [{ due: 'soon' }] }));
  const odd = host.added('odd').find((a) => a.slot === 'world.ontologies').item;
  const before = JSON.stringify(host.w.ahead || {});
  assert.deepEqual(odd.boxes(host.w, host.room), []);
  odd.drop(host.w, host.room, mark, 0, 0);
  assert.deepEqual(odd.land(host.w, host.room, mark, 0, 0), ['A time to come back at is needed']);
  assert.equal(JSON.stringify(host.w.ahead || {}), before);
  off.off();
});

test('a rule\'s wider boxes (1.0.3): style, level, right words, opens; a place proposal; the mode in reads; the floor in the memo', () => {
  const host = makeHost();
  let drawn = 0;
  const { t } = host.plug('contents', (k) => k.slots.rules.add({
    id: 'contents', name: 'Contents',
    arrange: () => [],
    // One line per room on this room's floor, its thoughts counted on the right; a click opens it.
    draw: (reads, context) => {
      drawn++;
      const floor = reads.places.home(context);
      return [{ x: 0, y: 0, w: 400, h: 60, label: 'Contents', style: 'title' },
        ...reads.marks.in(floor).filter((m) => m.kind === 'room' && m.id !== context)
          .map((r, i) => ({ x: 0, y: 80 + i * 40, w: 400, h: 36, label: r.name, right: String(reads.marks.in(r.id).length), style: 'line', level: 2, opens: r.id, note: r.mode }))];
    },
    drop: (reads, context, mark, x, y) => (y >= 80 ? { place: reads.marks.in(reads.places.home(context)).filter((m) => m.kind === 'room' && m.id !== context)[Math.floor((y - 80) / 40)]?.id } : null),
  }));
  const rule = host.added('contents').find((a) => a.slot === 'world.ontologies').item;
  const boxes = t.rules.draws('contents', host.room).boxes;
  assert.equal(boxes[0].style, 'title');
  const line = boxes.find((b) => b.opens === host.other);
  assert.ok(line, 'a line opens the other room');
  assert.deepEqual([line.style, line.level, line.right, line.note], ['line', 2, '1', 'joyce']);
  assert.equal(t.marks.get(host.other).mode, 'joyce', 'a room\'s row says its mode');
  // A thought dropped on the line goes into that room.
  const mark = host.ids[6];
  rule.drop(host.w, host.room, mark, 10, line.y + 5);
  assert.equal(t.places.home(mark), host.other);
  // The memo: a new room on the floor draws the contents again, with no change in this room.
  rule.boxes(host.w, host.room);
  const before = drawn;
  rule.boxes(host.w, host.room);
  assert.equal(drawn, before, 'remembered while nothing changed');
  host.lib.model.addRoom(host.w, 'Third', host.tick());
  const again = rule.boxes(host.w, host.room);
  assert.ok(drawn > before && again.some((b) => b.label === 'Third'));
  // Nonsense in a box is left out or tidied, never drawn as given.
  const { t: t2 } = host.plug('odd-boxes', (k) => k.slots.rules.add({ id: 'odd-boxes', name: 'Odd boxes', arrange: () => [], draw: () => [{ x: 0, y: 0, w: 10, h: 10, style: 'neon', level: 9, opens: 'nowhere' }] }));
  const odd = t2.rules.draws('odd-boxes', host.room).boxes[0];
  assert.deepEqual([odd.style, odd.level, odd.opens], ['plain', 0, null]);
});

test('a join proposal (1.1.1): land and drop file a mark into a group of the room, at a place in its order, as one step', () => {
  const host = makeHost({ thoughts: 8 });
  let asked = null;
  const { t } = host.plug('chapters', (k) => {
    k.slots.groups.add({ id: 'chapter', name: 'Chapter', membership: 'one' });
    k.slots.rules.add({ id: 'chapters', name: 'Chapters', claims: ['chapter'], arrange: () => [], land: (reads, context, mark, x, y) => asked, drop: (reads, context, mark, x, y) => asked });
  });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items); // (World.js does this when the slot changes)
  const rule = host.added('chapters').find((a) => a.slot === 'world.ontologies').item;
  const one = t.marks.make({ kind: 'group', content: { title: 'One', of: 'chapter' }, in: host.room }).id;
  const two = t.marks.make({ kind: 'group', content: { title: 'Two', of: 'chapter' }, in: host.room }).id;
  const [a, b, c, d] = host.ids.slice(3);
  for (const id of [a, b]) t.links.link(id, one, 'part of');
  // A new thought kept after a: into One, between a and b.
  asked = { join: one, at: 1 };
  assert.deepEqual(rule.land(host.w, host.room, c, 0, 0), []);
  assert.deepEqual(t.links.members(one), [a, c, b]);
  // Dropped on Two: out of One (a chapter holds a part alone), into Two.
  asked = { join: two };
  rule.drop(host.w, host.room, c, 0, 0);
  assert.deepEqual([t.links.members(one), t.links.members(two)], [[a, b], [c]]);
  // Already a part: it moves to `at` among the others.
  asked = { join: one, at: 0 };
  rule.drop(host.w, host.room, b, 0, 0);
  assert.deepEqual(t.links.members(one), [b, a]);
  // Refused, in words, and nothing changed: not a group, another room's group, a bad place.
  const elsewhere = t.marks.make({ kind: 'group', content: { title: 'Far', of: 'chapter' }, in: host.other }).id;
  for (const [p, why] of [[{ join: d }, 'Only a group can hold a part'], [{ join: elsewhere }, 'A mark joins a group of its own room'], [{ join: one, at: -1 }, 'A part joins at a position in the order: 0 first']]) {
    asked = p;
    assert.deepEqual(rule.land(host.w, host.room, d, 0, 0), [why]);
  }
  assert.deepEqual([t.links.members(one), t.links.members(two)], [[b, a], [c]]);
  assert.deepEqual(brokenLaws(host.w), []);
});

test('ui.text.edit (1.1.1): a kept line in the open room opens to write in, the caret where asked; anything else refuses in words', () => {
  const host = makeHost({ thoughts: 4 });
  const { t } = host.plug('runs-on', () => {});
  const line = host.ids[3];
  assert.deepEqual({ ...t.ui.text.edit(line) }, { ok: false, reason: 'The mark is not in the open room' }); // no room open
  host.choose(host.room);
  const opened = [];
  host.writeIn({ edit: (id, at) => { opened.push([id, at]); return true; } });
  assert.deepEqual({ ...t.ui.text.edit(line, 3) }, { ok: true, id: line });
  assert.deepEqual({ ...t.ui.text.edit(line) }, { ok: true, id: line });
  assert.deepEqual(opened, [[line, 3], [line, null]]);
  assert.equal(t.ui.text.edit('nothing').reason, 'No such mark');
  const train = host.train;
  assert.match(t.ui.text.edit(train).reason, /^Only words are written in/);
  const far = t.marks.in(host.other).find((m) => m.kind === 'line').id;
  assert.equal(t.ui.text.edit(far).reason, 'The mark is not in the open room');
  t.distance.declare(host.room, 'others');
  assert.equal(t.ui.text.edit(line).reason, 'The room is locked');
  t.distance.declare(host.room, 'me now');
  host.writeIn({ edit: () => false });
  assert.equal(t.ui.text.edit(line).ok, false);
});

test('page flow: a long paragraph at a page foot runs on to the next page in fragments, every row the column wide', () => {
  const host = makeHost({ thoughts: 3 });
  const { t } = host.plug('page-flow', pageFlow.install);
  const long = 'river stone light '.repeat(120);
  for (let i = 0; i < 6; i++) assert.ok(t.marks.make({ content: `${long} ${i}`, in: host.room }).ok);
  const rows = t.rules.layout('page-flow', host.room);
  assert.ok(rows.every((r) => r.width === pageFlow.PAGE.w - 2 * pageFlow.PAGE.margin));
  const split = rows.filter((r) => r.fragments?.length > 1);
  assert.ok(split.length > 0, 'some paragraph runs on');
  for (const r of split) {
    const lines = t.ui.measure(t.marks.text(r.mark), r.width).lines;
    assert.deepEqual(r.fragments.map((f) => f.lines), r.fragments.map((f) => f.lines).sort((a, b) => a[0] - b[0]));
    assert.equal(r.fragments.at(-1).lines[1], lines, 'the last fragment ends at the last line');
    assert.ok(r.fragments[1].x > r.fragments[0].x, 'the next fragment is on the next page');
  }
  const boxes = t.rules.draws('page-flow', host.room).boxes;
  assert.ok(boxes.filter((b) => b.style === 'page').length >= 2, 'two pages or more');
});

test('links.link part of takes a position: at 0 a part goes first', () => {
  const host = makeHost({ thoughts: 6 });
  const { t } = host.plug('page-flow', pageFlow.install);
  const made = t.marks.make({ kind: 'group', content: { title: 'Chapter' }, in: host.room });
  assert.ok(made.ok, made.reason);
  const g = made.id;
  const one = t.links.link(host.ids[4], g, 'part of');
  assert.ok(one.ok, one.reason);
  const two = t.links.link(host.ids[5], g, 'part of', null, { at: 0 });
  assert.ok(two.ok, two.reason);
  assert.equal(t.links.members(g).length, 2); // (the order itself: families.test.js, join at a position)
  assert.equal(t.links.link(host.ids[3], g, 'part of', null, { at: -1 }).ok, false);
});

test('first letters: each word\'s first letter, read-only', () => {
  assert.deepEqual(firstLetters.firsts('the river, 2 stones').map((r) => r.from), [0, 4, 11, 13]);
});

test('spell marks: the chosen thought\'s slips put right as one step, which one Ctrl+Z takes back', () => {
  const host = makeHost({ thoughts: 3 });
  const { t } = host.plug('spell-marks', spellMarks.install);
  const id = t.marks.make({ content: 'Teh river is wich way', in: host.room }).id;
  host.choose(host.room, id);
  const seq = t.moments.seq();
  host.added('spell-marks').find((a) => a.item.id === 'spell-marks.fix-chosen').item.run();
  assert.equal(t.marks.get(id).text, 'The river is which way');
  assert.equal(t.moments.seq(), seq + 1, 'one step');
});

test('bold and italic: spans are kept on the mark, follow its words, travel in a .traum file and come out as Markdown', () => {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('bold-italic', boldItalic.install);
  const id = t.marks.make({ content: 'a bold word here', in: host.room }).id;
  assert.ok(t.marks.edit(id, { spans: [{ from: 2, to: 6, kind: 'bold' }, { from: 7, to: 11, kind: 'italic' }] }).ok);
  assert.equal(t.marks.markdown(id), 'a **bold** *word* here');
  assert.ok(t.marks.edit(id, { text: 'so a bold word here' }).ok);
  assert.deepEqual(t.marks.get(id).spans.map((s) => [s.from, s.to]), [[5, 9], [10, 14]]);
  const text = t.carriers.text(host.room, { ids: 'real' });
  assert.ok(text.includes('material.spans'), 'the spans are in the file');
  const check = t.carriers.check(host.room, t.carriers.read(text));
  assert.deepEqual([check.changed, check.made, check.deleted], [0, 0, 0]);
});

test('a Word document: a room in reading order, a heading per group, spans as runs, a table, a figure', async () => {
  const host = makeHost({ thoughts: 2 });
  host.plug('table', table.install);
  host.plug('figure', figure.install);
  const { t } = host.plug('docx', docx.install);
  const g = t.marks.make({ kind: 'group', content: { title: 'Chapter one' }, in: host.room }).id;
  const p = t.marks.make({ content: 'a bold word', in: host.room }).id;
  t.marks.edit(p, { spans: [{ from: 2, to: 6, kind: 'bold' }] });
  t.links.link(p, g, 'part of');
  t.marks.make({ kind: 'table', content: { text: 'name | age\nAda | 36' }, in: host.room });
  const bytes = docx.docx(t, host.room);
  const text = new TextDecoder().decode(bytes);
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // a zip
  for (const s of ['word/document.xml', 'Chapter one', '<w:b/></w:rPr><w:t xml:space="preserve">bold</w:t>', '<w:tbl>', 'Ada']) assert.ok(text.includes(s), s);
});

test('page flow: a kind that flows (a table) sits between paragraphs as one block of its own height', () => {
  const host = makeHost({ thoughts: 2 });
  host.plug('table', table.install);
  const { t } = host.plug('page-flow', pageFlow.install);
  const id = t.marks.make({ kind: 'table', content: { text: 'a | b\n1 | 2\n3 | 4' }, in: host.room }).id;
  const size = t.ui.size(id, 380);
  assert.ok(size.inline && size.height > 100, JSON.stringify(size));
  const row = t.rules.layout('page-flow', host.room).find((r) => r.mark === id);
  assert.equal(row.height, size.height);
  assert.ok(!row.fragments);
});

// Step 3 (1.1.0): the strip, the room's bar and a page of its own, through the API only.
test('word count strip: the room\'s words in the strip, the chosen thought\'s first, a bar word that hides it, a page and a menu row', () => {
  const host = makeHost();
  const { t, off } = host.plug('word-count-strip', wordCountStrip.install);
  const strip = host.app.slot('room.strip').items[0];
  const bar = host.app.slot('room.bar').items[0];
  const { words, thoughts } = wordCountStrip.countRoom(t, host.room);
  assert.ok(words > 0 && thoughts > 0);
  host.choose(host.room, null);
  assert.equal(strip.text(host.room), `${words} words in ${thoughts} thoughts`);
  host.choose(host.room, host.ids[4]);
  assert.match(strip.text(host.room), /^4 words chosen · /);
  assert.ok(strip.visible() && bar.on());
  bar.run();
  assert.ok(!strip.visible() && !bar.on()); // hidden: the strip has nothing of it
  bar.run();
  assert.ok(strip.visible());
  // Far off, the strip names the room, a label for the map.
  assert.match(wordCountStrip.stripText(t, host.room, { words: 1204, thoughts: 3 }, 'far'), /^Study · 1,204 words$/);
  // A new thought is counted: the count follows the tables (moments.seq), not a stale memo.
  assert.ok(t.marks.make({ content: 'two more', in: host.room }).ok);
  host.choose(host.room, null);
  assert.equal(strip.text(host.room), `${words + 2} words in ${thoughts + 1} thoughts`);
  // Its page, with its row in the ☰ menu: both go when it is switched off.
  assert.deepEqual(host.app.slot('pages.plugin').items.map((p) => p.id), ['word-counts']);
  assert.deepEqual(host.app.slot('header.buttons').items.map((p) => p.id), ['page:word-counts']);
  off();
  assert.equal(host.app.slot('pages.plugin').items.length + host.app.slot('header.buttons').items.length + host.app.slot('room.strip').items.length, 0);
});

// Step 6 (1.1.0): the plugin written from API.md alone, by an author who had read nothing else.
test('highlighter: a span written ==…==, the strip counts the thoughts that carry it, and it all goes when switched off', () => {
  const host = makeHost({ thoughts: 2 });
  const { t, off } = host.plug('highlighter', highlighter.install);
  const strip = host.app.slot('room.strip').items[0];
  assert.equal(strip.text(host.room), '');
  const id = t.marks.make({ content: 'a bright word', in: host.room }).id;
  assert.ok(t.marks.edit(id, { spans: [{ from: 2, to: 8, kind: 'mark-up' }] }).ok);
  assert.equal(t.marks.markdown(id), 'a ==bright== word');
  assert.equal(strip.text(host.room), '1 highlighted thought');
  assert.equal(host.app.slot('room.bar').items[0].label, 'Markdown');
  off();
  assert.equal(host.app.slot('room.strip').items.length + host.app.slot('room.bar').items.length, 0);
});

test('sketch: a stroke drawn in its surface is one edit and one step, Backspace takes it back, and a .traum file carries it', () => {
  const host = makeHost({ thoughts: 3 });
  const { t } = host.plug('sketch', sketch.install, { needs: ['surface'] });
  const made = t.marks.make({ kind: 'sketch', content: { strokes: [[10, 10, 40, 30]], text: 'a hill' }, in: host.room });
  assert.ok(made.ok, made.reason);
  const mark = made.id;
  const item = host.added('sketch').find((a) => a.slot === 'room.surfaces').item;
  const el = document.createElement('div');
  const ctx = Object.freeze({ surface: 'sketch', mark, context: host.room, box: null, width: 240, height: 160, focused: true, el });
  item.draw(el, ctx);
  assert.equal(el.querySelectorAll('path').length, 1);
  const at = (type, x, y) => Object.freeze({ type, x, y, pressure: 0.5, buttons: type === 'up' ? 0 : 1, pointer: 'pen', shift: false, alt: false, ctrl: false });
  const steps = host.log.undo.length;
  const done = item.hold();
  item.pointer(at('down', 100, 100), ctx);
  item.pointer(at('move', 110, 105), ctx);
  item.pointer(at('move', 110.2, 105.1), ctx); // too near the last: skipped
  item.pointer(at('move', 300, -20), ctx);     // off the pad: kept at its edge
  assert.equal(el.querySelectorAll('path').length, 2, 'the stroke under way is drawn live');
  item.pointer(at('up', 300, -20), ctx);
  done();
  assert.equal(host.log.undo.length, steps + 1, 'one gesture, one step');
  assert.deepEqual(t.marks.get(mark).strokes.at(-1), [100, 100, 110, 105, 240, 0]);
  assert.equal(t.marks.get(mark).strokes.length, 2);
  const text = t.carriers.text(host.room, { ids: 'real' });
  assert.ok(text.includes('strokes'), 'the strokes travel in the file');
  const check = t.carriers.check(host.room, t.carriers.read(text));
  assert.deepEqual([check.changed, check.made, check.deleted], [0, 0, 0]);
  assert.equal(item.key(Object.freeze({ key: 'Backspace', code: 'Backspace', shift: false, alt: false, ctrl: false }), ctx), true);
  assert.equal(t.marks.get(mark).strokes.length, 1);
  assert.equal(item.key(Object.freeze({ key: 'a', code: 'KeyA', shift: false, alt: false, ctrl: false }), ctx), false);
  // The kind itself (the host keeps a plugin's marks as they are given, so it is asked here):
  // strokes that are not strokes are left out, an empty sketch is null, and it always has words.
  const k = host.added('sketch').find((a) => a.slot === 'world.items').item;
  const h = { oneLine: (s) => String(s ?? '').replace(/\s+/g, ' ').trim() };
  assert.deepEqual(sketch.tidyStrokes([[1, 2, 3], [NaN, 1], [5, 6], 'x', [500, -1], [1.26, 2]]), [[5, 6], [240, 0], [1.3, 2]]);
  assert.equal(sketch.svgPath([5, 6]), 'M5 6l0 0');
  assert.equal(k.tidy({ strokes: [], text: ' ' }, h), null);
  assert.deepEqual(k.tidy({ text: '' }, h), { strokes: [], text: '' }, 'a new one from Add is a blank pad');
  assert.deepEqual(k.tidy({ strokes: [[1, 1]], text: '' }, h), { strokes: [[1, 1]], text: '' });
  assert.equal(k.text({ strokes: [[1, 1]] }), 'Sketch (1 stroke)');
  assert.equal(k.text({ strokes: [[1, 1]], text: 'a hill' }), 'a hill');
  const make = (tag, attrs, ...kids) => { const n = document.createElement(tag); n.append(...kids.filter((x) => x != null)); return n; };
  const shown = k.node({ id: mark, kind: 'sketch', strokes: [[1, 1, 5, 5], [9, 9]], text: 'a hill' }, make);
  assert.equal(shown.querySelectorAll('svg path').length, 2);
  assert.equal(shown.querySelector('svg').getAttribute('viewBox'), '0 0 240 160');
});

test('chart: a rule whose box asks for a surface, which draws a bar for each group and one for the loose thoughts', () => {
  const host = makeHost({ thoughts: 8 });
  const { t } = host.plug('chart', chart.install, { needs: ['surface'] });
  const g = t.marks.make({ kind: 'group', content: { title: 'Pair' }, in: host.room }).id;
  assert.ok(t.marks.edit(host.ids[4], { text: 'one two three' }).ok);
  assert.ok(t.marks.edit(host.ids[5], { text: 'four five' }).ok);
  assert.ok(t.links.link(host.ids[4], g, 'part of').ok);
  assert.ok(t.links.link(host.ids[5], g, 'part of').ok);
  const boxes = t.rules.draws('chart', host.room).boxes;
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].surface, 'chart');
  const bars = chart.barsOf(t, host.room);
  assert.equal(bars.find((b) => b.id === g).words, 5);
  assert.equal(bars.find((b) => b.id === host.train).words, 3 * 4); // the train's three thoughts, four words each
  const loose = [3, 6, 7].reduce((n, i) => n + chart.words(t.marks.text(host.ids[i])), 0);
  assert.equal(bars.at(-1).label, 'Loose');
  assert.equal(bars.at(-1).words, loose);
  assert.ok(t.rules.layout('chart', host.room).length > 0);
  const surface = host.added('chart').find((a) => a.slot === 'room.surfaces').item;
  const el = document.createElement('div');
  const before = JSON.stringify(host.world.carriers.tables()), steps = host.world.saved;
  surface.draw(el, Object.freeze({ surface: 'chart', mark: null, context: host.room, box: boxes[0], width: boxes[0].w, height: boxes[0].h, focused: false }));
  assert.ok(el.querySelector('svg'));
  assert.equal(el.querySelectorAll('svg rect').length, bars.length);
  assert.equal(JSON.stringify(host.world.carriers.tables()), before, 'the chart writes nothing');
  assert.equal(host.world.saved, steps);
});

test('manuscript (1.1.1): chapters within chapters by links, a thought written into its chapter, a drop that moves, the draft, a break and numbering', () => {
  const host = makeHost({ thoughts: 8 });
  let draft = null;
  host.lib.draft.setSource((context) => (context === host.room ? draft : null));
  try {
    const { t, off } = host.plug('manuscript', manuscript.install);
    host.lib.model.declareFamilies(host.app.slot('world.groups').items); // (World.js does this when the slot changes)
    const rule = host.added('manuscript').find((a) => a.slot === 'world.ontologies').item;
    const [a, b, c, d, e] = host.ids.slice(3);
    // Part One holds a, then Chapter 1.1 (a chapter inside a chapter: one more link) holding b, c.
    const one = t.marks.make({ kind: 'group', content: { title: 'Part One', of: 'manuscript-chapter', break: true }, in: host.room }).id;
    t.links.link(a, one, 'part of');
    host.choose(host.room);
    host.roomWith({ chosenAll: () => [b, c] });
    const inner = manuscript.newChapter(t, { context: host.room, marks: [b, c] }, 'Chapter 1.1');
    assert.deepEqual(t.links.members(one), [a]); // b and c were loose: the new chapter goes at the top level
    t.links.link(inner, one, 'part of');
    assert.deepEqual([t.links.members(one), t.links.members(inner)], [[a, inner], [b, c]]);
    // Not folders: every thought's home is still the room.
    for (const id of [a, b, c]) assert.equal(t.places.home(id), host.room);
    // Laid out in reading order: Part One, a, Chapter 1.1, b, c, then the loose thoughts.
    const ys = new Map(t.rules.layout('manuscript', host.room).map((r) => [r.mark, r.position.y]));
    assert.ok(ys.get(a) < ys.get(b) && ys.get(b) < ys.get(c) && ys.get(c) < ys.get(d) && ys.get(d) < ys.get(e));
    const boxes = t.rules.draws('manuscript', host.room).boxes;
    assert.equal(boxes.filter((x) => x.style === 'line').length, 1); // Part One's break (a group field, G4)
    assert.deepEqual(boxes.filter((x) => x.style === 'heading').map((x) => [x.label, x.level]), [['Part One', 1], ['Chapter 1.1', 2]]);
    // Numbering, a choice setting kept per room (G9).
    host.lib.model.setRoomSetting(host.w, host.room, 'manuscript', 'numbers', 'roman');
    host.lib.model.touch(host.w);
    assert.deepEqual(t.rules.draws('manuscript', host.room).boxes.filter((x) => x.style === 'heading').map((x) => x.label), ['I  Part One', 'i  Chapter 1.1']);
    // A thought written after b lands in Chapter 1.1, just after b (G1 join, at).
    const fresh = t.marks.make({ content: 'written after b', in: host.room }).id;
    assert.deepEqual(rule.land(host.w, host.room, fresh, 0, ys.get(b)), []);
    assert.deepEqual(t.links.members(inner), [b, fresh, c]);
    // c dragged up to just under a: out of Chapter 1.1, into Part One before the inner chapter (G1 from).
    rule.drop(host.w, host.room, c, 0, ys.get(a) + 1);
    assert.deepEqual([t.links.members(one), t.links.members(inner)], [[a, c, inner], [b, fresh]]);
    // The draft after a: what follows moves down by its box (G3).
    const before = new Map(t.rules.layout('manuscript', host.room).map((r) => [r.mark, r.position.y]));
    draft = { text: 'being written', after: a, height: 72 };
    host.lib.model.touch(host.w);
    const after = new Map(t.rules.layout('manuscript', host.room).map((r) => [r.mark, r.position.y]));
    assert.equal(after.get(a), before.get(a));
    assert.ok(after.get(c) - before.get(c) >= 72);
    // Switched off: the same thoughts, still in the room; the chapters' links and the break stay.
    off();
    host.lib.model.declareFamilies([]);
    assert.equal(t.marks.get(one).break, true);
    assert.deepEqual(t.links.members(inner), [b, fresh]);
    assert.deepEqual(brokenLaws(host.w), []);
  } finally { host.lib.draft.setSource(null); }
});
