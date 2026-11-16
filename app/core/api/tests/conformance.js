// The conformance suite's moves, shared by the corpus (corpus.test.js) and by `python build.py
// check <id>` (tools/check_plugin.py), which holds any one plugin to the same suite and to the
// speed budgets, headless. Not shipped (tests/).

import { assert } from 'folio/testing';
import { makeHost, brokenLaws, deepFreeze, bigRoom } from './host.js';

// A mark of each kind a plugin adds, made through the API (so its kind's fields are tried, and the
// round-trip carries it); the fields a person would write.
export const SAMPLES = {
  checkbox: { text: 'buy bread' }, quote: { text: 'To be, or not', source: 'Hamlet' }, code: { code: 'let x = 1;\n  x++', lang: 'js' },
  'audio-note': { src: 'data:audio/ogg;base64,AAAA', text: 'hum' }, 'pdf-page': { src: 'data:application/pdf;base64,JVBE', page: '3', name: 'paper' },
  table: { text: 'a | b\n1 | 2' }, sketch: { strokes: [[10, 10, 40, 30, 80, 20]], text: 'a hill' }, figure: { src: 'data:image/png;base64,iVBORw0KGgo=', caption: 'A river', ratio: 0.5 },
  suggestion: { says: 'the two may speak of the same thing', act: 'link' },
};

export const json = (o) => JSON.stringify(o);

// The fields of a mark of a kind no sample names: its plugin's own (a module's `samples` export,
// { kind: fields }), else words in each field it lists, else { text }.
export function sampleOf(item, own = {}) {
  if (own[item.kind]) return own[item.kind];
  if (SAMPLES[item.kind]) return SAMPLES[item.kind];
  if (Array.isArray(item.fields) && item.fields.length) {
    return Object.fromEntries(item.fields.map((f) => [f.key, f.type === 'image' ? 'data:image/png;base64,iVBORw0KGgo=' : `sample ${f.key}`]));
  }
  return { text: 'sample words' };
}

// Makes a mark of each kind the plugin added, and links of each kind it declared, through the API.
// lenient: a kind that refuses in words to be made loose in a room (a heading only a chapter
// holds) is passed over rather than failed; export `samples` to have it made.
export function samples(host, t, id, own = {}, lenient = false) {
  for (const { slot, item } of host.added(id)) {
    if (slot === 'world.items') {
      const r = t.marks.make({ kind: item.kind, content: sampleOf(item, own), in: host.room });
      if (lenient && !r.ok && typeof r.reason === 'string' && r.reason) continue;
      assert.ok(r.ok, `${id}: a ${item.kind} could not be made: ${r.reason}`);
      assert.equal(t.marks.get(r.id).kind, item.kind);
      assert.ok(t.marks.text(r.id).length > 0, `${id}: a ${item.kind} reads no words`);
    }
    if (slot === 'links.kinds') {
      const r = t.links.link(host.ids[7], host.ids[8], item.kind, null, { note: 'why' });
      if (lenient && !r.ok && typeof r.reason === 'string' && r.reason) continue; // its admit refuses two loose thoughts, in words
      assert.ok(r.ok, `${id}: ${r.reason}`);
      assert.equal(t.links.link(host.ids[7], host.ids[8], item.kind).ok, false); // once each way
      assert.ok(t.links.link(host.ids[1], host.lib.model.roomItems(host.w, host.other)[0].id, item.kind).ok, `${id}: links cross rooms`);
    }
  }
}
// A rule added with arrange (simpleRule in v2.js), not a full mode.
export const thin = (item) => typeof item.readsDraft === 'function';
export const tablesOf = (host) => json(host.world.carriers.tables());

// Uses everything a plugin added, as a person would: every rule laid out and asked, every
// command run, every Editor section drawn, every link kind tried, every format sent out.
export async function drive(host, t, added) {
  const errors = [];
  const tryIt = async (what, fn) => { try { await fn(); } catch (err) { errors.push(`${what}: ${err.message}`); } };
  host.choose(host.room, host.ids[4]);
  for (const { slot, item } of added) {
    if (slot === 'world.ontologies') {
      // A thin rule (arrange) places what it is handed; a full mode (Joyce, Russell: the world's own shape) may place only its own units.
      await tryIt(`rule ${item.id} lays out`, () => { const l = t.rules.layout(item.id, host.room); assert.ok(l.length > 0 || !thin(item), `rule ${item.id} placed nothing`); });
      if (item.layout) await tryIt(`rule ${item.id} on a frozen world`, () => { const copy = deepFreeze(JSON.parse(JSON.stringify(host.w))); item.layout(copy, host.room); });
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

// ---- One plugin, as `python build.py check <id>` holds it ----

// The speed budgets a plugin can break on its own, without the app (README.md: the app's are room
// open 0.8 s, Enter 0.35 s, a key 20 ms). Each is measured on a room of 1,500 thoughts.
export const BUDGETS = Object.freeze({
  start: 100, // ms: install(t) / start(), the plugin's share of the app starting
  layout: 50, // ms: a rule lays out the room (API.md, Rules)
  draw: 50, // ms: a rule's draw(reads, context) boxes for the room
  decorate: 50, // ms: every decorator over every thought of the room (it runs on each thought drawn)
  decorateOne: 2, // ms: the slowest single decorate (it runs on each key typed into a thought)
  strip: 20, // ms: a strip line's text, asked afresh (count once per moments.seq())
});

// A memory storage area, as Folio's Storage gives a feature (get, set, remove, has, keys, clear, once).
function memoryArea() {
  const m = new Map();
  return { get: (k, f = null) => (m.has(k) ? m.get(k) : f), set: (k, v) => { m.set(k, v); return true; }, remove: (k) => m.delete(k), has: (k) => m.has(k), keys: () => [...m.keys()], clear: () => m.clear(), once: (n, fn) => { if (!m.has(`once:${n}`)) { m.set(`once:${n}`, 1); fn(); } } };
}

// install(t, feature) for a plugin module: its own `install` export when it has one (the corpus's
// way, easiest to test), else its default class started on a stand-in app whose `traumerei`
// service hands it `t`.
export function installOf(id, mod, host) {
  if (typeof mod.install === 'function') return mod.install;
  const Plugin = mod.default;
  if (typeof Plugin !== 'function') throw new Error(`${id}: its main file exports neither install(t) nor a default class`);
  return (t, feat) => {
    const app = {
      storage: { area: () => memoryArea(), watch: () => () => {} },
      slot: (name) => host.app.slot(name),
      defineSlot: (name) => host.app.slot(name),
      provide() {}, use: (name) => (name === 'traumerei' ? { version: 3, connect: () => t } : null),
      on: () => () => {}, emit() {}, refresh() {}, platform: { native: false, plugin: () => null },
    };
    const f = new Plugin(app, { id, name: id });
    f.attach = (node) => node;
    f.listenTo = () => () => {};
    f.whenStopped = (fn) => feat.whenStopped(fn);
    const started = f.start();
    feat.whenStopped(() => f.stop?.());
    return started;
  };
}

const ms = (fn) => { const s = performance.now(); const out = fn(); return [performance.now() - s, out]; };

// The checks for one plugin: [[name, async fn], …]. `block` is its feature.json's plugin block.
export function pluginChecks(id, mod, block = {}) {
  const own = mod.samples || {};
  // What it offers other plugins (t.peers) counts as something it adds.
  let offered = 0;
  const plugIn = (host) => {
    const install = installOf(id, mod, host);
    return host.plug(id, (t, feat) => {
      const peers = Object.freeze({ ...t.peers, offer: (...a) => { offered++; return t.peers.offer(...a); } });
      return install(Object.freeze(Object.assign(Object.create(Object.getPrototypeOf(t)), t, { peers })), feat);
    }, block);
  };
  return [
    [`${id}: the laws hold with it on, everything it adds is used without an error, and off and on again loses no row`, async () => {
      const host = makeHost();
      const { t, off } = plugIn(host);
      await null;
      samples(host, t, id, own, true);
      const added = host.added(id);
      assert.ok(added.length > 0 || offered > 0, `${id} added nothing through the API`);
      const errors = await drive(host, t, added);
      assert.deepEqual(errors, [], `${id}: ${errors.join('; ')}`);
      assert.deepEqual(brokenLaws(host.w), [], `${id} broke a law`);
      const before = tablesOf(host);
      off();
      assert.equal(host.added(id).length, 0, `${id} left something behind when switched off`);
      assert.equal(tablesOf(host), before, `${id} switched off lost or changed a row`);
      const again = plugIn(host);
      await null;
      assert.equal(host.added(id).length, added.length, `${id} on again adds the same`);
      assert.deepEqual(await drive(host, again.t, host.added(id)), []);
      again.off();
    }],
    [`${id}: a .traum round-trip of a room is stable with it on`, async () => {
      const host = makeHost();
      const { t } = plugIn(host);
      await null;
      samples(host, t, id, own, true);
      const text = t.carriers.text(host.room, { ids: 'real' });
      const check = t.carriers.check(host.room, t.carriers.read(text));
      assert.ok(check.ok, check.reason);
      assert.deepEqual([check.changed, check.made, check.deleted], [0, 0, 0], `${id}: writing the room back over itself would change it`);
    }],
    [`${id}: the speed budgets hold on a 1,500-thought room`, async () => {
      const host = makeHost();
      const big = bigRoom(host);
      const slow = [];
      const [start, plugged] = ms(() => plugIn(host));
      await null;
      if (start > BUDGETS.start) slow.push(`starting took ${start.toFixed(1)} ms (budget ${BUDGETS.start})`);
      const { t } = plugged;
      host.choose(big, null);
      const thoughts = t.marks.in(big).filter((m) => m.kind === 'line');
      for (const { slot, item } of host.added(id)) {
        if (slot === 'world.ontologies') {
          const [took, rows] = ms(() => t.rules.layout(item.id, big));
          if (took > BUDGETS.layout) slow.push(`rule ${item.id} laid out the room in ${took.toFixed(1)} ms (budget ${BUDGETS.layout})`);
          if (thin(item) && rows.length < 1500) slow.push(`rule ${item.id} placed ${rows.length} of 1,500 thoughts`);
          const [drew] = ms(() => t.rules.draws(item.id, big));
          if (drew > BUDGETS.draw) slow.push(`rule ${item.id} drew its boxes in ${drew.toFixed(1)} ms (budget ${BUDGETS.draw})`);
        } else if (slot === 'world.decorators') {
          let worst = 0;
          const [all] = ms(() => { for (const m of thoughts) { const [one] = ms(() => item.decorate(m.text, m)); worst = Math.max(worst, one); } });
          if (all > BUDGETS.decorate) slow.push(`decorator ${item.id} took ${all.toFixed(1)} ms over the room (budget ${BUDGETS.decorate})`);
          if (worst > BUDGETS.decorateOne) slow.push(`decorator ${item.id} took ${worst.toFixed(2)} ms on one thought (budget ${BUDGETS.decorateOne})`);
        } else if (slot === 'room.strip') {
          const [took] = ms(() => item.text(big));
          if (took > BUDGETS.strip) slow.push(`strip ${item.id} took ${took.toFixed(1)} ms (budget ${BUDGETS.strip})`);
        }
      }
      assert.deepEqual(slow, [], `${id}: ${slow.join('; ')}`);
    }],
  ];
}
