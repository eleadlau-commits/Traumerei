// Reading notes (app/optional/extra/reading/) through the plugin API, on a host: the sample
// library laid out as columns, a note kept after the chosen one landing in its source as one step,
// a new source with a unique citation key, the Details edits kept in the source's own fields and
// carried by a .traum file, a new library seen as Library, and a 1,500-note library laid out quickly.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(file) {
  try { return await import(new URL(`../../../optional/extra/reading/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../reading/${file}`, import.meta.url).href); }
}
const R = await load('Reading.js');
const X = await load('rules.js');
const D = await load('docks.js');
const S = await load('tests/sample.js');
const N = await load('notes.js');
const F = await load('find.js');
const IO = await load('io.js');
const C = await load('cite.js');
const WD = await load('word.js');
const K = await load('collections.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  let api = null;
  const { t, off } = host.plug('reading', (tt) => { api = R.install(tt); }, { api: 3 });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  const rule = host.added('reading').find((a) => a.slot === 'world.ontologies' && a.item.id === X.RULE).item;
  const measure = (text, width) => t.ui.measure(text, width);
  const lay = () => X.layout(t, s.room, measure);
  return { host, t, off, api, s, rule, lay };
}

test('reading: the sample library is five sources, each a column of its notes, Darwin first, its 6th edition next', () => {
  const { host, t, s, lay } = setUp();
  const L = lay();
  assert.deepEqual(L.columns.map((c) => t.marks.get(c.source).citekey), ['darwin1859origin', 'darwin1872origin', 'mill1859liberty', 'thoreau1854walden', 'wollstonecraft1792vindication']);
  assert.equal(L.rows.length, s.notes.length, 'every note placed');
  assert.deepEqual(X.notesOf(t, s.sources[0]), s.notes.slice(0, 4), 'in stream order');
  assert.equal(X.quoteOf(t, s.quotes[0]).label, 'p. 490');
  assert.equal(X.aboutOf(t, s.comments[0]), s.quotes[0]);
  assert.equal(X.editionOf(t, s.sources[1]), s.sources[0]);
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: a note kept after the chosen one lands right after it, in its source, as one step', () => {
  const { host, t, s, rule, lay } = setUp();
  const [darwin] = s.sources;
  const first = X.notesOf(t, darwin).at(-1);
  host.choose(s.room, first);
  const row = lay().rows.find((r) => r.mark === first);
  const th = host.lib.model.create(host.w, s.room, { kind: 'line', text: 'A new note.' }, host.tick());
  rule.land(host.w, s.room, th.id, row.x, row.y);
  host.world.save();
  assert.deepEqual(X.notesOf(t, darwin).slice(-2), [first, th.id]);
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.ok(!t.marks.get(th.id), 'one Ctrl+Z takes the note and its place back together');
});

test('reading: with no note under it, a note lands at the end of the open source', () => {
  const { host, t, s, rule, api } = setUp();
  const mill = s.sources[2];
  api.open(mill, { go: false });
  const th = host.lib.model.create(host.w, s.room, { kind: 'line', text: 'Another.' }, host.tick());
  rule.land(host.w, s.room, th.id, 0, -5000);
  host.world.save();
  assert.equal(X.notesOf(t, mill).at(-1), th.id);
});

test('reading: New source makes a source with a unique key, open; Details edits keep its fields', () => {
  const { host, t, s, api } = setUp();
  const a = api.newSource(), b = api.newSource();
  assert.ok(a && b, 'made');
  assert.equal(t.marks.get(a).citekey, 'anonnduntitled');
  assert.equal(t.marks.get(b).citekey, 'anonnduntitleda');
  assert.equal(api.openOf(s.room), b, 'the new one is open');
  const e = D.editFor(t.marks.get(a), 'authors', 'Darwin, Charles', X.keysIn(t, s.room, a));
  assert.ok(t.marks.edit(a, e.fields).ok);
  assert.ok(t.marks.edit(a, D.editFor(t.marks.get(a), 'year', '1871', X.keysIn(t, s.room, a)).fields).ok);
  assert.ok(t.marks.edit(a, D.editFor(t.marks.get(a), 'title', 'The Descent of Man', X.keysIn(t, s.room, a)).fields).ok);
  const src = t.marks.get(a);
  assert.deepEqual(src.authors, ['Darwin, Charles']);
  assert.equal(src.year, '1871');
  assert.equal(src.title, 'The Descent of Man');
  assert.equal(src.citekey, 'darwin1871descent', 'the key it was given follows');
  // Carried by a .traum file: read back into a new room, the fields are there.
  const text = t.carriers.text(s.room);
  const got = t.carriers.read(text);
  const out = t.carriers.land(got);
  assert.ok(out.ok);
  const back = t.marks.in(out.id).find((m) => m.citekey === 'darwin1871descent');
  assert.ok(back && back.year === '1871' && back.authors?.[0] === 'Darwin, Charles');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: New library is a room seen as Library', () => {
  const { t, api } = setUp();
  const id = api.newLibrary();
  assert.ok(id);
  assert.equal(t.marks.get(id).mode, X.RULE);
});

test('reading: switched off and on, nothing of the library is lost', () => {
  const { host, t, off, s } = setUp();
  const before = JSON.stringify(t.carriers.tables(s.room));
  off();
  host.plug('reading', (tt) => R.install(tt), { api: 3 });
  assert.equal(JSON.stringify(host.world.carriers.tables(s.room)), before);
});

// The first layout measures every note's words (t.ui.measure, remembered after): it is part of
// the room opening (0.8 s, tests/speed.mjs). Each layout after a change, as at every Enter, is held
// to the API's 50 ms.
test('reading: a library of 1,500 notes in 20 sources: laid out again in under 50 ms after a note is kept', () => {
  const { host, t } = setUp();
  const r = host.lib.model.addRoom(host.w, 'Big', host.tick(), {}, X.RULE);
  const srcs = Array.from({ length: 20 }, (_, i) => host.lib.model.create(host.w, r.id, { kind: 'group', of: X.SOURCE, family: true, x: 0, y: 0, title: `Source ${i}`, citekey: `k${String(i).padStart(2, '0')}` }, host.tick()).id);
  for (let i = 0; i < 1500; i++) {
    const th = host.lib.model.create(host.w, r.id, { kind: 'line', text: `note ${i} ${'word '.repeat(i % 30)}` }, host.tick());
    host.lib.model.join(host.w, srcs[i % 20], th.id);
  }
  host.world.save();
  const t0 = performance.now();
  assert.equal(t.rules.layout(X.RULE, r.id).length, 1500);
  const cold = performance.now() - t0;
  assert.ok(cold < 400, `first laid out (every note measured) in ${cold.toFixed(1)} ms`);
  const th = host.lib.model.create(host.w, r.id, { kind: 'line', text: 'One more note, kept with Enter.' }, host.tick());
  host.lib.model.join(host.w, srcs[3], th.id);
  host.world.save();
  const t1 = performance.now();
  assert.equal(t.rules.layout(X.RULE, r.id).length, 1501);
  const again = performance.now() - t1;
  assert.ok(again < 50, `laid out again in ${again.toFixed(1)} ms`);
});

// ---- 0.2: quotes, comments, reordering, editions ----

// A note kept in a source, as Enter keeps it (the land proposal), then what the plugin does just after.
function keep(host, t, api, rule, room, words, after) {
  const L = X.layout(t, room, (a, b) => t.ui.measure(a, b));
  const row = after ? L.rows.find((r) => r.mark === after) : { x: 0, y: -5000 };
  if (after) host.choose(room, after);
  const th = host.lib.model.create(host.w, room, { kind: 'line', text: words }, host.tick());
  rule.land(host.w, room, th.id, row.x, row.y);
  host.world.save();
  api.kept(th.id, after || null);
  host.world.save();
  return th.id;
}

test('reading: a note typed as a quote with its page is a quote; the page is the link\'s label, off its words', () => {
  const { host, t, s, rule, api } = setUp();
  const mill = s.sources[2];
  api.open(mill, { go: false });
  const id = keep(host, t, api, rule, s.room, '"Over himself, over his own body and mind, the individual is sovereign." p. 22');
  assert.equal(t.marks.get(id).text, '"Over himself, over his own body and mind, the individual is sovereign."');
  assert.equal(X.quoteOf(t, id).label, 'p. 22');
  assert.equal(X.quoteOf(t, id).to, mill);
  // Edited to another page: the label follows.
  t.marks.edit(id, { text: `${t.marks.get(id).text} p. 23` });
  N.asQuote(t, id);
  assert.equal(X.quoteOf(t, id).label, 'p. 23');
  assert.ok(!t.marks.get(id).text.includes('p. 23'));
  // Alt+Q: a note again, its page back in its words, nothing lost.
  N.toggleQuote(t, id);
  assert.ok(!X.isQuote(t, id));
  assert.ok(t.marks.get(id).text.endsWith('p. 23'));
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: a note written after a quote is a comment under it; Alt+← and Alt+→ take it out and back', () => {
  const { host, t, s, rule, api } = setUp();
  const thoreau = s.sources[3];
  const q = s.quotes.find((id) => X.sourceOf(t, id) === thoreau);
  api.open(thoreau, { go: false });
  const c = keep(host, t, api, rule, s.room, 'Deliberately: the word does the arguing.', q);
  assert.equal(X.aboutOf(t, c), q);
  assert.deepEqual(X.streamOf(t, thoreau).slice(0, 2), [{ id: q, under: null }, { id: c, under: q }]);
  assert.ok(N.unnest(t, c).ok);
  assert.equal(X.aboutOf(t, c), null);
  assert.equal(X.streamOf(t, thoreau)[1].id, c, 'right after the quote\'s block');
  assert.ok(N.nest(t, c).ok);
  assert.equal(X.aboutOf(t, c), q);
  assert.ok(N.nest(t, q).ok === false, 'a quote stands on its own');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: Alt+Shift+↓ moves a quote with its comments down the stream, as one step', () => {
  const { host, t, s } = setUp();
  const darwin = s.sources[0];
  const [q] = X.notesOf(t, darwin);
  const before = X.notesOf(t, darwin);
  assert.ok(N.step(t, q, 1).ok);
  host.world.save();
  const now = X.notesOf(t, darwin);
  assert.equal(now[0], before[3], 'the note that was after the block is first');
  assert.deepEqual(now.slice(1), before.slice(0, 3), 'the quote carried its two comments');
  host.world.undo();
  assert.deepEqual(X.notesOf(t, darwin), before, 'one Ctrl+Z puts it back');
});

test('reading: a quote dragged to another source takes its page and comments along', () => {
  const { host, t, s } = setUp();
  const [darwin, , mill] = s.sources;
  const q = s.quotes[0];
  const kids = X.blockOf(t, q).slice(1);
  assert.ok(N.move(t, q, { source: mill, under: null, before: null }).ok);
  host.world.save();
  assert.deepEqual(X.notesOf(t, mill).slice(-3), [q, ...kids]);
  assert.equal(X.quoteOf(t, q).to, mill);
  assert.equal(X.quoteOf(t, q).label, 'p. 490');
  assert.ok(!X.notesOf(t, darwin).includes(q));
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: a new edition copies the metadata, takes its own key and folds under its source', () => {
  const { host, t, s, api } = setUp();
  const mill = s.sources[2];
  api.open(mill, { go: false });
  const out = N.newEdition(t, mill);
  assert.ok(out.ok);
  const e = t.marks.get(out.id);
  assert.equal(e.title, 'On Liberty');
  assert.deepEqual(e.authors, ['Mill, John Stuart']);
  assert.equal(X.editionOf(t, out.id), mill);
  assert.ok(e.citekey && e.citekey !== t.marks.get(mill).citekey, 'its own key');
  assert.ok(N.setEditionOf(t, mill, out.id).ok === false, 'one with editions is not an edition');
  assert.ok(N.setEditionOf(t, out.id, null).ok);
  assert.equal(X.editionOf(t, out.id), null);
  // Carried by a .traum file: the edition, the quotes' pages and the comments come back.
  const back = t.carriers.land(t.carriers.read(t.carriers.text(s.room)));
  assert.ok(back.ok);
  const marks = t.marks.in(back.id);
  const q = marks.find((m) => m.text?.startsWith('"There is grandeur') && X.quoteOf(t, m.id)?.label === 'p. 490');
  assert.ok(q, 'the quote and its page');
  assert.equal(t.links.to(q.id, X.COMMENT).length, 2, 'its comments');
  const sixth = marks.find((m) => m.citekey === 'darwin1872origin');
  assert.ok(sixth && X.editionOf(t, sixth.id), 'the edition link');
  assert.deepEqual(brokenLaws(host.w), []);
});

// ---- 0.3: tags and finding ----

test('reading: #tags typed in a note put it in those tags (made when new); taken out, a tag holding nothing goes', () => {
  const { host, t, s, rule, api } = setUp();
  const mill = s.sources[2];
  api.open(mill, { go: false });
  const id = keep(host, t, api, rule, s.room, 'Compare Wollstonecraft. #liberty #Speech');
  assert.deepEqual(F.tagsOfNote(t, id).sort(), ['liberty', 'speech']);
  assert.equal(F.tagsOf(t, s.room).find((g) => g.word === 'liberty').notes, 3, 'the sample\'s tag, one more note');
  assert.equal(X.sourceOf(t, id), mill, 'still in its source');
  t.marks.edit(id, { text: 'Compare Wollstonecraft. #liberty' });
  N.syncTags(t, id);
  host.world.save();
  assert.deepEqual(F.tagsOfNote(t, id), ['liberty']);
  assert.ok(!F.tagNamed(t, s.room, 'speech'), 'a tag holding nothing goes');
  assert.equal(N.syncTags(t, id).changed, false, 'nothing to change: no step');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: Find goes through every note by words and #tags; a result opens its source and chooses the note', () => {
  const { host, t, s, api } = setUp();
  const got = F.find(t, s.room, '#liberty');
  assert.deepEqual(got.notes.map((n) => t.marks.get(n.source).citekey), ['mill1859liberty', 'wollstonecraft1792vindication']);
  const grand = F.find(t, s.room, 'grandeur');
  assert.equal(grand.notes.length, 2, 'both editions\' quotes');
  assert.deepEqual(grand.notes.map((n) => n.anchor), ['p. 490', 'p. 429']);
  const hit = grand.notes[1].note;
  assert.ok(api.goTo(hit));
  assert.equal(api.openOf(s.room), s.sources[1], 'the 6th edition open');
  // Every tag is claimed by the Library rule: none is left loose on the canvas.
  const loose = t.places.loose(s.room).filter((id) => F.isTag(t.marks.get(id)));
  assert.deepEqual(loose, []);
});

test('reading: Find in a library of 1,500 notes answers in under 50 ms', () => {
  const { host, t } = setUp();
  const r = host.lib.model.addRoom(host.w, 'Big', host.tick(), {}, X.RULE);
  const srcs = Array.from({ length: 20 }, (_, i) => host.lib.model.create(host.w, r.id, { kind: 'group', of: X.SOURCE, family: true, x: 0, y: 0, title: `Source ${i}`, citekey: `k${i}` }, host.tick()).id);
  for (let i = 0; i < 1500; i++) {
    const th = host.lib.model.create(host.w, r.id, { kind: 'line', text: `note ${i} about ${i % 7 ? 'liberty' : 'wonder'} ${'word '.repeat(i % 20)}` }, host.tick());
    host.lib.model.join(host.w, srcs[i % 20], th.id);
  }
  host.world.save();
  const t0 = performance.now();
  const got = F.find(t, r.id, 'wonder note');
  const ms = performance.now() - t0;
  assert.ok(got.notes.length > 200 - 1, `found ${got.notes.length}`);
  assert.ok(ms < 50, `answered in ${ms.toFixed(1)} ms`);
});

// ---- 0.4: linked files ----

test('reading: a file attached keeps only its path, name, size, hash and page offset, carried by the .traum; detached, gone', () => {
  const { host, t, s, api } = setUp();
  const darwin = s.sources[0];
  const got = { name: 'origin.pdf', bytes: 812345, sha256: 'ab'.repeat(32), path: null };
  assert.ok(api.attach(darwin, got, 'C:\\Users\\E\\Library\\origin.pdf').ok !== false);
  host.world.save();
  assert.deepEqual(t.marks.get(darwin).file, { rel: 'origin.pdf', name: 'origin.pdf', bytes: 812345, sha256: 'ab'.repeat(32), pageOffset: 0 });
  api.setOffset(darwin, 18);
  host.world.save();
  assert.equal(t.marks.get(darwin).file.pageOffset, 18);
  const text = t.carriers.text(s.room);
  assert.ok(text.includes('origin.pdf') && !text.includes('C:\\Users'), 'the path relative to the folder; the folder is this computer\'s, not the file\'s');
  const back = t.carriers.land(t.carriers.read(text));
  assert.equal(t.marks.in(back.id).find((m) => m.citekey === 'darwin1859origin').file.pageOffset, 18);
  api.detach(darwin);
  host.world.save();
  assert.equal(t.marks.get(darwin).file ?? null, null);
  assert.deepEqual(brokenLaws(host.w), []);
});

// ---- 0.5: in and out ----

test('reading: a BibTeX file adds its sources; one already here by key is left as it is; one step', () => {
  const { host, t, s } = setUp();
  const before = X.sourcesIn(t, s.room).length;
  const bib = `@book{darwin1859origin, author={Darwin, Charles}, title={Changed title}, year=1859}
@book{hobbes1651leviathan, author={Hobbes, Thomas}, title={Leviathan}, year={1651}, publisher={Andrew Crooke}}
@article{, author={Smith, Adam}, title={A Theory}, year=1759}`;
  const out = IO.importBib(t, s.room, bib);
  host.world.save();
  assert.deepEqual([out.made, out.kept], [2, 1]);
  const all = X.sourcesIn(t, s.room);
  assert.equal(all.length, before + 2);
  assert.equal(all.find((x) => x.citekey === 'darwin1859origin').title, 'On the Origin of Species by Means of Natural Selection', 'left as it is');
  assert.equal(all.find((x) => x.citekey === 'hobbes1651leviathan').publisher, 'Andrew Crooke');
  assert.ok(all.find((x) => x.citekey === 'smith1759theory'), 'no key: one made');
  host.world.undo();
  assert.equal(X.sourcesIn(t, s.room).length, before, 'one Ctrl+Z takes them all back');
});

test('reading: Zotero annotations come in as quotes with their pages and comments under them', () => {
  const { host, t, s } = setUp();
  const mill = s.sources[2];
  const n0 = X.notesOf(t, mill).length;
  const out = IO.importZotero(t, mill, '“Over himself the individual is sovereign” ([Mill, 1859, p. 22](zotero://select/x)) The core claim.\n\nA note.');
  host.world.save();
  assert.deepEqual([out.quotes, out.comments, out.notes], [1, 1, 1]);
  const [q, c, n] = X.notesOf(t, mill).slice(n0);
  assert.equal(X.quoteOf(t, q).label, 'p. 22');
  assert.equal(X.aboutOf(t, c), q);
  assert.ok(!X.isQuote(t, n) && !X.aboutOf(t, n));
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: Markdown cites with Pandoc keys; Word is a .docx in Chicago author-date', () => {
  const { t, s } = setUp();
  const md = C.markdownOf(t, s.room, 'Sample');
  assert.ok(md.startsWith('---\ntitle: "Sample"'));
  assert.ok(md.includes('## On Liberty [@mill1859liberty]'));
  assert.ok(md.includes('> "The only freedom which deserves the name, is that of pursuing our own good in our own way, so long as we do not attempt to deprive others of theirs." [@mill1859liberty, p. 27]'));
  assert.ok(md.includes('The harm principle in one sentence.'));
  assert.ok(md.includes('[@darwin1872origin, p. 429]'), 'each edition cites its own key and pages');
  const bytes = WD.wordDoc(t, s.room, 'Sample');
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK', 'a zip');
  const xml = WD.bodyOf(t, s.room, 'Sample').join('');
  assert.ok(xml.includes('(Mill 1859, 27)'));
  assert.ok(xml.includes('Darwin, Charles. 1872. '), 'References');
});

// ---- 0.6: collections and boards ----

test('reading: collections nest; a source sits in several; the tree reads by name with counts', () => {
  const { host, t, s } = setUp();
  const { 'Natural history': nat, 'Political philosophy': pol, Liberty: lib } = s.collections;
  const tree = K.collectionTree(t, s.room);
  assert.deepEqual(tree.map((n) => [n.name, n.depth, n.all]), [['Natural history', 1, 3], ['Political philosophy', 1, 2], ['Liberty', 2, 2]]);
  assert.equal(K.collectionParent(t, lib), pol);
  const wollstonecraft = s.sources[4];
  assert.deepEqual(K.collectionsOf(t, wollstonecraft), [lib, pol]);
  assert.deepEqual(K.sourcesUnder(t, pol).length, 2, 'Political philosophy shows Liberty\'s sources too');
  assert.ok(!K.sourcesUnder(t, nat).includes(wollstonecraft));
  assert.equal(X.sourcesIn(t, s.room).length, 5, 'collections are no sources');
  assert.equal(X.layout(t, s.room, (a, b) => t.ui.measure(a, b)).columns.length, 5, 'and no columns');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: a source put in and taken out of a collection, each one step; a collection made inside another', () => {
  const { host, t, s } = setUp();
  const { 'Natural history': nat, Liberty: lib } = s.collections;
  const mill = s.sources[2];
  assert.ok(K.putIn(t, mill, nat).ok);
  host.world.save();
  assert.ok(K.sourcesInCollection(t, nat).includes(mill));
  assert.ok(K.sourcesInCollection(t, lib).includes(mill), 'still in Liberty');
  host.world.undo();
  assert.ok(!K.sourcesInCollection(t, nat).includes(mill));
  assert.ok(K.takeOut(t, mill, lib).ok);
  host.world.save();
  assert.ok(!K.sourcesInCollection(t, lib).includes(mill));
  assert.ok(t.marks.get(mill), 'the source stays in the library');
  const sub = K.newCollection(t, s.room, 'Harm', lib);
  host.world.save();
  assert.ok(sub.ok);
  assert.equal(K.collectionParent(t, sub.id), lib);
  assert.equal(K.collectionDepth(t, sub.id), 3);
  assert.equal(K.newCollection(t, s.room, 'Too deep', sub.id).ok, false, 'three levels at most');
  assert.equal(K.putIn(t, s.notes[0], nat).ok, false, 'only a source goes in a collection');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: a collection moves inside another, never inside itself; deleted, its sources stay and its own collections move up', () => {
  const { host, t, s } = setUp();
  const { 'Natural history': nat, 'Political philosophy': pol, Liberty: lib } = s.collections;
  assert.equal(K.moveCollection(t, pol, lib).ok, false, 'not inside itself');
  assert.ok(K.moveCollection(t, lib, nat).ok);
  host.world.save();
  assert.equal(K.collectionParent(t, lib), nat);
  assert.deepEqual(K.collectionLanding(t, nat, lib, 'into').reason ? 'refused' : 'ok', 'refused');
  assert.deepEqual(K.collectionLanding(t, pol, lib, 'before'), { parent: nat });
  host.world.undo();
  assert.equal(K.collectionParent(t, lib), pol);
  const n = t.marks.in(s.room).length;
  assert.ok(K.removeCollection(t, pol).ok);
  host.world.save();
  assert.ok(!t.marks.get(pol));
  assert.equal(K.collectionParent(t, lib), null, 'Liberty moved up to the top');
  assert.equal(t.marks.in(s.room).length, n - 1, 'only the collection went');
  assert.equal(X.sourcesIn(t, s.room).length, 5);
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.ok(t.marks.get(pol));
  assert.equal(K.collectionParent(t, lib), pol, 'one undo brings it all back');
});

test('reading: as blocks (the room\'s setting) each source is a block of its notes, none overlapping; a note dragged into another block moves there', () => {
  const { host, t, s, rule } = setUp();
  assert.ok(rule.settings.find((x) => x.key === 'across'), 'Sources as: a setting of Library');
  assert.ok(X.setAcross(t, s.room, 3).ok);
  host.world.save();
  assert.equal(X.acrossOf(t.marks.get(s.room).rules[X.RULE]), 3, 'kept in the room');
  const measure = (a, b) => t.ui.measure(a, b);
  const L = X.layout(t, s.room, measure, 3);
  assert.equal(t.rules.layout(X.RULE, s.room).length, L.rows.length, 'the rule lays it out so');
  assert.ok(t.rules.draws(X.RULE, s.room).boxes.some((b) => b.style === 'plain'), 'in frames');
  assert.ok(L.blocks, 'blocks');
  assert.equal(L.rows.length, s.notes.length, 'every note placed');
  assert.equal(L.columns.length, 5);
  const frames = L.columns.map((c) => ({ x0: c.left, x1: c.right, y0: c.top - X.BLOCK.pad, y1: c.bottom + X.BLOCK.pad }));
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
    const a = frames[i], b = frames[j];
    assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `blocks ${i} and ${j} apart`);
  }
  assert.equal(new Set(L.columns.map((c) => c.x)).size, 3, 'three across');
  for (const r of L.rows) {
    const c = L.columns.find((cc) => cc.notes.includes(r.mark));
    assert.ok(r.x - r.width / 2 >= c.left - 0.5 && r.x + r.width / 2 <= c.right + 0.5, `each note inside its block ${JSON.stringify([r.x, r.width, c.left, c.right])}`);
  }
  // Rows at least 20 apart (the room's clear-space: core-gaps.md, gap 5).
  for (const c of L.columns) for (let i = 1; i < c.notes.length; i++) {
    const a = L.rows.find((r) => r.mark === c.notes[i - 1]), b = L.rows.find((r) => r.mark === c.notes[i]);
    assert.ok(b.y - b.height / 2 - (a.y + a.height / 2) >= 19.99, `rows apart ${b.y - b.height / 2 - (a.y + a.height / 2)}`);
  }
  // Thoreau's last note dragged to the end of Mill's block.
  const thoreau = s.sources[3], mill = s.sources[2];
  const note = X.notesOf(t, thoreau).at(-1);
  const col = L.columns.find((c) => c.source === mill);
  const to = X.dropAt(t, s.room, note, col.x, col.bottom - 2, L);
  assert.deepEqual(to, { source: mill, under: null, before: null });
  N.move(t, note, to);
  host.world.save();
  assert.equal(X.notesOf(t, mill).at(-1), note);
  assert.equal(X.dropAt(t, s.room, note, col.right + 400, col.top, L), null, 'between blocks: nowhere');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: as blocks, a 1,500-note library lays out in under 120 ms', () => {
  const { t, s } = setUp();
  const many = [];
  for (let i = 0; i < 1500; i++) many.push(t.marks.make({ content: `Note ${i}: a few words to wrap, about the reading.`, in: s.room }).id);
  const src = s.sources[0];
  t.together(() => { for (const id of many) t.links.link(id, src, 'part of'); });
  const measure = (a, b) => t.ui.measure(a, b);
  const t0 = performance.now();
  const L = X.layout(t, s.room, measure, 4);
  const ms = performance.now() - t0;
  assert.ok(L.rows.length >= 1500);
  assert.ok(ms < 120, `${ms.toFixed(1)} ms`);
});
