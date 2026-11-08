// Tests for the world: everything is a thought.

import { test, assert } from 'folio/testing';
import {
  MESSY, emptyWorld, loadWorld, rooms, children, create, update, remove, move, name, closeGroup, openGroup,
  canHold, addRoom, startTrain, addThought, trainThoughts, roomThoughts, roomTrains, roomUnits,
  roomOf, thoughtText, randomSpot, view, roomAt,
  search,
  shut, lock, archive, archived, restore, peek, roomHits, topRoom, DESC,
  roomsOn, pageCount, addPage, isBig, own, members, itemsIn, within, holds, groupsOf, groupOf, join, declareGroups, isGroup, reading, leave,
  roomSetting, setRoomSetting, resetRoomSettings, seedRoomSettings, applySettingsToAll,
  roomTags, addTag, removeTag, allTags, hasTag, tagGroup, setTagGroup, groupNames, tagsByGroup, ONTOLOGY, makeTag, makeGroup, cells, copyRoom,
} from '../model.js';
import pessoa, { spiralPoint } from '../ontologies/pessoa.js';
import { trainSpots, nextSpot, nudge, slack, strand, timeline, tagName, STEP, stepAfter } from '../ontologies/joyce.js';

const train = (w, room = MESSY, ...texts) => {
  const t = startTrain(w, room, 0, 0);
  texts.forEach((x, i) => addThought(w, t.id, x, i + 1));
  return t;
};

test('a new world has only Messy thoughts, seen in Joyce', () => {
  const w = emptyWorld();
  assert.deepEqual(rooms(w).map((r) => r.id), [MESSY]);
  assert.equal(view(w, MESSY).mode, 'joyce');
});

test('a world saved in an older shape is not kept: it starts afresh', () => {
  const w = loadWorld({ v: 2, things: { t: { id: 't', kind: 'train', parent: 'messy', at: 1 } }, places: {} });
  assert.deepEqual(Object.keys(w.things), [MESSY]);
  assert.equal(w.v, 3);
});

test('a saved world without the messy room gets it back', () => {
  const w = loadWorld({ v: 3, things: { r1: { id: 'r1', kind: 'room', parent: null, at: 1, name: 'Other' } } });
  assert.deepEqual(rooms(w).map((r) => r.id).sort(), [MESSY, 'r1'].sort());
});

test('what can sit inside what: items and groups in rooms, rooms at the top', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.ok(canHold(w, MESSY, 'line'));
  assert.ok(canHold(w, MESSY, 'group'));
  assert.ok(!canHold(w, t.id, 'line')); // a group lists its items; they sit in the room
  assert.ok(!canHold(w, MESSY, 'room')); // rooms sit only on the rooms page
  assert.ok(canHold(w, null, 'room'));
  assert.ok(!canHold(w, t.id, 'room'));
  const a = addThought(w, t.id, 'a');
  assert.equal(a.parent, MESSY);
  assert.deepEqual(t.members, [a.id]);
});

test('thoughts in a train keep the order they were written in', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  addThought(w, t.id, 'second', 20);
  addThought(w, t.id, 'first', 10);
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['first', 'second']);
});

test('an empty thought is not kept, and spaces are tidied', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.equal(addThought(w, t.id, '   '), null);
  assert.equal(addThought(w, t.id, '  a   b ').text, 'a b');
});

test('a passage keeps its lines', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.equal(create(w, t.id, { kind: 'passage', title: ' ', body: '  ' }), null);
  assert.equal(create(w, t.id, { kind: 'passage', title: 'On notes', body: 'one\nline two' }).body, 'one\nline two');
});

test('moving a train takes every thought with it, in order', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Elsewhere');
  const t = train(w, MESSY, 'a', 'b');
  assert.ok(move(w, t.id, r.id, 5, 6));
  assert.equal(roomThoughts(w, MESSY).length, 0);
  assert.deepEqual(roomThoughts(w, r.id).map((th) => th.text), ['a', 'b']);
  assert.deepEqual(roomTrains(w, r.id).map((x) => x.id), [t.id]);
});

test('moving one thought into a room gives it a train there; the rest stays joined', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Elsewhere');
  const t = train(w, MESSY, 'a', 'b', 'c');
  const b = trainThoughts(w, t.id)[1];
  pessoa.drop(w, MESSY, b.id, 9, 9);
  assert.ok(move(w, b.id, r.id));
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['a', 'c']);
  assert.equal(roomThoughts(w, r.id)[0].text, 'b');
  assert.equal(own(w, MESSY, 'pessoa')[b.id], undefined);
  assert.equal(groupOf(w, b.id).parent, r.id);
});

test('a train left empty by a move is removed', () => {
  const w = emptyWorld();
  const r = addRoom(w);
  const t = train(w, MESSY, 'only');
  move(w, trainThoughts(w, t.id)[0].id, r.id);
  assert.equal(w.things[t.id], undefined);
});

test('a new room is Joyce by default, or the ontology asked for', () => {
  const w = emptyWorld();
  const j = addRoom(w, 'J'), p = addRoom(w, 'P', 1, {}, 'pessoa');
  assert.equal(view(w, j.id).mode, 'joyce');
  assert.equal(view(w, p.id).mode, 'pessoa');
  assert.ok(!move(w, j.id, p.id)); // a room never goes inside another
});

test('pages: rooms on the rooms page sit on one page each, with grids of their own', () => {
  const w = emptyWorld();
  assert.equal(pageCount(w), 1);
  const p = addPage(w);
  assert.equal(p, 1);
  const r = addRoom(w, 'Two', 1, { page: 1 });
  assert.equal(r.page, 1);
  assert.equal(r.col, undefined); // the floors feature places it
  Object.assign(r, { col: 0, row: 0 }); // Messy's cells are on page 0
  assert.equal(roomAt(w, 0, 0, null, 1).id, r.id);
  assert.equal(roomAt(w, 0, 0).id, MESSY);
  assert.equal(pageCount(w), 2);
  assert.deepEqual(roomsOn(w, 1).map((x) => x.id), [r.id]);
});

test('Messy thoughts and 2 × 2 rooms are big; 1 × 1 rooms are not', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'R');
  assert.ok(isBig(w.things[MESSY]));
  assert.ok(!isBig(r));
  r.size = 2;
  assert.ok(isBig(r));
});

test('removing a room removes what is in it; Messy thoughts stays', () => {
  const w = emptyWorld();
  const r = addRoom(w);
  const t = train(w, r.id, 'x');
  remove(w, r.id);
  assert.equal(w.things[t.id], undefined);
  remove(w, MESSY);
  assert.ok(w.things[MESSY]);
});

test('a train closes into one thought, named, and opens back in order', () => {
  const w = emptyWorld();
  const t = train(w, MESSY, 'a', 'b', 'c');
  assert.ok(closeGroup(w, t.id));
  name(w, t.id, 'Letters');
  assert.ok(t.closed);
  assert.equal(thoughtText(w, t), 'a\nb\nc');
  assert.equal(w.things[t.id].title, 'Letters');
  assert.equal(roomUnits(w, MESSY).length, 3); // its thoughts are still there, one by one
  assert.ok(openGroup(w, t.id));
  assert.equal(t.closed, undefined);
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['a', 'b', 'c']);
});

test('naming works on rooms and passages too', () => {
  const w = emptyWorld();
  name(w, MESSY, 'Mess');
  assert.equal(w.things[MESSY].name, 'Mess');
  const t = startTrain(w, MESSY, 0, 0);
  const p = create(w, t.id, { kind: 'passage', body: 'x' });
  name(w, p.id, 'Title');
  assert.equal(w.things[p.id].title, 'Title');
});

test('emptying a thought removes it, and its train if it was alone', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  const p = create(w, t.id, { kind: 'passage', title: 'x' });
  update(w, p.id, { title: '' });
  assert.equal(w.things[p.id], undefined);
  assert.equal(w.things[t.id], undefined);
});

test('a room\'s tint, lightness and opacity are kept in range', () => {
  const w = emptyWorld();
  update(w, MESSY, { tint: '#AABBCC', light: 3, opacity: -1 });
  assert.equal(w.things[MESSY].tint, '#AABBCC');
  assert.equal(w.things[MESSY].light, 1);
  assert.equal(w.things[MESSY].opacity, 0);
});

test('the spiral moves outwards as thoughts are added', () => {
  const r = (i) => { const p = spiralPoint(i); return Math.hypot(p.x, p.y); };
  assert.ok(r(30) > r(10) && r(10) > r(1));
});

test('a dragged Pessoa thought stays where it was put, in Pessoa\'s own data', () => {
  const w = emptyWorld();
  const t = train(w, MESSY, 'x');
  const a = trainThoughts(w, t.id)[0];
  pessoa.drop(w, MESSY, a.id, 123, 45);
  assert.deepEqual(pessoa.point(w, MESSY, a.id), { x: 123, y: 45 });
  assert.deepEqual(w.own[MESSY].pessoa[a.id], { x: 123, y: 45 });
  remove(w, a.id);
  assert.equal(w.own[MESSY].pessoa[a.id], undefined);
});

test('a random spot is inside the box', () => {
  const p = randomSpot({ x: 10, y: 20, w: 100, h: 50 }, [{ x: 0, y: 0 }]);
  assert.ok(p.x >= 10 && p.x <= 110 && p.y >= 20 && p.y <= 70);
});

test('Messy thoughts takes four squares at the top left of the grid', () => {
  const w = emptyWorld();
  const m = rooms(w)[0];
  assert.deepEqual([m.col, m.row, m.size], [0, 0, 2]);
  assert.equal(roomAt(w, 1, 1).id, MESSY);
  assert.equal(roomAt(w, 2, 0), null);
});

test('A thought edited over several lines keeps its lines and pushes the next one down', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0, 0);
  const a = addThought(w, t.id, 'one', 1), b = addThought(w, t.id, 'two', 2);
  update(w, a.id, { text: '  first line  \r\nsecond line\n\n\n\nthird  ' }, 3);
  assert.equal(a.text, 'first line\nsecond line\n\nthird');
  assert.equal(stepAfter(a), STEP.line + 3 * 29);
  assert.deepEqual(trainSpots(w, t.id)[b.id], { x: 0, y: stepAfter(a) });
  assert.equal(search(w, 'second line third')[0].id, a.id); // search reads across the lines
});

test('Joyce: a train\'s thoughts sit a step apart until one is dragged, and stay joined', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 100, 200, 0);
  const a = addThought(w, t.id, 'one', 1), b = addThought(w, t.id, 'two', 2), c = addThought(w, t.id, 'three', 3);
  let s = trainSpots(w, t.id);
  assert.deepEqual(s[a.id], { x: 100, y: 200 });
  assert.deepEqual(s[b.id], { x: 100, y: 200 + STEP.line });
  assert.ok(nudge(w, b.id, 400, 500, 9));
  s = trainSpots(w, t.id);
  assert.deepEqual(s[b.id], { x: 400, y: 500 });
  assert.deepEqual(s[c.id], { x: 400, y: 500 + STEP.line });
  assert.equal(groupOf(w, b.id).id, t.id);
  assert.deepEqual(nextSpot(w, t.id), { x: 400, y: 500 + 2 * STEP.line });
  Object.assign(t, { x: 0, y: 0 }); // moving the train moves its dragged thoughts too
  assert.deepEqual(trainSpots(w, t.id)[b.id], { x: 300, y: 300 });
});

test('the line is taut between quick thoughts, slack after a pause, and straight when pulled', () => {
  const quick = slack({ at: 0 }, { at: 2000 }, STEP.line);
  const pause = slack({ at: 0 }, { at: 1800e3 }, STEP.line);
  const pulled = slack({ at: 0 }, { at: 1800e3 }, 900);
  assert.ok(quick < 0.2 && pause > 0.6 && pulled < 0.05, `${quick} ${pause} ${pulled}`);
  assert.match(strand({ x: 0, y: 0 }, { x: 0, y: 100 }, 0), /^M0 0L0 100$/);
  assert.match(strand({ x: 0, y: 0 }, { x: 0, y: 100 }, 0.8), /Q/);
});

test('the timeline lays a room\'s thoughts in the order they were last changed, with trains as tags', () => {
  const w = emptyWorld();
  const t1 = startTrain(w, MESSY, 0, 0, 0);
  const a = addThought(w, t1.id, 'alpha beta gamma delta', 1);
  const t2 = startTrain(w, MESSY, 0, 0, 2);
  const b = addThought(w, t2.id, 'second', 3);
  update(w, a.id, { text: 'alpha again' }, 10);
  assert.deepEqual(timeline(w, MESSY).map((x) => x.th.id), [b.id, a.id]);
  assert.equal(tagName(w, t2.id), 'second');
  name(w, t2.id, 'Named');
  assert.equal(tagName(w, t2.id), 'Named');
});

test('search finds thoughts, trains and rooms by their words', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Ontology', 1);
  const t = startTrain(w, r.id, 0, 0, 2);
  addThought(w, t.id, 'a building at night', 3);
  const found = search(w, 'night');
  assert.equal(found.length, 1);
  assert.equal(found[0].roomName, 'Ontology');
  assert.equal(search(w, 'ontol')[0].kind, 'room');
  assert.deepEqual(search(w, '  '), []);
});

test('a room keeps a short description, and loses it when it is cleared', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Ontology', 1);
  update(w, r.id, { desc: '  Where the ways of thinking live.  ' });
  assert.equal(r.desc, 'Where the ways of thinking live.');
  update(w, r.id, { desc: 'x'.repeat(DESC + 50) });
  assert.equal(r.desc.length, DESC);
  update(w, r.id, { desc: '' });
  assert.equal('desc' in r, false);
});

test('nothing in a locked room can be written, changed, moved or deleted, and its square stays put', () => {
  const w = emptyWorld();
  const r = Object.assign(addRoom(w, 'Done', 1), { col: 3, row: 0 });
  const t = train(w, r.id, 'kept');
  const th = trainThoughts(w, t.id)[0];
  lock(w, r.id);
  assert.ok(shut(w, th.id));
  assert.equal(addThought(w, t.id, 'more'), null);
  assert.equal(startTrain(w, r.id, 0, 0), null);
  assert.equal(update(w, th.id, { text: 'changed' }), null);
  assert.equal(th.text, 'kept');
  remove(w, th.id);
  remove(w, r.id);
  assert.ok(w.things[th.id] && w.things[r.id]);
  assert.equal(move(w, th.id, MESSY), false);
  const other = train(w, MESSY, 'outside');
  assert.equal(move(w, other.id, r.id), false);
  assert.equal(nudge(w, th.id, 50, 50), false);
  assert.equal(r.col, 3);
  update(w, r.id, { name: 'Done, renamed' }); // the room itself can still be named
  assert.equal(r.name, 'Done, renamed');
  lock(w, r.id, false);
  assert.ok(addThought(w, t.id, 'more'));
});

test('an archived room leaves the grid for the Archive, and comes back with no cell (the floors feature places it)', () => {
  const w = emptyWorld();
  const r = Object.assign(addRoom(w, 'Old', 1), { col: 4, row: 1 });
  train(w, r.id, 'a thought about washi');
  assert.ok(archive(w, r.id));
  assert.equal(rooms(w).some((x) => x.id === r.id), false);
  assert.deepEqual(archived(w).map((x) => x.id), [r.id]);
  assert.equal(r.col, undefined);
  assert.equal(search(w, 'washi').length, 1); // still found
  assert.equal(archive(w, MESSY), false);
  assert.ok(restore(w, r.id));
  assert.equal(r.archived, undefined);
  assert.equal(r.col, undefined);
  lock(w, r.id);
  assert.equal(archive(w, r.id), false); // unlock it first
});

test('a square peeks at the last things written in its room', () => {
  const w = emptyWorld();
  train(w, MESSY, 'one', 'two', 'three', 'four');
  assert.deepEqual(peek(w, MESSY), ['two', 'three', 'four']);
  assert.deepEqual(peek(w, MESSY, 1), ['four']);
});

test('search lights count what each room holds, its name included', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Facade notes');
  train(w, r.id, 'the facade is the work', 'a facade of rooms');
  train(w, MESSY, 'facade, messily', 'nothing');
  assert.equal(topRoom(w, r.id).id, r.id);
  assert.deepEqual(roomHits(w, 'facade'), { [r.id]: 3, [MESSY]: 1 });
  assert.deepEqual(roomHits(w, ''), {});
});

test('a train holds each thought in one train; an ontology of sets holds it in many', () => {
  declareGroups('sets', { membership: 'many' });
  const w = emptyWorld();
  const t = train(w, MESSY, 'a', 'b');
  const [a, b] = trainThoughts(w, t.id);
  const t2 = startTrain(w, MESSY, 0, 0);
  assert.ok(join(w, t2.id, a.id)); // a leaves its train for the new one
  assert.deepEqual([t.members, t2.members], [[b.id], [a.id]]);
  const s1 = create(w, MESSY, { kind: 'group', of: 'sets', title: 'Blue' });
  const s2 = create(w, MESSY, { kind: 'group', of: 'sets', title: 'Night' });
  assert.ok(join(w, s1.id, a.id) && join(w, s2.id, a.id) && join(w, s1.id, b.id));
  assert.deepEqual(groupsOf(w, a.id).map((g) => g.id).sort(), [t2.id, s1.id, s2.id].sort());
  remove(w, s1.id); // a set freed: its thoughts stay
  assert.ok(w.things[a.id] && w.things[b.id]);
  assert.deepEqual(groupsOf(w, a.id, 'sets').map((g) => g.id), [s2.id]);
  remove(w, t2.id); // a train removed: its thoughts go, and leave the sets they were in
  assert.equal(w.things[a.id], undefined);
  assert.equal(w.things[s2.id], undefined); // left empty, so it goes
});

test('any group closes; Pessoa still floats each thought on its own', () => {
  declareGroups('sets', { membership: 'many' });
  const w = emptyWorld();
  const t = train(w, MESSY, 'a', 'b');
  const s = create(w, MESSY, { kind: 'group', of: 'sets', title: 'Both' });
  for (const th of members(w, t.id)) join(w, s.id, th.id);
  assert.ok(closeGroup(w, s.id));
  assert.deepEqual(pessoa.units(w, MESSY).map((u) => u.id), members(w, t.id).map((th) => th.id));
  assert.equal(thoughtText(w, s), 'a\nb');
});

test('a group can hold groups: a train of trains, never itself or a group holding it', () => {
  const w = emptyWorld();
  const a = train(w, MESSY, 'a', 'b');
  const b = train(w, MESSY, 'c');
  const outer = startTrain(w, MESSY, 0, 0, 10);
  assert.ok(join(w, outer.id, a.id));
  assert.ok(join(w, outer.id, b.id));
  assert.deepEqual(members(w, outer.id).map((g) => g.id), [a.id, b.id]);
  assert.deepEqual(itemsIn(w, outer.id).map((th) => th.text), ['a', 'b', 'c']);
  assert.equal(thoughtText(w, outer), 'a\nb\nc');
  assert.ok(holds(w, outer.id, members(w, a.id)[0].id));
  assert.equal(join(w, a.id, outer.id), false); // a loop
  assert.equal(join(w, outer.id, outer.id), false);
  assert.equal(within(w, outer.id).length, 5);
  // Saved and loaded, it still holds them.
  const back = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(back.things[outer.id].members, [a.id, b.id]);
  // Moved, everything inside goes with it; removed, so does everything inside (trains hold one each).
  const r = addRoom(w, 'Elsewhere');
  assert.ok(move(w, outer.id, r.id));
  assert.ok(within(w, outer.id).every((th) => th.parent === r.id));
  remove(w, outer.id);
  assert.equal(w.things[a.id], undefined);
  assert.equal(children(w, r.id).length, 0);
});

test('moving a group takes its thoughts to the other room, and they leave groups there', () => {
  declareGroups('sets', { membership: 'many' });
  const w = emptyWorld();
  const r = addRoom(w, 'Elsewhere');
  const t = train(w, MESSY, 'a');
  const a = members(w, t.id)[0];
  const s = create(w, MESSY, { kind: 'group', of: 'sets' });
  join(w, s.id, a.id);
  assert.ok(move(w, t.id, r.id, 1, 2));
  assert.equal(a.parent, r.id);
  assert.equal(w.things[s.id], undefined);
});

test('each room keeps its own ontology settings; global ones fill in, reset and apply to all', () => {
  const w = emptyWorld();
  const s = { key: 'tension', default: 0.5 };
  const a = addRoom(w, 'A'), b = addRoom(w, 'B');
  assert.equal(roomSetting(w, a.id, 'joyce', s), 0.5); // the default
  assert.equal(roomSetting(w, a.id, 'joyce', s, { joyce: { tension: 0.2 } }), 0.2); // the global one
  seedRoomSettings(w, b.id, { joyce: { tension: 0.9 } });
  setRoomSetting(w, a.id, 'joyce', 'tension', 0.7);
  assert.equal(roomSetting(w, a.id, 'joyce', s, { joyce: { tension: 0.2 } }), 0.7);
  assert.equal(roomSetting(w, b.id, 'joyce', s, { joyce: { tension: 0.2 } }), 0.9); // kept from when it was made
  resetRoomSettings(w, a.id, 'joyce');
  assert.equal(roomSetting(w, a.id, 'joyce', s, { joyce: { tension: 0.2 } }), 0.2);
  const g = { joyce: { tension: 0.3 } };
  applySettingsToAll(w, g);
  g.joyce.tension = 1; // a copy, not the same object
  for (const id of [a.id, b.id, MESSY]) assert.equal(roomSetting(w, id, 'joyce', s), 0.3);
  assert.deepEqual(loadWorld(JSON.parse(JSON.stringify(w))).settings[b.id], { joyce: { tension: 0.3 } });
});

// ---- Tags ----

const ONTS = [{ id: 'joyce', name: 'Joyce' }, { id: 'pessoa', name: 'Pessoa' }, { id: 'russell', name: 'Russell' }];

test('a small room is tagged with its one mode; a big room with every mode', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Algebra', 1, {}, 'pessoa');
  assert.deepEqual(roomTags(w, r.id, ONTS), [{ tag: 'Pessoa', auto: true }]);
  assert.deepEqual(roomTags(w, MESSY, ONTS).map((t) => t.tag), ['Joyce', 'Pessoa', 'Russell']);
  r.size = 2;
  assert.equal(roomTags(w, r.id, ONTS).length, 3);
});

test('tags are added once whatever their case, and a mode tag cannot be taken off', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Algebra', 1, {}, 'joyce');
  assert.equal(addTag(w, r.id, '  #Linear algebra ', ONTS), true);
  assert.equal(addTag(w, r.id, 'linear ALGEBRA', ONTS), false);
  assert.equal(addTag(w, r.id, 'joyce', ONTS), false);
  assert.equal(addTag(w, r.id, '   ', ONTS), false);
  assert.deepEqual(roomTags(w, r.id, ONTS).map((t) => [t.tag, t.auto]), [['Joyce', true], ['Linear algebra', false]]);
  assert.equal(removeTag(w, r.id, 'Joyce'), false);
  assert.equal(removeTag(w, r.id, 'LINEAR algebra'), true);
  assert.equal(r.tags, undefined);
});

test('tags survive a save and a rename, and are counted across the rooms', () => {
  const w = emptyWorld();
  const a = addRoom(w, 'A', 1, {}, 'joyce');
  const b = addRoom(w, 'B', 2, {}, 'russell');
  addTag(w, a.id, 'Book', ONTS);
  addTag(w, b.id, 'book', ONTS);
  name(w, a.id, 'A2');
  const back = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(back.things[a.id].tags, ['Book']);
  assert.ok(hasTag(back, b.id, '#BOOK', ONTS));
  assert.deepEqual(allTags(back, ONTS), [{ tag: 'Joyce', n: 2 }, { tag: 'Pessoa', n: 1 }, { tag: 'Russell', n: 2 }, { tag: 'Book', n: 2 }]);
  archive(back, b.id);
  assert.deepEqual(allTags(back, ONTS).find((t) => t.tag === 'Book').n, 1);
  assert.deepEqual(allTags(back, ONTS, true).find((t) => t.tag === 'Book').n, 2);
});

test('tag groups: Ontology holds the modes; "Group: tag" makes a group; a tag is in one group', () => {
  const w = emptyWorld();
  const a = addRoom(w, 'A', 1, {}, 'joyce');
  const b = addRoom(w, 'B', 2, {}, 'pessoa');
  assert.equal(addTag(w, a.id, 'Subject: Algebra', ONTS), true);
  assert.deepEqual(a.tags, ['Algebra']);
  assert.equal(tagGroup(w, 'algebra', ONTS), 'Subject');
  assert.equal(tagGroup(w, 'Joyce', ONTS), ONTOLOGY);
  assert.equal(addTag(w, b.id, 'subject: Topology', ONTS), true);
  assert.equal(tagGroup(w, 'Topology', ONTS), 'Subject'); // the group keeps its first spelling
  addTag(w, b.id, 'Draft', ONTS);
  assert.equal(setTagGroup(w, 'Joyce', 'Subject', ONTS), false);
  assert.equal(setTagGroup(w, 'Draft', 'ontology', ONTS), false);
  assert.deepEqual(groupNames(w), ['Ontology', 'Subject']);
  assert.deepEqual(tagsByGroup(w, ONTS).map((g) => [g.group, g.tags.map((t) => t.tag)]),
    [['Ontology', ['Joyce', 'Pessoa', 'Russell']], ['Subject', ['Algebra', 'Topology']], [null, ['Draft']]]);
  assert.equal(setTagGroup(w, 'Algebra', '', ONTS), true);
  assert.equal(tagGroup(w, 'Algebra', ONTS), null);
  const back = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.equal(tagGroup(back, 'Topology', ONTS), 'Subject');
});

test('+ makes tags and groups before any room has them; they show with 0', () => {
  const w = emptyWorld();
  const a = addRoom(w, 'A', 1, {}, 'joyce');
  assert.equal(makeGroup(w, 'Subject'), true);
  assert.equal(makeGroup(w, 'subject'), false);
  assert.equal(makeGroup(w, 'Ontology'), false);
  assert.deepEqual(tagsByGroup(w, ONTS).map((g) => [g.group, g.tags.length]), [['Ontology', 3], ['Subject', 0]]);
  assert.equal(makeTag(w, 'Algebra', 'subject', ONTS), true);
  assert.equal(makeTag(w, 'Joyce', '', ONTS), false);
  assert.equal(tagGroup(w, 'Algebra', ONTS), 'Subject'); // the made group's spelling
  assert.deepEqual(tagsByGroup(w, ONTS)[1].tags, [{ tag: 'Algebra', n: 0 }]);
  addTag(w, a.id, 'algebra', ONTS);
  assert.deepEqual(allTags(w, ONTS).find((t) => t.tag.toLowerCase() === 'algebra').n, 1);
  const back = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.deepEqual([back.tagsMade, back.groupsMade], [['Algebra'], ['Subject']]);
});

test('a copied room has everything in it copied, with new ids, and shares nothing', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Algebra', 1, { page: 1 });
  update(w, r.id, { desc: 'Groups', tags: ['maths'], col: 2, row: 1 });
  const t = train(w, r.id, 'one', 'two');
  const [a, b] = trainThoughts(w, t.id);
  own(w, r.id, 'russell').arrows = [{ from: a.id, to: b.id, label: 'forgets' }];
  own(w, r.id, 'pessoa')[a.id] = { x: 5, y: 6 };
  view(w, r.id).mode = 'pessoa';
  lock(w, r.id);
  const c = copyRoom(w, r.id, 9);
  assert.equal(c.name, 'Algebra copy');
  assert.equal(c.desc, 'Groups');
  assert.deepEqual(c.tags, ['maths']);
  assert.equal(c.page, 1);
  assert.ok(!c.locked && c.col == null && c.row == null, 'unlocked, with no cell yet');
  assert.equal(roomThoughts(w, c.id).map((th) => th.text).join(), 'one,two');
  const [ct] = roomTrains(w, c.id);
  assert.ok(ct.id !== t.id);
  const [ca, cb] = trainThoughts(w, ct.id);
  assert.ok(ca.id !== a.id && cb.id !== b.id, 'new ids');
  assert.deepEqual(own(w, c.id, 'russell').arrows, [{ from: ca.id, to: cb.id, label: 'forgets' }]);
  assert.deepEqual(own(w, c.id, 'pessoa')[ca.id], { x: 5, y: 6 });
  assert.equal(view(w, c.id).mode, 'pessoa');
  lock(w, c.id, false);
  update(w, ca.id, { text: 'changed' });
  assert.equal(w.things[a.id].text, 'one', 'the first room is untouched');
  assert.equal(trainThoughts(w, t.id).length, 2);
});

test('Messy thoughts copies into an ordinary 2 × 2 room; an archived room is not copied', () => {
  const w = emptyWorld();
  const c = copyRoom(w, MESSY, 2);
  assert.ok(c.id !== MESSY);
  assert.equal(c.size, 2);
  const r = addRoom(w, 'Old', 1);
  archive(w, r.id);
  assert.equal(copyRoom(w, r.id), null);
});

test('inside reading(), who holds what is listed once and kept true as groups change', () => {
  declareGroups('sets', { membership: 'many' });
  const w = emptyWorld();
  const t = train(w, MESSY, 'a', 'b');
  const [a, b] = trainThoughts(w, t.id);
  const s1 = create(w, MESSY, { kind: 'group', of: 'sets', title: 'Blue' }, 5);
  join(w, s1.id, a.id);
  const ids = (gs) => gs.map((g) => g.id);
  const outside = ids(groupsOf(w, a.id));
  reading(w, () => {
    assert.deepEqual(ids(groupsOf(w, a.id)), outside); // the same answer, in the same order
    assert.deepEqual(ids(groupsOf(w, a.id, 'sets')), [s1.id]);
    assert.equal(groupOf(w, b.id)?.id, t.id);
    const s2 = create(w, MESSY, { kind: 'group', of: 'sets', title: 'Night' }, 6);
    join(w, s2.id, b.id); // joined while reading: seen at once
    assert.deepEqual(ids(groupsOf(w, b.id, 'sets')), [s2.id]);
    leave(w, s1.id, a.id); // left (and s1, now empty, gone): seen at once
    assert.deepEqual(ids(groupsOf(w, a.id, 'sets')), []);
    reading(w, () => assert.deepEqual(ids(groupsOf(w, a.id)), [t.id])); // reading inside reading
    remove(w, t.id);
    assert.deepEqual(ids(groupsOf(w, b.id)), []);
  });
  const w2 = emptyWorld(); // another world while reading this one: read as before
  const t2 = train(w2, MESSY, 'c');
  reading(w, () => assert.equal(groupOf(w2, trainThoughts(w2, t2.id)[0].id)?.id, t2.id));
});
