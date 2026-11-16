// The open core's 1.1.1 additions (G1, G3 to G11; G2 ui.text.edit is tested in corpus.test.js):
// each lands through the tables as one step, or refuses in words, and changes nothing else.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';
import { READS, connect, surface } from '../v2.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('G1: a join proposal with `from` moves a mark from one group to another (membership many), as one step', () => {
  const host = makeHost({ thoughts: 8 });
  let asked = null;
  const { t } = host.plug('moving', (k) => {
    k.slots.groups.add({ id: 'part-chapter', name: 'Chapter' }); // membership many: a join alone would copy
    k.slots.rules.add({ id: 'moving', name: 'Moving', claims: ['part-chapter'], arrange: () => [], land: () => asked, drop: () => asked });
  });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const rule = host.added('moving').find((a) => a.slot === 'world.ontologies').item;
  const one = t.marks.make({ kind: 'group', content: { title: 'One', of: 'part-chapter' }, in: host.room }).id;
  const two = t.marks.make({ kind: 'group', content: { title: 'Two', of: 'part-chapter' }, in: host.room }).id;
  const [a, b, c] = host.ids.slice(3);
  for (const id of [a, b]) t.links.link(id, one, 'part of');
  t.links.link(c, two, 'part of');
  const steps = host.log.undo.length;
  asked = { join: two, at: 0, from: one };
  host.world.save(); // (the room saves the gesture: one step)
  rule.drop(host.w, host.room, b, 0, 0);
  host.world.save();
  assert.deepEqual([t.links.members(one), t.links.members(two)], [[a], [b, c]]);
  assert.equal(host.log.undo.length, steps + 1);
  // Without from, membership many copies: in both.
  asked = { join: two };
  rule.drop(host.w, host.room, a, 0, 0);
  assert.deepEqual([t.links.members(one), t.links.members(two)], [[a], [b, c, a]]);
  // Refused in words: not a part of `from`, `from` elsewhere, a loop (a chapter into its own part).
  const far = t.marks.make({ kind: 'group', content: { title: 'Far', of: 'part-chapter' }, in: host.other }).id;
  asked = { join: one, from: two };
  assert.deepEqual(rule.drop(host.w, host.room, host.ids[7], 0, 0), undefined); // drop says nothing back; the refusal is skipped
  assert.ok(!t.links.members(one).includes(host.ids[7]));
  asked = { join: one, from: far };
  assert.deepEqual(rule.land(host.w, host.room, b, 0, 0), ['A mark leaves a group of its own room']);
  const inner = t.marks.make({ kind: 'group', content: { title: 'Inner', of: 'part-chapter' }, in: host.room }).id;
  t.links.link(inner, one, 'part of'); // chapters nest by part-of links, never as containers
  asked = { join: inner, from: two };
  assert.deepEqual(rule.land(host.w, host.room, one, 0, 0), ['The mark is not a part of the group it would leave']);
  asked = { join: inner };
  assert.deepEqual(rule.land(host.w, host.room, one, 0, 0), ['The part cannot join: it would hold its own group']);
  assert.deepEqual(brokenLaws(host.w), []);
});

test('G3: reads.marks.draft gives arrange the thought being written, frozen, never a mark; a rule that reads it lays out again as it grows', () => {
  const host = makeHost({ thoughts: 3 });
  assert.ok(READS.marks.includes('draft'));
  let draft = null, seen = [];
  host.lib.draft.setSource((context) => (context === host.room ? draft : null));
  try {
    const { t } = host.plug('drafty', (k) => k.slots.rules.add({ id: 'drafty', name: 'Drafty', arrange: (reads, context) => { seen.push(reads.marks.draft(context)); return []; } }));
    const rule = host.added('drafty').find((a) => a.slot === 'world.ontologies').item;
    assert.equal(t.marks.draft(host.room), null);
    rule.layout(host.w, host.room);
    assert.equal(seen.pop(), null);
    assert.ok(rule.readsDraft(host.w, host.room));
    draft = { text: 'half a', after: host.ids[0], height: 24, junk: 1 };
    const d = t.marks.draft(host.room);
    assert.deepEqual({ ...d }, { text: 'half a', after: host.ids[0], height: 24 });
    assert.ok(Object.isFrozen(d));
    assert.equal(t.marks.draft(host.other), null);
    rule.layout(host.w, host.room); // a draft began: laid out again
    assert.equal(seen.pop().text, 'half a');
    draft = { ...draft, text: 'half a line' };
    rule.layout(host.w, host.room); // more words, the same height: remembered
    assert.equal(seen.length, 0);
    draft = { ...draft, height: 48 };
    rule.layout(host.w, host.room); // the box grew: laid out again
    assert.equal(seen.pop().height, 48);
    assert.equal(t.marks.in(host.room).filter((m) => m.text === 'half a line').length, 0); // never a mark
    // A rule that never reads it pays nothing for it.
    host.plug('plain', (k) => k.slots.rules.add({ id: 'plain-rule', name: 'Plain', arrange: () => [] }));
    const plainRule = host.added('plain').find((a) => a.slot === 'world.ontologies').item;
    plainRule.layout(host.w, host.room);
    assert.ok(!plainRule.readsDraft(host.w, host.room));
  } finally { host.lib.draft.setSource(null); }
});

test('G4: a kind of group keeps its declared fields through make, edit, a .traum round trip and tidy; others go; core names are refused', () => {
  const host = makeHost({ thoughts: 3 });
  const warned = [];
  const { t } = host.plug('fields', (k) => k.slots.groups.add({ id: 'fields-chapter', name: 'Chapter', fields: ['target', 'breaks', 'title', 'of'],
    tidy: (g) => ({ ...g, target: Number.isFinite(g.target) ? Math.max(0, Math.round(g.target)) : undefined }) }));
  host.lib.model.declareFamilies(host.app.slot('world.groups').items, (g, why) => warned.push(why));
  assert.ok(warned.some((w) => /title/.test(w)) && warned.some((w) => /\(of\)/.test(w)), 'core names refused');
  const id = t.marks.make({ kind: 'group', content: { title: 'One', of: 'fields-chapter', target: 2500.4, breaks: { before: true }, stray: 'x' }, in: host.room }).id;
  let g = t.marks.get(id);
  assert.deepEqual([g.target, g.breaks, g.stray], [2500, { before: true }, undefined]);
  assert.ok(t.marks.edit(id, { target: 3000, stray: 'y' }).ok);
  g = t.marks.get(id);
  assert.deepEqual([g.target, g.stray, g.breaks.before], [3000, undefined, true]);
  assert.ok(t.marks.edit(id, { target: null }).ok); // a declared field set to null goes
  assert.equal(t.marks.get(id).target, undefined);
  t.marks.edit(id, { target: 10 });
  const text = t.carriers.text(host.room);
  const into = t.marks.make({ kind: 'room', content: 'Copy' }).id;
  assert.ok(t.carriers.land(t.carriers.read(text), { into }).ok);
  const copy = t.marks.in(into).find((m) => m.kind === 'group' && m.title === 'One');
  assert.deepEqual([copy.target, copy.breaks], [10, { before: true }]);
  // Its plugin off: the fields stay exactly as they are (off loses nothing), even through an edit.
  host.lib.model.declareFamilies([]);
  t.marks.edit(id, { title: 'One again' });
  assert.deepEqual([t.marks.get(id).target, t.marks.get(id).breaks], [10, { before: true }]);
  assert.deepEqual(brokenLaws(host.w), []);
});

test('G5: together(async fn) holds the step until the promise settles; one undo takes it all back; a rejection takes it back at once', async () => {
  const host = makeHost({ thoughts: 3 });
  const { t } = host.plug('async', () => {});
  const steps = host.log.undo.length;
  const out = await t.together(async () => {
    t.marks.make({ content: 'before the file', in: host.room });
    await sleep(5); // a file picked
    t.together(() => t.marks.make({ content: 'after the file', in: host.room })); // nested: the same step
    return 'done';
  });
  assert.equal(out, 'done');
  assert.equal(host.log.undo.length, steps + 1);
  assert.ok(host.world.undo(true));
  assert.equal(t.marks.in(host.room).filter((m) => /the file/.test(m.text || '')).length, 0);
  const before = host.log.undo.length;
  const failed = await t.together(async () => { t.marks.make({ content: 'half done', in: host.room }); await sleep(1); throw new Error('The file was not readable'); });
  assert.deepEqual({ ...failed }, { ok: false, reason: 'The file was not readable' });
  assert.equal(t.marks.in(host.room).filter((m) => m.text === 'half done').length, 0);
  assert.equal(host.log.undo.length, before);
  assert.equal(t.together(() => 3), 3); // a plain fn as before
});

test('G6, G7: ui.chosen().marks, chosen.on, ui.choose and ui.repaint go through the open room', () => {
  const host = makeHost({ thoughts: 4 });
  const { t, off } = host.plug('choosy', () => {});
  assert.equal(t.ui.choose([host.ids[0]]).reason, 'No room is open');
  assert.equal(t.ui.repaint(), false);
  let chosen = [], ears = new Set(), painted = [];
  host.choose(host.room);
  host.roomWith({
    chosenAll: () => chosen,
    choose: (ids) => { const mine = ids.filter((id) => host.ids.includes(id)); if (!mine.length) return false; chosen = mine; for (const fn of ears) fn({ context: host.room, mark: mine.length === 1 ? mine[0] : null, marks: mine }); return true; },
    onChosen: (fn) => { ears.add(fn); return () => ears.delete(fn); },
    repaint: (ids) => painted.push(ids),
  });
  const heard = [];
  t.ui.chosen.on((o) => heard.push(o));
  assert.ok(t.ui.choose([host.ids[1], host.ids[2]]).ok);
  assert.deepEqual([...t.ui.chosen().marks], [host.ids[1], host.ids[2]]);
  assert.equal(heard.length, 1);
  assert.deepEqual([heard[0].context, heard[0].mark, [...heard[0].marks]], [host.room, null, [host.ids[1], host.ids[2]]]);
  assert.ok(Object.isFrozen(heard[0].marks));
  assert.equal(t.ui.choose(['elsewhere']).reason, 'Those marks are not in the open room');
  assert.ok(t.ui.repaint() && t.ui.repaint(host.ids[0]));
  assert.deepEqual(painted, [null, [host.ids[0]]]);
  off();
  assert.equal(ears.size, 0); // switched off: no longer heard
});

test('G8: a span keeps its ref, spans of one kind with different refs stay apart, and a kind\'s click is found at a character', () => {
  const host = makeHost({ thoughts: 2 });
  const S = host.lib.spans;
  const clicked = [];
  const { t } = host.plug('notes', (k) => k.slots.spans.add({ kind: 'note-ref', name: 'Footnote', class: 'underline', click: (span, mark) => clicked.push([span.ref, mark.id]) }));
  S.declareSpans(host.app.slot('world.spans').items);
  try {
    const id = host.ids[0];
    const words = t.marks.text(id);
    assert.ok(t.marks.edit(id, { spans: [{ from: 0, to: 3, kind: 'note-ref', ref: host.ids[1] }, { from: 3, to: 5, kind: 'note-ref', ref: 'l-other' }] }).ok);
    const kept = t.marks.get(id).spans;
    assert.deepEqual(kept.map((s) => s.ref), [host.ids[1], 'l-other']); // touching, but two refs: two spans
    assert.equal(t.marks.text(id), words);
    const at = S.clickable(kept, 1);
    assert.equal(at.length, 1);
    at[0].click(at[0].span, { id });
    assert.deepEqual(clicked, [[host.ids[1], id]]);
    assert.equal(S.clickable(kept, 9).length, 0);
    assert.deepEqual(S.clean([{ from: 0, to: 2, kind: 'note-ref', ref: 5 }], 4), [{ from: 0, to: 2, kind: 'note-ref' }]); // a ref is words
  } finally { S.declareSpans([]); }
});

test('G9: a thin rule\'s choice and toggle settings read as the core\'s own and come to its hooks per room', () => {
  const host = makeHost({ thoughts: 2 });
  const got = [];
  host.plug('numbered', (k) => k.slots.rules.add({ id: 'numbered', name: 'Numbered',
    settings: [{ kind: 'choice', id: 'numbers', name: 'Numbering', options: [{ id: 'none', name: 'None' }, { id: 'arabic', name: '1 / 1.1' }], default: 'arabic' },
      { kind: 'toggle', id: 'rules', name: 'Breaks as rules', default: true }, { kind: 'toggle', name: 'no id' }],
    arrange: (reads, context, settings) => { got.push(settings); return []; } }));
  const rule = host.added('numbered').find((a) => a.slot === 'world.ontologies').item;
  assert.deepEqual(rule.settings.map((s) => [s.key, s.type, s.default]), [['numbers', 'choice', 'arabic'], ['rules', 'switch', true]]);
  assert.deepEqual(rule.settings[0].options, [['none', 'None'], ['arabic', '1 / 1.1']]);
  rule.layout(host.w, host.room);
  assert.deepEqual({ ...got.pop() }, { numbers: 'arabic', rules: true });
  host.lib.model.setRoomSetting(host.w, host.room, 'numbered', 'numbers', 'none'); // the room's ⚙, saved in its rules
  host.lib.model.touch(host.w);
  rule.layout(host.w, host.room);
  assert.deepEqual({ ...got.pop() }, { numbers: 'none', rules: true });
});

test('G10, G11: moment rows carry before and after; commands list and run; peers.on hears offers', () => {
  const host = makeHost({ thoughts: 2 });
  const ran = [];
  const keys = { live: () => [{ id: 'notes.jump', keys: ['Ctrl+J'], words: 'Jump to the note', zone: 'room', run: () => ran.push(1) }], run: (id) => { ran.push(id); return true; }, label: () => 'Ctrl+J' };
  const { t } = host.plug('watcher', () => {});
  const id = host.ids[0];
  t.marks.edit(id, { text: 'changed words' });
  const edited = t.moments.of(id).filter((m) => m.kind === 'edited').pop();
  assert.equal(edited.after.text, 'changed words');
  assert.ok(edited.before.text && Object.isFrozen(edited.after));
  // commands: through a keys service (the host has none; connect one by hand)
  const k = connect({ app: host.app, world: host.world, plugin: { id: 'cmd', manifest: { plugin: { api: 3 } } }, parts: surface(host.lib), lib: host.lib, keys, room: () => ({ id: () => host.room }) });
  assert.deepEqual(k.slots.commands.list().map((c) => [c.id, c.name, [...c.keys]]), [['notes.jump', 'Jump to the note', ['Ctrl+J']]]);
  assert.ok(k.slots.commands.run('notes.jump').ok);
  assert.equal(k.slots.commands.run('nothing').reason, 'No such command here now');
  k.distance.declare(host.room, 'others');
  assert.equal(k.slots.commands.run('notes.jump').reason, 'The room is locked');
  assert.deepEqual(ran, ['notes.jump']);
  // peers.on
  const peers = new Map(), heard = [];
  const a = connect({ app: host.app, world: host.world, plugin: { id: 'a', manifest: { plugin: { api: 3 } } }, parts: surface(host.lib), lib: host.lib, peers });
  const b = connect({ app: host.app, world: host.world, plugin: { id: 'b', manifest: { plugin: { api: 3 } } }, parts: surface(host.lib), lib: host.lib, peers });
  b.peers.on((o) => heard.push([o.name, o.offered, o.owner]));
  const back = a.peers.offer('source', {});
  back();
  assert.deepEqual(heard, [['source', true, 'a'], ['source', false, 'a']]);
});
