// Book (app/optional/book): the thought being written after a chosen paragraph has room made for
// it (reads.marks.draft): what follows moves down by the draft's height, on pages too, and with no
// draft nothing moves. And going to a page is one move: the mark chosen and one eased
// t.ui.zoom.go (since app 1.1.4).

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const P = await load('book', 'pages.js');
const S = await load('book', 'tests/sample.js');
const Z = await load('book', 'zoom.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  let draft = null;
  host.lib.draft.setSource((context) => (context === s.room ? draft : null));
  const measure = (x, w) => t.ui.measure(x, w);
  return { host, t, s, measure, setDraft: (d) => { draft = d; } };
}
const set = (host, room, o) => { const r = host.w.things[room]; r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), ...o } }; host.world.save(); };
const byMark = (rows) => { const m = new Map(); for (const r of rows) if (!m.has(r.mark)) m.set(r.mark, r); return m; };

test('book draft: one column: the rows after the paragraph being written after move down by its height', () => {
  const { host, t, s, measure, setDraft } = setUp();
  try {
    set(host, s.room, { pages: 'none' });
    const flow = C.flow(t, s.room);
    const anchor = s.paras[0], i = flow.indexOf(anchor);
    const before = byMark(C.column(t, s.room, measure).rows);
    setDraft({ text: 'A new paragraph', after: anchor, height: 80 });
    const after = byMark(C.column(t, s.room, measure).rows);
    for (const id of flow.slice(0, i + 1)) assert.equal(after.get(id).y, before.get(id).y, 'up to the anchor: unchanged');
    for (const id of flow.slice(i + 1)) assert.ok(Math.abs(after.get(id).y - before.get(id).y - (80 + C.DRAFT_TOP)) < 1e-6, 'after it: down by the draft');
    // No height yet: its words measured at the column's width.
    setDraft({ text: 'A new paragraph', after: anchor });
    const m = byMark(C.column(t, s.room, measure).rows);
    const h = measure('A new paragraph', P.textWidth(t, s.room)).height;
    assert.ok(Math.abs(m.get(flow[i + 1]).y - before.get(flow[i + 1]).y - (h + C.DRAFT_TOP)) < 1e-6);
    // Written loose (no mark before it): nothing moves.
    setDraft({ text: 'loose', height: 80 });
    const loose = byMark(C.column(t, s.room, measure).rows);
    for (const id of flow) assert.equal(loose.get(id).y, before.get(id).y);
  } finally { host.lib.draft.setSource(null); }
});

test('book draft: pages: what follows moves down, and on to the next page when it no longer fits', () => {
  const { host, t, s, measure, setDraft } = setUp();
  try {
    const flow = C.flow(t, s.room).filter((id) => P.paginate(t, s.room, measure).pageOf.has(id));
    const anchor = s.paras[0], i = flow.indexOf(anchor);
    const none = P.paginate(t, s.room, measure);
    setDraft(null);
    assert.deepEqual(P.paginate(t, s.room, measure).rows, none.rows, 'no draft: unchanged');
    setDraft({ text: 'x', after: anchor, height: 60 });
    const lay = P.paginate(t, s.room, measure);
    const a = byMark(none.rows), b = byMark(lay.rows);
    assert.equal(b.get(anchor).y, a.get(anchor).y, 'the anchor stays (land finds it by its centre)');
    const next = flow[i + 1];
    if (lay.pageOf.get(next) === none.pageOf.get(next)) assert.ok(Math.abs(b.get(next).y - a.get(next).y - (60 + C.DRAFT_TOP)) < 1e-6, 'the next paragraph down by the draft');
    // A draft as tall as a page: what follows starts the next page, and the pages after shift on.
    setDraft({ text: 'x', after: anchor, height: none.page.h });
    const tall = P.paginate(t, s.room, measure);
    assert.ok(tall.pageOf.get(next) > none.pageOf.get(anchor), 'on to the next page');
    assert.ok(tall.pages >= none.pages, 'repaginated');
    const pages = tall.boxes.filter((x) => x.style === 'page');
    const inPage = (r) => pages.some((p) => r.y - r.height / 2 >= p.y + tall.page.m - 0.5 && r.y + r.height / 2 <= p.y + p.h - tall.page.m + 0.5);
    assert.ok(tall.rows.filter((r) => tall.pageOf.has(r.mark)).every(inPage), 'nothing over a margin');
    // land() still finds the anchor by its centre, the draft written under it.
    const rule = host.added('book').find((x) => x.slot === 'world.ontologies').item;
    const p = rule.point(host.w, s.room, anchor);
    assert.ok(p && Math.abs(p.y - a.get(anchor).y) < 1e-6);
    assert.ok(rule.readsDraft(host.w, s.room), 'the rule reads the draft (laid out again as it grows)');
  } finally { host.lib.draft.setSource(null); }
});

test('book draft: a 1,500-paragraph book with a draft still lays out in under 50 ms', () => {
  const host = makeHost({ thoughts: 0 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const { model } = host.lib;
  const room = model.addRoom(host.w, 'Big', host.tick(), {}, C.RULE);
  const b = model.create(host.w, room.id, { kind: 'group', of: 'book', title: 'Big', family: true, x: 0, y: 0 }, host.tick());
  let anchor = null;
  for (let c = 0; c < 30; c++) {
    const ch = model.create(host.w, room.id, { kind: 'group', of: 'book-chapter', title: `C${c}`, family: true, x: 0, y: 0 }, host.tick());
    model.join(host.w, b.id, ch.id);
    for (let i = 0; i < 50; i++) { const id = model.create(host.w, room.id, { kind: 'line', text: `paragraph ${c}.${i} ${'word '.repeat(20 + (i % 40))}` }, host.tick()).id; model.join(host.w, ch.id, id); if (c === 3 && i === 7) anchor = id; }
  }
  host.world.save();
  let height = 30;
  host.lib.draft.setSource((context) => (context === room.id ? { text: 'new', after: anchor, height } : null));
  try {
    t.rules.layout(C.RULE, room.id);
    height = 60;
    const t0 = performance.now();
    const lay = t.rules.layout(C.RULE, room.id);
    const ms = performance.now() - t0;
    assert.equal(lay.length, 1500);
    assert.ok(ms < 50, `laid out in ${ms.toFixed(1)} ms`);
    const t1 = performance.now();
    t.rules.layout(C.RULE, room.id); // the same height (a key that wraps nothing): remembered
    assert.ok(performance.now() - t1 < 5);
  } finally { host.lib.draft.setSource(null); }
});

test('book draft: going to a page is one move: the mark chosen, then one eased t.ui.zoom.go to the page', () => {
  const lay = { origin: -300, pitch: 1066, page: { w: 714, h: 1010 }, pages: 3, rows: [], pageOf: new Map([['p', 2]]) };
  const calls = [], chosen = [];
  let view = { x: 120, y: 900, zoom: 0.3, band: 'far' };
  const t = {
    ui: {
      chosen: () => ({ context: 'r', mark: chosen.at(-1) ?? null }),
      choose: (ids) => { chosen.push(...ids); return { ok: true }; },
      open: { mark: () => { calls.push('open'); return true; } },
      zoom: { get: () => view, go: (to, o) => { calls.push({ to, ms: o.ms }); view = { ...view, ...to }; return { ok: true, ...to }; }, set: () => ({ ok: true }) },
      toast: () => {},
    },
    marks: { get: (id) => (id === 'r' ? { mode: C.RULE } : null) },
    places: { home: (id) => (id === 'p' ? 'r' : null) },
    slots: { commands: { add: () => {} } },
  };
  const z = Z.installZoom(t, { layout: () => lay });
  assert.ok(z.toPage('r', 'p', 2, 0.8));
  assert.deepEqual(chosen, ['p'], 'the mark chosen, the room not opened again');
  assert.equal(calls.length, 1, 'one move');
  const { to, ms } = calls[0];
  assert.equal(to.zoom, 0.8);
  const top = P.pageTop(lay, 2);
  assert.ok(to.x === 0 && to.y >= top && to.y <= top + lay.page.h, `to page 2 (${Math.round(to.y)}, its top at ${top})`);
  assert.ok(ms >= 260 && ms <= 520, 'longer the further it goes, within 260 to 520 ms');
  // A mark the room does not place: opened, then the view to its page.
  calls.length = 0;
  assert.ok(z.toPage('r', 'elsewhere', 2));
  assert.equal(calls[0], 'open');
  z.stop();
});
