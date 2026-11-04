// Tests for Russell: chapters in a tree, joined by arrows with no loops and at most two parents.

import { test, assert } from 'folio/testing';
import { emptyWorld, create, remove, MESSY, groupOf } from '../model.js';
import russell, {
  addChapter, link, unlink, setLabel, labelOf, parentsOf, childrenOf, arrows, whyNot, levels, layout,
  chapterSize, chapters, chapterName,
} from '../ontologies/russell.js';

// A chapter with one thought in it (a chapter with no thoughts goes).
let clock = 10;
const chapter = (w, text) => {
  const g = addChapter(w, MESSY, {}, clock++);
  create(w, g.id, { kind: 'line', text }, clock++);
  return g.id;
};

// E's linear algebra book: Equations → Arrays → Matrices → four children; Eigenvalues under
// Similarity; Spectral theorem a junction under Inner products and Eigenvalues.
function book() {
  const w = emptyWorld(1);
  const c = {};
  for (const n of ['Equations', 'Arrays', 'Matrices', 'Vector spaces', 'Inner products', 'Similarity', 'Floating point', 'Eigenvalues', 'Spectral theorem']) c[n] = chapter(w, n);
  const arrow = (a, b, label) => assert.equal(link(w, MESSY, c[a], c[b], label), '', `${a} → ${b}`);
  arrow('Equations', 'Arrays', 'forgets the unknowns');
  arrow('Arrays', 'Matrices');
  for (const k of ['Vector spaces', 'Inner products', 'Similarity', 'Floating point']) arrow('Matrices', k);
  arrow('Similarity', 'Eigenvalues');
  arrow('Inner products', 'Spectral theorem');
  arrow('Eigenvalues', 'Spectral theorem');
  return { w, c };
}

test('an arrow that would make a loop is refused', () => {
  const w = emptyWorld(1);
  const a = chapter(w, 'a'), b = chapter(w, 'b'), c = chapter(w, 'c');
  assert.equal(link(w, MESSY, a, b), '');
  assert.equal(link(w, MESSY, b, c), '');
  assert.match(link(w, MESSY, c, a), /loop/);
  assert.match(link(w, MESSY, b, a), /loop/);
  assert.match(link(w, MESSY, a, a), /own parent/);
  assert.match(link(w, MESSY, a, b), /already/);
  assert.deepEqual(parentsOf(w, MESSY, a), []);
  assert.deepEqual(arrows(w, MESSY).map((x) => [x.from, x.to]), [[a, b], [b, c]]);
});

test('a junction has two parents; a third is refused', () => {
  const w = emptyWorld(1);
  const a = chapter(w, 'a'), b = chapter(w, 'b'), j = chapter(w, 'j'), d = chapter(w, 'd');
  assert.equal(link(w, MESSY, a, j), '');
  assert.equal(link(w, MESSY, b, j), '');
  assert.match(link(w, MESSY, d, j), /two parents/);
  assert.deepEqual(parentsOf(w, MESSY, j), [a, b]);
  assert.deepEqual(childrenOf(w, MESSY, a), [j]);
  assert.ok(unlink(w, MESSY, a, j));
  assert.deepEqual(parentsOf(w, MESSY, j), [b]);
  assert.equal(whyNot(w, MESSY, d, j), '');
});

test('labels: what the child forgets, kept on the arrow', () => {
  const { w, c } = book();
  assert.equal(labelOf(w, MESSY, c.Equations, c.Arrays), 'forgets the unknowns');
  assert.ok(setLabel(w, MESSY, c.Arrays, c.Matrices, '  forgets   the shape '));
  assert.equal(labelOf(w, MESSY, c.Arrays, c.Matrices), 'forgets the shape');
  assert.ok(setLabel(w, MESSY, c.Arrays, c.Matrices, ''));
  assert.equal(labelOf(w, MESSY, c.Arrays, c.Matrices), '');
  assert.ok(!setLabel(w, MESSY, c.Equations, c.Matrices, 'no arrow here'));
});

test('a chapter removed takes its arrows with it', () => {
  const { w, c } = book();
  remove(w, c.Similarity);
  assert.deepEqual(parentsOf(w, MESSY, c.Eigenvalues), []);
  assert.deepEqual(parentsOf(w, MESSY, c['Spectral theorem']), [c['Inner products'], c.Eigenvalues]);
  assert.deepEqual(childrenOf(w, MESSY, c.Matrices).length, 3);
  assert.equal(levels(w, MESSY)[c.Eigenvalues], 0);
});

test('layout: generations a level lower, a junction under both parents, nothing overlapping', () => {
  const { w, c } = book();
  const lv = levels(w, MESSY);
  assert.equal(lv[c.Equations], 0);
  assert.equal(lv[c.Matrices], 2);
  assert.equal(lv[c.Similarity], 3);
  assert.equal(lv[c.Eigenvalues], 4);
  assert.equal(lv[c['Spectral theorem']], 5);
  const at = layout(w, MESSY);
  const box = (id) => ({ ...at[id], ...chapterSize(w, id) });
  // Each level is lower than the one above, all the way down.
  for (const { from, to } of arrows(w, MESSY)) assert.ok(box(to).y >= box(from).y + box(from).h, `${chapterName(w, to)} under ${chapterName(w, from)}`);
  // The four siblings stand side by side on one level, under Matrices.
  const four = ['Vector spaces', 'Inner products', 'Similarity', 'Floating point'].map((n) => box(c[n]));
  assert.ok(four.every((b) => b.y === four[0].y));
  const mid = (b) => b.x + b.w / 2;
  assert.ok(Math.abs((mid(four[0]) + mid(four[3])) / 2 - mid(box(c.Matrices))) < 1);
  // The junction sits between its parents, below both.
  const j = box(c['Spectral theorem']);
  const lo = Math.min(mid(box(c['Inner products'])), mid(box(c.Eigenvalues)));
  const hi = Math.max(mid(box(c['Inner products'])), mid(box(c.Eigenvalues)));
  assert.ok(mid(j) >= lo && mid(j) <= hi);
  // No two chapters overlap.
  const all = chapters(w, MESSY).map((g) => box(g.id));
  for (let i = 0; i < all.length; i++) for (let k = i + 1; k < all.length; k++) {
    const a = all[i], b = all[k];
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    assert.ok(!overlap, `chapters ${i} and ${k} overlap`);
  }
});

test('layout: wide subtrees push their neighbours aside; a chapter placed by hand stays', () => {
  const w = emptyWorld(1);
  const r = chapter(w, 'root');
  const a = chapter(w, 'a'), b = chapter(w, 'b');
  link(w, MESSY, r, a); link(w, MESSY, r, b);
  const kids = [1, 2, 3].map((i) => chapter(w, `a${i}`));
  kids.forEach((k) => link(w, MESSY, a, k));
  const bk = chapter(w, 'b1');
  link(w, MESSY, b, bk);
  const at = layout(w, MESSY, () => ({ w: 300, h: 60 }));
  const row = [...kids, bk].map((id) => at[id].x).sort((x, y) => x - y);
  for (let i = 1; i < row.length; i++) assert.ok(row[i] - row[i - 1] >= 300, 'grandchildren clear of each other');
  russell.drop(w, MESSY, b, 2000, 40);
  const moved = layout(w, MESSY, () => ({ w: 300, h: 60 }));
  assert.deepEqual(moved[b], { x: 2000, y: 40 });
  assert.equal(moved[bk].x, 2000); // its child hangs under it
});

test('writing: a move asks for a child chapter; with none asked, a thought waits in the tray', () => {
  const w = emptyWorld(1);
  const p = chapter(w, 'parent');
  assert.equal(russell.begin(w, MESSY, { x: 0, y: 0, for: null }, 5), null);
  const g = russell.begin(w, MESSY, { x: 0, y: 0, for: { parent: p } }, 5);
  create(w, g.id, { kind: 'line', text: 'child' }, 1e5);
  assert.deepEqual(parentsOf(w, MESSY, g.id), [p]);
  const loose = create(w, MESSY, { kind: 'line', text: 'loose' }, 1e6);
  assert.deepEqual(russell.tray(w, MESSY).map((th) => th.id), [loose.id]);
  // Dragged out onto the empty canvas, it starts a chapter of its own; onto a chapter, it joins it.
  russell.drop(w, MESSY, loose.id, 5000, 5000);
  assert.deepEqual(russell.tray(w, MESSY), []);
  const own = groupOf(w, loose.id, 'russell');
  assert.ok(own && own.id !== p && own.id !== g.id);
  const at = russell.point(w, MESSY, p);
  russell.drop(w, MESSY, loose.id, at.x, at.y);
  assert.equal(groupOf(w, loose.id, 'russell').id, p);
  assert.equal(russell.tag(w, loose.id).name, 'parent');
});
