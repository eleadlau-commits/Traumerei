// Book (app/optional/book): the pages hold together whatever the maker does. E kept adding
// sub-chapters in Summer, on two facing pages, and zoomed out: the paragraphs made sections one
// after another nested a level deeper each time (3.1, 3.1.1, 3.1.1.1, a fourth level), and far off
// each section heading showed its whole words large, growing up from its row over the chapter's
// heading and the lines above. Now: a book goes three levels deep (a heading made in a section
// that deep is a section beside it), and far off a heading's words stay on one line within the
// page's measure (style.css). And in every state checked here (spreads, sections made in a row,
// a draft open, a paragraph dragged): no two rows share a page's lines, every row sits inside its
// page, each heading's number sits beside its heading on the same page, and what the room is
// handed (t.rules.layout, t.rules.draws) is what the rule laid out.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/${id}/${file}`, import.meta.url).href); }
}
async function text(id, file) {
  for (const u of [`../../${id}/${file}`, `../../../optional/${id}/${file}`]) {
    try { const url = new URL(u, import.meta.url); if (url.protocol === 'file:') return (await import('node:fs')).readFileSync(url, 'utf8'); const r = await fetch(url); if (r.ok) return r.text(); } catch { /* the other folder */ }
  }
  return '';
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const P = await load('book', 'pages.js');
const E = await load('book', 'editing.js');
const S = await load('book', 'tests/sample.js');

const set = (host, room, o) => { const r = host.w.things[room]; r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), ...o } }; host.world.save(); };

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  set(host, s.room, { grid: 'columns', count: '2' }); // facing pages, as E had them
  let draft = null;
  host.lib.draft.setSource((context) => (context === s.room ? draft : null));
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies' && a.item.id === C.RULE).item;
  const measure = (x, w) => t.ui.measure(x, w);
  const size = (id, width) => t.ui.size?.(id, width) || null;
  const lay = () => P.shape(t, s.room, measure, size);
  return { host, t, s, rule, lay, setDraft: (d) => { draft = d; }, done: () => host.lib.draft.setSource(null) };
}

// Every check of a laid-out book with pages.
function holdsTogether(t, s, L, why) {
  const P0 = L.page, lh = L.lineHeight;
  const pageOfPoint = (x, y) => P.pageAt(L, x, y);
  const flowIds = new Set(C.flow(t, s.room));
  const notes = new Set(C.read(t, s.room).notes.map((n) => n.mark));
  const byPage = new Map();
  for (const r of L.rows) {
    if (notes.has(r.mark)) continue;
    const top = r.y - r.height / 2, foot = r.y + r.height / 2;
    const n = pageOfPoint(r.x, r.y);
    if (n == null) { assert.ok(!C.read(t, s.room).at.has(r.mark) || !flowIds.has(r.mark) || r.y > P.belowGrid(L) - 1, `${why}: a row of the book off every page`); continue; }
    const q = P.placeOf(L, n);
    assert.ok(top >= q.y + P0.m * 0.38 - 0.5 && foot <= q.y + P0.h - P0.m + 0.5, `${why}: a row inside page ${n}'s lines (${top.toFixed(1)}–${foot.toFixed(1)})`);
    assert.ok(Math.abs(r.x - q.x) < 1, `${why}: a row on page ${n}'s measure`);
    (byPage.get(n) || byPage.set(n, []).get(n)).push({ top, foot, mark: r.mark });
  }
  for (const [n, rs] of byPage) {
    rs.sort((a, b) => a.top - b.top);
    for (let i = 1; i < rs.length; i++) assert.ok(rs[i].top >= rs[i - 1].foot - 0.5, `${why}: two rows overlap on page ${n}`);
  }
  // Each heading's number: beside its heading's (first) row, on the same page, in the left margin.
  const heads = C.read(t, s.room).items.filter((x) => x.t === 'heading');
  const numbers = L.boxes.filter((b) => b.style === 'heading');
  assert.equal(numbers.length, heads.length, `${why}: a number for each heading`);
  heads.forEach((h, i) => {
    const b = numbers[i], r = L.rows.find((x) => x.mark === h.mark);
    assert.equal(b.label, h.num);
    assert.ok(h.num.split('.').length <= 3, `${why}: three levels at most (${h.num})`);
    assert.ok(Math.abs(b.y - (r.y - r.height / 2 - lh * 0.15)) < 0.5, `${why}: ${h.num} level with its heading`);
    assert.equal(pageOfPoint(b.x + b.w + lh * 0.3, b.y + b.h / 2), pageOfPoint(r.x, r.y), `${why}: ${h.num} on its heading's page`);
  });
}
// What the room draws is what the rule laid out: the same rows (a mark's first piece, and its
// pieces as fragments) and the same boxes, read as the room reads them (the rule's ontology, its
// layout and boxes, remembered by the tables' versions, the room's settings and the draft).
// t.rules.layout is checked too (api) only where the tables changed: core remembers it by the
// tables' versions alone (world/rules.js), so it lags a draft or a setting (core-gaps.md), and
// Book reads its own rows instead.
function handedAsLaid(t, s, rule, w, L, why, api = false) {
  const first = new Map(), pieces = new Map();
  for (const r of L.rows) { if (!first.has(r.mark)) first.set(r.mark, r); pieces.set(r.mark, (pieces.get(r.mark) || 0) + 1); }
  const check = (mark, p, from) => {
    const r = first.get(mark);
    if (!r) return;
    assert.ok(Math.abs(p.x - r.x) < 1e-6 && Math.abs(p.y - r.y) < 1e-6, `${why}: ${from} places ${mark} where the rule did (${p.y.toFixed(1)} vs ${r.y.toFixed(1)})`);
    if (pieces.get(mark) > 1) assert.equal(p.fragments?.length, pieces.get(mark), `${why}: each piece of a paragraph that runs on`);
  };
  for (const [mark, p] of rule.layout(w, s.room)) check(mark, p, 'the room');
  if (api) for (const row of t.rules.layout(C.RULE, s.room)) check(row.mark, { ...row.position, fragments: row.fragments }, 't.rules.layout');
  for (const drawn of [rule.boxes(w, s.room), t.rules.draws(C.RULE, s.room).boxes]) {
    assert.equal(drawn.length, L.boxes.length, `${why}: the boxes drawn are the rule's`);
    drawn.forEach((b, i) => assert.ok(Math.abs(b.y - L.boxes[i].y) < 1e-6 && Math.abs(b.x - L.boxes[i].x) < 1e-6 && b.label === String(L.boxes[i].label ?? ''), `${why}: box ${i} drawn where laid`));
  }
}

test('book layout: sub-chapters made one after another in Summer, on facing pages: three levels at most, nothing overlaps', () => {
  const { host, t, s, rule, lay, done } = setUp();
  try {
    holdsTogether(t, s, lay(), 'as it opens');
    handedAsLaid(t, s, rule, host.w, lay(), 'as it opens', true);
    const summer = s.chapters[4];
    const paras = t.links.members(summer).filter((id) => id !== s.heads[4]);
    // E's way: each paragraph in turn made a heading (it lands in the section the one before made).
    const made = [];
    for (const p of paras) { made.push(E.makeHeading(t, s.room, p)); host.world.save(); }
    assert.ok(made.every(Boolean), 'each one a heading');
    const nums = C.read(t, s.room).items.filter((x) => x.t === 'heading').map((x) => x.num);
    assert.ok(nums.every((n) => n.split('.').length <= 3), `never a fourth level: ${nums.join(' ')}`);
    assert.ok(nums.includes('3.1') && nums.includes('3.1.1'), 'sections and a section in it');
    // The third: a section beside the deepest one, after it (3.1.2), not inside it (3.1.1.1).
    assert.ok(nums.includes('3.1.2') && !nums.includes('3.1.1.1'), nums.join(' '));
    assert.equal(C.headed(t, paras[2]), made[2]);
    assert.equal(E.holderOf(t, made[2]), made[0], 'beside 3.1.1, in 3.1');
    assert.deepEqual(brokenLaws(host.w), []);
    holdsTogether(t, s, lay(), 'after sub-chapters');
    handedAsLaid(t, s, rule, host.w, lay(), 'after sub-chapters', true);
    // Far off, a heading reads as its words (a long one too), on one line in the page's measure.
    const bands = new Map(t.rules.layout(C.RULE, s.room).map((r) => [r.mark, r.bands]));
    assert.equal(bands.get(paras[1])?.far, t.marks.text(paras[1]).split('\n')[0].trim().slice(0, 200));
    // Undone, one step at a time, Summer as it was.
    for (let i = 0; i < paras.length; i++) host.world.undo();
    assert.deepEqual(t.links.members(summer), [s.heads[4], ...paras]);
  } finally { done(); }
});

test('book layout: far off, a heading\'s words stay on one line, cut short within the page (style.css)', async () => {
  const css = await text('book', 'style.css');
  if (!css) return; // (served without its styles)
  const rule = css.split('\n').find((l) => /\.room-band-far \[data-band-far\]::after\s*\{/.test(l)) || '';
  assert.ok(/bottom:\s*0/.test(rule) && /max-width:\s*100%/.test(rule), 'grows up from its row, the measure wide');
  assert.ok(/white-space:\s*nowrap/.test(rule) && /overflow:\s*hidden/.test(rule) && /text-overflow:\s*ellipsis/.test(rule), 'one line, never piling up over what is above it');
});

test('book layout: with a draft open, after a drag, on facing pages, a grid and one under another: the same holds', () => {
  const { host, t, s, rule, lay, setDraft, done } = setUp();
  try {
    const summer = s.chapters[4];
    const paras = t.links.members(summer).filter((id) => id !== s.heads[4]);
    E.makeHeading(t, s.room, paras[0]); host.world.save();
    for (const g of [{ grid: 'columns', count: '2' }, { grid: 'columns', count: '3' }, { grid: 'rows', count: '2' }, { grid: 'columns', count: '1' }]) {
      set(host, s.room, g);
      const why = `${g.grid} ${g.count}`;
      holdsTogether(t, s, lay(), why);
      handedAsLaid(t, s, rule, host.w, lay(), why);
      setDraft({ text: 'A paragraph being written, long enough to wrap onto a second line of the page and then a third one too.', after: paras[0], height: 90 });
      holdsTogether(t, s, lay(), `${why}, a draft open after a section heading`);
      handedAsLaid(t, s, rule, host.w, lay(), `${why}, a draft open`);
      setDraft({ text: 'Another', after: s.paras[1], height: 400 });
      holdsTogether(t, s, lay(), `${why}, a tall draft in Winter`);
      handedAsLaid(t, s, rule, host.w, lay(), `${why}, a tall draft`);
      setDraft(null);
    }
    set(host, s.room, { grid: 'columns', count: '2' });
    // A Winter paragraph dragged onto the top half of Summer's last paragraph.
    const L = lay(), target = L.rows.find((r) => r.mark === paras[2]);
    rule.drop(host.w, s.room, s.paras[0], target.x, target.y - target.height / 2 + 2);
    host.world.save();
    assert.ok(C.read(t, s.room).at.get(s.paras[0]).holder !== s.chapters[0], 'it left Winter');
    assert.deepEqual(brokenLaws(host.w), []);
    holdsTogether(t, s, lay(), 'after a drag');
    handedAsLaid(t, s, rule, host.w, lay(), 'after a drag', true);
  } finally { done(); }
});
