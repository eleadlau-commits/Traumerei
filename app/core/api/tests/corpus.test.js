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
  'export-room': exportRoom };
// A plugin that is the hands for others' additions is tried with one of them on.
const WITH = { links: ['cites'] };
// A mark of each kind a plugin adds, made through the API (so its kind's fields are tried, and the
// round-trip carries it); the fields a person would write.
const SAMPLES = {
  checkbox: { text: 'buy bread' }, quote: { text: 'To be, or not', source: 'Hamlet' }, code: { code: 'let x = 1;\n  x++', lang: 'js' },
  'audio-note': { src: 'data:audio/ogg;base64,AAAA', text: 'hum' }, 'pdf-page': { src: 'data:application/pdf;base64,JVBE', page: '3', name: 'paper' },
  table: { text: 'a | b\n1 | 2' },
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
    }
  }
  return errors;
}

for (const [id, mod] of Object.entries(CORPUS)) {
  test(`corpus ${id}: the laws hold with it on, it is used without an error, and off and on again loses no row`, async () => {
    const host = makeHost();
    assert.equal(typeof mod.install, 'function', `${id} exports install(t)`);
    for (const other of WITH[id] || []) host.plug(other, CORPUS[other].install);
    const { t, off } = host.plug(id, mod.install);
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
    const again = host.plug(id, mod.install);
    assert.equal(host.added(id).length, added.length, `${id} on again adds the same`);
    assert.deepEqual(await drive(host, again.t, host.added(id)), []);
    again.off();
  });

  test(`corpus ${id}: a .traum round-trip of a room is stable with it on`, () => {
    const host = makeHost();
    for (const other of WITH[id] || []) host.plug(other, CORPUS[other].install);
    const { t } = host.plug(id, mod.install);
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
    const { t, off } = host.plug(id, mod.install);
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
