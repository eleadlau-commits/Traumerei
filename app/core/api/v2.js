// The traumerei plugin API, version 2: the app named after the kernel's six primitives.
// app/core/KERNEL.md says what the six tables and eight laws are; app/core/API.md says this API
// in words; tests/api.test.js holds the list, so a change here is always deliberate (change
// API.md and the test with it).
//
// Version 1's flat names went in kernel phase 6: this is the one API. Phases 0 to 6 of the kernel plan: marks are a thin layer over the world as it is today
// (world/model.js); links, places, gaps and distance read their tables (world/links.js,
// places.js, gaps.js, distance.js) and moments the world's log (world/moments.js). Each read
// gives frozen rows; each propose goes through the world's own checks and lands as one step in
// the log (its rows are the moments), or returns a refusal with its reason in words. Where a table does not exist yet (forward
// moments) the read is empty and the propose refuses, naming the phase that brings it. Nothing
// here touches the screen.


export const API_VERSION = 3;
// The oldest version a plugin may be written for and still connect: version 3 only added to 2
// (the open core, 1.1.0), so a plugin written for 2 connects as it is.
export const OLDEST_API = 2;
export const TABLES = Object.freeze(['marks', 'places', 'links', 'distance', 'gaps', 'moments']);

// The readers a context can be declared for (KERNEL.md: distance).
export const READERS = Object.freeze(['me now', 'me later', 'others', 'machine']);
// The directions a gap can have (KERNEL.md: gaps).
export const DIRECTIONS = Object.freeze(['to world', 'from world', 'to maker']);
// The kinds of link there are (world/links.js says the same): part of, stands for, relation.
export const LINK_KINDS = Object.freeze(['part of', 'stands for', 'relation']);

import { aiFor } from './ai.js';
import { measure } from './measure.js';

const row = (o) => Object.freeze(o);
// A value copied and frozen all the way down (plain data: the rows' nested fields).
const sealed = (v) => (v && typeof v === 'object' ? Object.freeze(Array.isArray(v) ? v.map(sealed) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sealed(x)]))) : v);
const rows = (list) => Object.freeze(list.map(row));
const landed = (id) => row({ ok: true, id });
const refuse = (reason) => row({ ok: false, reason });
const later = (what, phase) => refuse(`${what} arrives in kernel phase ${phase}; until then this is a name, not a table`);
export const ARCHIVE = 'archive';
export const TOGETHER_CAP = 30000; // how long an async together() holds its step, at most (ms)

// ---- Six tables over the world as it is ----
// lib: the world's rules (world.lib); world: the world service (its .world is w). Pure of the
// screen; the tests call it with the same modules.
export function kernel({ lib, world, events = null, gone = () => {}, floors = null, linkKinds = () => [], spanKinds = null }) {
  const { model, groups, links: LINKS, places: PLACES_T } = lib; // (the links and places tables, world/links.js and places.js, reached as the world's rules are)
  const netFor = (rule) => lib.relations.netFor(rule);
  const declared = () => linkKinds() || [];
  let reads = null; // the read half, handed to a link kind's admit() (set once the tables are made)
  const w = () => world.world;
  const rules = () => (world.ontologies?.length ? world.ontologies.map((o) => o.id) : ['rows']);
  const lays = (rule) => !!world.ontologies?.find((o) => o.id === rule)?.lays;
  const thing = (id) => w().things[id] || null;
  const kindOf = (th) => model.kindOf(th);
  // A propose saves (one step); inside together(fn) the saves wait, and every change fn makes
  // lands as one step when it returns.
  let holding = 0, held = false;
  const save = () => { if (holding) held = true; else world.save?.(); };
  // Lets go of one hold; the last one lands what was held as one step. back: the step is taken
  // back at once (an async together that failed), when it is the last hold.
  const release = (back = false) => {
    if (--holding || !held) return;
    held = false;
    const seq = () => world.moments?.log?.seq, before = seq();
    const step = world.save?.();
    if (back && (before != null ? seq() !== before : step === true)) world.undo?.(true); // only a step that landed
  };
  // Since 1.1.1, fn may be async: the step stays open until its promise settles, then lands as one
  // step; a rejected promise takes the step back and resolves to { ok: false, reason }. After 30 s
  // the step lands with what it has (a warning says so). A plain fn that throws still lands what it did.
  const together = (fn) => {
    holding++;
    let out;
    try { out = fn(); } catch (err) { release(); throw err; }
    if (!out || typeof out.then !== 'function') { release(); return out; }
    let open = true;
    const timer = setTimeout(() => { if (!open) return; open = false; console.warn('together(): the step was held 30 s; it lands with what it has'); release(); }, TOGETHER_CAP);
    const done = (back) => { if (!open) return false; open = false; clearTimeout(timer); release(back); return true; };
    return Promise.resolve(out).then((v) => { done(false); return v; },
      (err) => { done(true); return refuse(err?.message || String(err || 'The step was taken back')); });
  };
  // The same hold, open across events (since 1.1.0): a surface's gesture, pointer down to pointer
  // up, is one step. Returns the function that lets go (once). Not in the API: the room calls it
  // through the surface (surfaceFor), never a plugin.
  const hold = () => {
    holding++;
    let open = true;
    return () => { if (!open) return; open = false; if (!--holding && held) { held = false; world.save?.(); } };
  };

  // A propose lands as one saved step and says so, or says why not.
  const land = (ok, id, why) => { if (!ok) return refuse(why); save(); return landed(id); };

  // Changes to a table are heard from the moments log ('world:moments': the rows that landed):
  // a listener is told once per landing with the rows of its table, and whether it was an undo.
  // Without a log (an older world service) every save and undo is heard instead.
  const on = (table) => (fn) => {
    if (!events) return () => {};
    const tell = (data) => {
      if (!data?.rows) { fn(row({ table, rows: rows([]), undone: !!data?.undone })); return; }
      const mine = data.rows.filter((r) => r.table === table || (table === 'moments' && r.kind !== undefined));
      if (mine.length) fn(row({ table, rows: rows(mine.map((r) => ({ ...r }))), undone: !!data.undone }));
    };
    const offs = world.moments ? [events.on('world:moments', tell)] : [events.on('world:saved', tell), events.on('world:changed', tell)];
    const off = () => { for (const o of offs) o(); };
    gone(off);
    return off;
  };

  // -- marks: today, a mark row is a thought object, frozen (its shape: world/model.js). --
  // A room's row says the mode it is seen through (`mode`), read from its view (since 1.0.3).
  // Every field is a copy, frozen all the way down (a kind's strokes, a thought's spans): a row can
  // never be a way to change the world (since API 3).
  const markRow = (th) => {
    const out = {};
    for (const k in th) out[k] = sealed(th[k]);
    if (kindOf(th) === 'room') out.mode = w().views?.[th.id]?.mode || model.DEFAULT_MODE;
    return out;
  };
  const marks = Object.freeze({
    get: (id) => (thing(id) ? row(markRow(thing(id))) : null),
    in: (context) => rows(model.children(w(), context ?? null).map(markRow)),
    ofKind: (kind) => rows(Object.values(w().things).filter((th) => kindOf(th) === kind).map(markRow)),
    text: (id) => (thing(id) ? model.thoughtText(w(), thing(id)) : ''),
    // Its words with their spans written as Markdown (a kind of span that says how: bold as **…**).
    markdown: (id) => { const th = thing(id); if (!th) return ''; const text = model.thoughtText(w(), th); return th.spans ? lib.spans.markdown(text, th.spans, spanKinds?.()) : text; },
    search: (words, most) => rows(model.search(w(), words, most).map(markRow)),
    // The thought being written in a context (since 1.1.1), for a rule's arrange to leave room for
    // it: { text, at?, after?, height? }, frozen, or null. Never a mark, never saved.
    draft: (context) => lib.draft?.of(context) ?? null,
    make: ({ kind = 'line', content = '', in: context = null, at = {} } = {}) => {
      if (context == null && kind !== 'room') return refuse('A mark needs a context to be made in');
      const made = kind === 'room'
        ? model.addRoom(w(), content, undefined, at)
        : model.create(w(), context, { title: at.title, x: at.x, y: at.y, ...(content && typeof content === 'object' ? content : { text: content }), kind }); // words, or a kind's own fields
      return land(!!made, made?.id, 'The context is locked, cannot hold this kind, or the mark would be empty');
    },
    edit: (id, fields = {}) => {
      if (!thing(id)) return refuse('No such mark');
      if (['kind', 'parent', 'members', 'id'].some((k) => k in fields)) return refuse('A mark\'s kind, context, members and id change only through places and links');
      if (model.update(w(), id, fields)) return land(true, id);
      if (!thing(id)) { save(); return row({ ok: true, id, removed: true }); } // left empty, so it went (Law 2: by the maker's hand)
      return refuse('The mark is locked');
    },
    delete: (id) => {
      if (!thing(id)) return refuse('No such mark');
      if (id === model.MESSY) return refuse('Messy thoughts stays');
      model.remove(w(), id);
      return land(!thing(id), id, 'The mark is locked');
    },
    on: on('marks'),
  });

  // -- places: where a mark sits in a context, under a rule. No row in a context: loose there. --
  function placesOf(id) {
    const th = thing(id);
    if (!th) return [];
    // The table's own rows: the home row (rule null: the context the mark is in), then where each
    // rule put it there (phase 4: the rules keep nothing else). A mark held by a rule's group (a
    // train, a chapter) with no row of that rule is placed by the group: { group, index }, read
    // off the part-of links, never stored.
    const out = PLACES_T.of(w(), id).sort((a, b) => (a.rule != null) - (b.rule != null))
      .map((r) => ({ mark: r.mark, context: r.context, rule: r.rule ?? null, position: r.position ?? null, ...(r.pinned ? { pinned: true } : {}) }));
    const context = PLACES_T.home(w(), id);
    if (context == null || kindOf(th) === 'room') return out;
    for (const rule of rules()) {
      if (rule === 'tray' || out.some((p) => p.rule === rule && p.context === context)) continue;
      const g = model.groupOf(w(), id, rule);
      if (g) out.push({ mark: id, context, rule, position: { group: g.id, index: model.members(w(), g.id).findIndex((m) => m.id === id) } });
    }
    return out;
  }
  const places = Object.freeze({
    of: (mark) => rows(placesOf(mark)),
    in: (context, rule = null) => rows(model.children(w(), context).flatMap((th) => placesOf(th.id).filter((p) => p.context === context && (rule == null || p.rule === rule)))),
    // Loose in a context: at home there, with no rule placing it (Law 2: never lost, only unplaced).
    loose: (context) => rows(model.children(w(), context).filter((th) => !placesOf(th.id).some((p) => p.context === context && p.rule != null && p.rule !== 'tray')).map((th) => ({ ...th }))),
    home: (mark) => PLACES_T.home(w(), mark),
    position: (mark, context, rule) => placesOf(mark).find((p) => p.context === context && p.rule === rule)?.position ?? null,
    put: (mark, context, rule = null, position = null) => {
      const th = thing(mark);
      if (!th || !thing(context)) return refuse('No such mark or context');
      if (kindOf(th) === 'room') { // a room goes to a floor (no cell yet: the rooms page gives it one) or the Archive
        if (context === ARCHIVE) return land(model.archive(w(), mark), mark, 'Messy thoughts, a locked room, a Twin\'s side or an archived room cannot be archived');
        if (!model.isFloor(context)) return refuse('A room sits on a floor or in the Archive');
        if (model.isArchived(w(), mark)) model.restore(w(), mark);
        const page = +context.slice(6);
        // With a cell ({ col, row } or { x, y }): exactly there by the floor rule (on the board,
        // free), or refused; a room from another floor comes to this one. Without, the floor only.
        const col = position?.col ?? position?.x, row = position?.row ?? position?.y;
        if (Number.isFinite(col) && Number.isFinite(row) && floors) {
          const at = { col: Math.round(col), row: Math.round(row) };
          const done = model.floorOf(w(), mark) === page ? floors.move(mark, at.col, at.row) : floors.toFloor(mark, page, at) === true;
          return land(done, mark, 'The room cannot go to that cell: it is off the board, taken, or the room is locked');
        }
        return land(model.toPage(w(), mark, +context.slice(6)), mark, 'The room cannot go to that floor');
      }
      if (PLACES_T.home(w(), mark) !== context && !model.move(w(), mark, context, position?.x ?? 0, position?.y ?? 0, { loose: rule == null })) return refuse('The mark cannot go into that context: one of them is locked, or it would go inside itself');
      if (rule && position && Number.isFinite(position.x)) {
        if (!groups.putAt(w(), context, rule, mark, position.x, position.y)) return refuse('The context is locked');
      }
      return land(true, mark);
    },
    move: (mark, from, to) => {
      const th = thing(mark);
      if (!th || PLACES_T.home(w(), mark) !== from) return refuse('The mark is not in that context');
      return land(groups.moveLoose(w(), mark, to), mark, 'The mark cannot go to that context: it is locked, missing, or a Twin itself');
    },
    unplace: (mark, context) => {
      const th = thing(mark);
      if (!th || PLACES_T.home(w(), mark) !== context) return refuse('The mark is not in that context');
      let any = false;
      for (const rule of rules()) any = groups.unplace(w(), context, rule, mark, { lays: lays(rule) }) || any;
      return land(any || groups.wait(w(), context, mark), mark, 'The context is locked');
    },
    on: on('places'),
  });

  // -- links: the links table itself (world/links.js). part of: a member to its group, `order`
  // as the group reads (a train by time, a rule that keeps its order as given). stands for: a
  // fold to each mark it folded away. relation: a child to its parent under a rule's arrows, with
  // `label` the relation's name and `note` the arrow's words. --
  const asRead = (r) => { // a part-of row's order, as the group reads
    if (r.kind !== 'part of') return { ...r };
    const i = model.members(w(), r.to).findIndex((th) => th.id === r.from);
    return { ...r, order: i < 0 ? r.order : i };
  };
  const roomOf = (id) => { const th = thing(id); return th ? (kindOf(th) === 'room' ? th.id : model.parentOf(w(), id)) : null; };
  const links = Object.freeze({
    get: (id) => { const r = LINKS.get(w(), id); return r ? row(asRead(r)) : null; },
    from: (mark, kind = null) => rows(LINKS.from(w(), mark, kind).map(asRead)),
    to: (mark, kind = null) => rows(LINKS.to(w(), mark, kind).map(asRead).sort((a, b) => a.order - b.order)),
    members: (group) => Object.freeze(model.members(w(), group).map((th) => th.id)),
    holders: (mark) => Object.freeze(model.groupsOf(w(), mark).map((g) => g.id)),
    standsFor: (mark) => Object.freeze(LINKS.from(w(), mark, 'stands for').map((r) => r.to)), // the marks a fold stands for
    kinds: () => Object.freeze([...LINK_KINDS, ...declared().map((k) => k.kind).filter((k) => !LINK_KINDS.includes(k))]),
    named: (kind) => { const k = declared().find((d) => d.kind === kind); return k ? row({ kind: k.kind, name: k.name || k.kind, note: k.note || '', both: !!k.both, quiet: !!k.quiet }) : LINK_KINDS.includes(kind) ? row({ kind, name: kind, note: '', both: false, quiet: false }) : null; },
    count: () => LINKS.count(w()),
    // kind 'relation' takes the rule whose arrows these are (`rule`: 'russell', 'proust-links') and
    // goes through that rule's own checks (Russell refuses a loop, Law 3); label is the relation's
    // name (left out: the room's first), note the arrow's words.
    link: (from, to, kind, label = null, { rule = null, note = '', at = null } = {}) => {
      if (kind === 'part of') {
        if (!model.isGroup(thing(to))) return refuse('Only a group can hold a part');
        if (at != null && !(Number.isInteger(at) && at >= 0)) return refuse('A part joins at a position in the order: 0 first');
        return land(model.join(w(), to, from, at), LINKS.partId(to, from), 'The part cannot join: it is in another context, locked, or would hold its own group');
      }
      if (kind === 'relation') {
        const net = rule && netFor(rule);
        if (!net) return refuse(rule ? `No rule draws relations as ${rule}` : 'A relation needs the rule whose arrows these are: link(from, to, \'relation\', label, { rule })');
        const r = roomOf(from);
        if (r == null || roomOf(to) !== r) return refuse('A relation joins two marks of one context');
        const why = net.link(w(), r, to, from, note, label == null ? undefined : label);
        return land(!why, LINKS.relId(rule, from, to), why);
      }
      if (kind === 'stands for') return refuse('A mark comes to stand for others by folding them: links.fold(context, ids)');
      // A plugin's kind (slots.linkKinds): any two marks, across rooms too, once each way; the
      // kind's own admit() may refuse; a kind that reads both ways (`both`) is one row either way.
      const k = declared().find((d) => d.kind === kind);
      if (!k) return refuse(`No such kind of link: ${kind}. A plugin declares one with slots.linkKinds.add({ kind, name })`);
      if (!thing(from) || !thing(to)) return refuse('Both ends must be marks there are');
      if (from === to) return refuse('A mark does not link to itself');
      if (model.shut(w(), roomOf(from))) return refuse('The context is locked');
      const id = LINKS.kindId(kind, from, to);
      if (LINKS.get(w(), id) || (k.both && LINKS.get(w(), LINKS.kindId(kind, to, from)))) return refuse(`These two are already linked as ${k.name || kind}`);
      const why = k.admit?.(from, to, reads);
      if (why && why !== true) return refuse(typeof why === 'string' ? why : why.reason || `${k.name || kind} refuses this link`);
      const fields = { from, to, kind };
      if (label) fields.label = String(label);
      if (note) fields.note = String(note);
      LINKS.set(w(), id, fields);
      return land(true, id);
    },
    // Many marks fold into one new mark that stands for them and takes their place in every group.
    fold: (context, ids) => {
      if (!thing(context)) return refuse('No such context');
      const made = groups.fold(w(), context, Array.isArray(ids) ? ids : []);
      return land(!made.why, made.id, made.why || 'Nothing here to fold');
    },
    unlink: (id) => {
      const r = LINKS.get(w(), String(id));
      if (!r) return refuse('No such link');
      if (r.kind === 'part of') return land(model.leave(w(), r.to, r.from), id, 'Not a part of that group');
      if (r.kind === 'relation') {
        const net = netFor(r.rule);
        if (!net) return refuse(`No rule draws relations as ${r.rule}`);
        return land(net.unlink(w(), roomOf(r.from), r.to, r.from), id, 'The context is locked');
      }
      if (r.kind !== 'stands for') { // a plugin's kind: the row goes, the marks stay
        if (model.shut(w(), roomOf(r.from))) return refuse('The context is locked');
        LINKS.drop(w(), r.id);
        return land(true, id);
      }
      // stands for: the fold no longer stands for this mark, which comes back loose in its context
      if (model.shut(w(), r.to)) return refuse('The context is locked');
      LINKS.drop(w(), r.id);
      return land(true, id);
    },
    order: (group, ids) => land(model.setOrder(w(), group, ids), group, 'Not a group, or not its parts'),
    on: on('links'),
  });

  // -- distance: the distance table (world/distance.js). A context is declared for a reader; a
  // mark's reader is the farthest on its way up (Law 7: inherited, lengthened only by a hand).
  // Lock is a room declared for others; a context for others or a machine is shut. --
  const DIST = lib.distance;
  const distance = Object.freeze({
    of: (mark) => (thing(mark) ? DIST.of(w(), mark) : null),
    declared: (context) => (thing(context) ? DIST.declared(w(), context) : null),
    all: () => rows(DIST.all(w()).map(({ context, reader }) => ({ context, reader }))),
    shut: (mark) => !!thing(mark) && model.shut(w(), mark),
    readers: () => READERS,
    declare: (context, reader) => {
      if (!READERS.includes(reader)) return refuse(`A reader is one of ${READERS.join(', ')}`);
      if (!model.declarable(w(), context)) return refuse('Only a context is declared for a reader: a room, a floor, the Archive');
      if (DIST.declared(w(), context) === reader || (reader === DIST.NEAREST && !DIST.declared(w(), context))) return landed(DIST.idOf(context));
      return land(!DIST.declare(w(), context, reader).why, DIST.idOf(context), 'No such reader');
    },
    on: on('distance'),
  });

  // -- gaps: the gaps table (world/gaps.js). One row per mark at most (Law 5), open or resolved;
  // a mark whose parts (part of, or a relation up to it) carry gaps reads a derived gap, open
  // while any part's is, which no propose can open or resolve directly: its parts are the way. --
  const GAPS = lib.gaps;
  const gapOf = (mark) => { const r = thing(mark) ? GAPS.of(w(), mark) : null; return r ? row(r) : null; };
  const partsOpen = (mark) => { const p = GAPS.progress(w(), mark); return p.open ? `${p.open} of ${p.of} parts still open` : null; };
  const gaps = Object.freeze({
    of: gapOf,
    opened: (context = null) => rows(context == null || thing(context) ? GAPS.opened(w(), context) : []),
    oldest: (context = null) => { const r = context == null || thing(context) ? GAPS.oldest(w(), context) : null; return r ? row(r) : null; },
    progress: (mark) => row(GAPS.progress(w(), mark)),
    open: (mark, direction) => {
      if (!DIRECTIONS.includes(direction)) return refuse(`A direction is one of ${DIRECTIONS.join(', ')}`);
      if (!thing(mark)) return refuse('No such mark');
      if (model.shut(w(), mark)) return refuse('The mark is locked');
      if (GAPS.derived(w(), mark)) return refuse('This mark\'s gap is derived from its parts: open a gap on a part');
      const r = GAPS.open(w(), mark, direction);
      return land(!r.why, r.id, r.why);
    },
    resolve: (mark, by = GAPS.JUDGEMENT) => {
      if (!thing(mark)) return refuse('No such mark');
      if (model.shut(w(), mark)) return refuse('The mark is locked');
      if (GAPS.derived(w(), mark)) return refuse(partsOpen(mark) || 'Resolved already: every part of it is');
      const r = GAPS.resolve(w(), mark, by == null ? GAPS.JUDGEMENT : String(by));
      return land(!r.why, r.id, r.why);
    },
    reopen: (mark) => {
      if (!thing(mark)) return refuse('No such mark');
      if (model.shut(w(), mark)) return refuse('The mark is locked');
      if (GAPS.derived(w(), mark)) return refuse(partsOpen(mark) ? 'The gap is open: a part of it is' : 'This mark\'s gap is derived from its parts: open one of theirs again');
      const r = GAPS.reopen(w(), mark);
      return land(!r.why, r.id, r.why);
    },
    on: on('gaps'),
  });

  // -- moments: the log (world/moments.js), read by mark, from a time, by day. A mark the log does
  // not know of (older than the history kept) still has its made and edited times. --
  const log = () => world.moments;
  const momentRow = (r) => ({ time: r.time, kind: r.kind === 'told' ? r.said : r.kind, ...(r.mark != null ? { mark: r.mark } : r.link != null ? { link: r.link } : r.place != null ? { place: r.place } : r.gap != null ? { gap: r.gap } : r.dist != null ? { dist: r.dist } : { context: r.context }), ...(r.step != null ? { step: r.step } : {}),
    ...(r.before !== undefined ? { before: sealed(r.before) } : {}), ...(r.after !== undefined ? { after: sealed(r.after) } : {}) }); // what it was and became (since 1.1.1; compacted rows have none)
  function fallback(th) {
    const out = [{ time: th.at, kind: 'made', mark: th.id }];
    if (th.edited) out.push({ time: th.edited, kind: 'edited', mark: th.id });
    if (!log() && kindOf(th) === 'room') for (const t of world.attention?.[th.id] || []) out.push({ time: t, kind: 'visited', context: th.id });
    return out;
  }
  const byTime = (a, b) => a.time - b.time || (a.seq || 0) - (b.seq || 0);
  function momentsOf(id) {
    const th = thing(id);
    const known = log() ? log().of(id).map(momentRow) : [];
    if (!th) return known;
    return known.some((m) => m.kind === 'made') ? known : [...fallback(th).filter((m) => !known.length || m.kind === 'made'), ...known];
  }
  const all = () => (log() ? log().since(0).map(momentRow) : Object.values(w().things).flatMap(fallback)).sort(byTime);
  const AHEAD = lib.ahead;
  const ask = (mark, kind, o) => {
    if (!thing(mark)) return refuse('No such mark');
    if (model.shut(w(), mark)) return refuse('The mark is locked');
    if (o.at != null && !Number.isFinite(o.at)) return refuse('A time to come back at is needed');
    const r = AHEAD.ask(w(), mark, kind, { ...o, note: typeof o.note === 'string' ? o.note : '' });
    return land(!r.why, r.id, r.why);
  };
  const answer = (mark, how) => { if (!thing(mark)) return refuse('No such mark'); const r = AHEAD.answer(w(), mark, how); return land(!r.why, r.id, r.why); };
  const moments = Object.freeze({
    of: (mark) => rows(momentsOf(mark).sort(byTime)),
    since: (time) => rows(all().filter((m) => m.time >= +time)),
    day: (date) => {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = start.getTime() + 24 * 3600e3;
      return rows(all().filter((m) => m.time >= start.getTime() && m.time < end));
    },
    changed: (mark) => log()?.changed(mark) ?? (thing(mark) ? thing(mark).edited || thing(mark).at : null), // when a mark was last written
    at: (time) => { const s = log()?.at(time); return rows(Object.values((s || w()).things)); }, // the marks as they were then
    placesAt: (time) => { const s = log()?.at(time); return rows(Object.values((s || w()).places || {})); }, // and where they were
    first: () => log()?.first() ?? null, // the first time the log knows of
    kept: () => log()?.keep ?? 0,        // days of history kept (0: forever)
    keep: (days) => { if (!log()) return later('Keeping history', 1); if (![0, 30, 365].includes(days) && !(Number.isInteger(days) && days > 0)) return refuse('Days kept is a whole number, 0 for forever'); log().setKeep(days); return landed('moments'); },
    // For a carrier (the account's sync; carriers proper are phase 6): the latest seq, the rows
    // since a seq as another copy can take them (null: the whole world), and rows from another
    // copy taken in (the latest word on a thing wins).
    seq: () => log()?.log.seq ?? 0,
    outbox: (seq) => (log() ? rows(log().outbox(seq)) : rows([])),
    absorb: (list) => { if (!log()) return later('Taking in moments', 1); if (!Array.isArray(list)) return refuse('Rows to take in are a list'); const landed = log().absorb(list.map((r) => ({ ...r }))); return row({ ok: true, id: 'moments', landed: landed.length }); },
    // Moments ahead (world/ahead.js, phase 7): what is still to come, soonest first; what came
    // back and waits in the Returns tray; asking for a mark to come back (due by a time, to
    // revisit at a time, a note for the next visit), answering it (met or refused, each a
    // moment in the record) and taking it back.
    ahead: (context = null) => rows(context == null || thing(context) ? AHEAD.waiting(w(), context) : []),
    returns: (context = null) => rows(context == null || thing(context) ? AHEAD.back(w(), context) : []),
    next: (mark) => { const r = thing(mark) ? AHEAD.get(w(), mark) : null; return r ? row(r) : null; },
    due: (mark, time, note = '') => ask(mark, 'due', { at: +time, note }),
    revisit: (mark, time, note = '') => ask(mark, 'revisit', { at: +time, note }),
    note: (mark, text) => ask(mark, 'return', { note: text }),
    meet: (mark) => answer(mark, 'met'),
    refuse: (mark) => answer(mark, 'refused'),
    clear: (mark) => { if (!thing(mark)) return refuse('No such mark'); const r = AHEAD.clear(w(), mark); return land(!r.why, r.id, r.why); },
    on: on('moments'),
  });

  // -- carriers: the six tables out and back in (world/tables.js, traum.js; Law 8). A context's
  // tables, the same as .traum text, text read back, and read text landed as new marks or written
  // over the room or group it was taken from. No plugin is needed for any of it. --
  const deep = (v) => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) deep(v[k]); Object.freeze(v); } return v; };
  const C = () => world.carriers;
  const scopeOk = (context) => context == null || !!thing(context);
  // What writing `got` over a context would do, tried on a copy: counts of marks kept, changed,
  // made and deleted, or the reason it would be refused.
  function check(context, got) {
    if (!got?.tables) return row({ ok: false, reason: 'Not a traum/3 text' });
    const copy = lib.model.loadWorld(JSON.parse(JSON.stringify(w())));
    // compared with keys in order, so a field written back in another order is not a change
    const same = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
    const before = new Map(lib.model.tablesOf(copy, context).marks.map((m) => [m.id, same(m)]));
    const out = lib.model.replaceTables(copy, context, got.tables, got.root);
    if (out.why) return row({ ok: false, reason: out.why });
    const after = lib.model.tablesOf(copy, context).marks;
    const n = { ok: true, kept: 0, changed: 0, made: 0, deleted: 0 };
    for (const m of after) { if (!before.has(m.id)) n.made++; else if (before.get(m.id) === same(m)) n.kept++; else n.changed++; }
    n.deleted = [...before.keys()].filter((id) => !after.some((m) => m.id === id)).length;
    return row(n);
  }
  const carriers = Object.freeze({
    list: () => rows((C()?.list() || []).map(({ id, name, moves }) => ({ id, name, moves }))),
    tables: (context = null) => (scopeOk(context) && C() ? deep(C().tables(context)) : null),
    text: (context = null, { ids = 'short' } = {}) => (scopeOk(context) && C() ? C().write(context, { ids }) : ''),
    read: (text) => { const got = C()?.read(text); return got ? deep(got) : null; },
    check,
    // A read text as new marks: a new room on floor `page` (in `cell` if it is free), or poured
    // `into` a room. One step.
    land: (got, { into = null, page = 0, cell = null } = {}) => {
      if (!got?.tables || !C()) return refuse('Not a traum/3 text');
      const out = C().land(JSON.parse(JSON.stringify(got)), { into, page });
      if (out.why) return refuse(out.why);
      if (into == null) floors?.place(out.id, cell);
      return land(true, out.id);
    },
    replace: (context, got) => {
      if (!got?.tables || !C()) return refuse('Not a traum/3 text');
      if (!thing(context)) return refuse('No such room or group');
      const out = C().replace(context, JSON.parse(JSON.stringify(got)));
      return land(!out.why, context, out.why);
    },
  });

  // -- rules: every mode as the kernel sees it (world/rules.js). Pure reads of the tables: where
  // each unit sits under a rule, whether it would take a position or a link (a refusal in words),
  // what it offers for a chosen mark, and what it draws beside the marks. No rule keeps state.
  const ontology = (id) => world.ontologies?.find((o) => o.id === id) || null;
  const ruleNs = Object.freeze({
    list: () => rows((world.ontologies || []).map((o) => ({ id: o.id, name: o.name }))),
    layout: (rule, context) => {
      const o = ontology(rule);
      return rows(o ? [...lib.rules.layout(o, w(), context)].map(([mark, p]) => ({ mark, context, rule, position: Object.freeze({ x: p.x, y: p.y }),
        ...(p.width ? { width: p.width } : {}), ...(p.height ? { height: p.height } : {}),
        ...(p.fragments ? { fragments: Object.freeze(p.fragments.map((f) => Object.freeze({ x: f.x, y: f.y, width: f.width, height: f.height, lines: f.lines }))) } : {}),
        ...(p.bands ? { bands: Object.freeze({ ...p.bands }) } : {}) })) : []);
    },
    admit: (rule, proposal) => { const o = ontology(rule); return row(o ? { ...lib.rules.admit(o, w(), { ...(proposal || {}) }) } : { ok: false, reason: 'No such rule' }); },
    moves: (rule, context, mark) => { const o = ontology(rule); return rows(o ? lib.rules.moves(o, w(), context, mark) : []); },
    draws: (rule, context) => {
      const o = ontology(rule), d = o ? lib.rules.draws(o, w(), context) : { lines: [], arrows: [], boxes: [] };
      return row({ lines: Object.freeze(d.lines.map((l) => Object.freeze([...l]))), arrows: rows(d.arrows), boxes: rows(d.boxes || []) });
    },
  });

  reads = readsOf({ marks, places, links, distance, gaps, moments });
  const api = Object.freeze({ marks, places, links, distance, gaps, moments, rules: ruleNs, carriers, together });
  HOLDS.set(api, hold);
  return api;
}

// Each kernel's open hold (kernel: hold), kept out of the API itself.
const HOLDS = new WeakMap();

// The read half of the tables: what a rule's arrange(), a link kind's admit() and a view are handed.
export const READS = Object.freeze({
  marks: ['get', 'in', 'ofKind', 'text', 'search', 'draft'],
  places: ['of', 'home', 'in', 'loose', 'position'],
  links: ['get', 'from', 'to', 'members', 'holders', 'standsFor', 'kinds', 'named', 'count'],
  distance: ['of', 'declared', 'all', 'shut', 'readers'],
  gaps: ['of', 'opened', 'oldest', 'progress'],
  moments: ['of', 'changed', 'ahead', 'returns', 'next'],
});
function readsOf(tables) {
  return Object.freeze(Object.fromEntries(Object.entries(READS).map(([ns, names]) => [ns, Object.freeze(Object.fromEntries(names.map((n) => [n, tables[ns][n]])))])));
}
// The reads over a world handed in (a rule reads the world its layout is handed, which may be a
// frozen one, or the world as it was at a moment of the scrub). One per world.
const OVER = new WeakMap();
export function readsOver(lib, w, ontologies = null) {
  let r = OVER.get(w);
  if (!r) OVER.set(w, (r = readsOf(kernel({ lib, world: { world: w, lib, ontologies } }))));
  return r;
}

// A simple rule (API.md, Rules): { id, name, note?, icon?, order?, arrange(reads, context) →
// [{ mark, x, y }] , hand? }. It reads only the tables and says where each mark of the context
// sits; the kernel makes it a full mode: its units are the context's marks (a group as one), a
// mark dragged keeps where it was put (a rule row of places) unless hand is false, a mark
// arrange() leaves out sits in a row below the rest. Remembered until the tables it reads change.
// Three optional hooks widen it, each still pure (it reads, and says what it wants as data):
//   draw(reads, context) → [{ x, y, w, h, label?, note? }]   boxes the room draws behind the marks
//   drop(reads, context, mark, x, y) → proposal(s)           a mark let go at x, y
//   land(reads, context, mark, x, y) → proposal(s)           a new mark written at x, y (a chosen box)
// A proposal is about the mark (or p.mark in the same context): { due: time, note? },
// { revisit: time, note? }, { clear: true } (moments ahead), { gap: direction }, { resolve: true }
// (gaps). The kernel lands each through the tables inside the room's step; a refused one is skipped.
// Since 1.0.3 also { place: context, x?, y? } (places.put: into another context of the rooms,
// a chapter's room say; with x, y it lands there under that room's mode). Since 1.1.1
// { join: group, at?, from? } (links.link(mark, group, 'part of', null, { at }): into a group of
// the same room, a book's chapter, at a place in its order; leaving the group `from` in the same step).
export const PROPOSALS = Object.freeze(['due', 'revisit', 'clear', 'gap', 'resolve', 'place', 'join']);
// What a box may say of its look (the room's classes, room/style.css): style, level 1-3, and words on its right.
// A surface's id (since 1.1.0): lowercase words joined by dashes or dots ('sketch', 'chart.bars').
export const SURFACE_ID = /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/;
export const SURFACE_HOOKS = Object.freeze(['draw', 'pointer', 'wheel', 'key', 'focus', 'blur', 'leave']);

// A plugin's surface as the room's slot holds it (room/surface.js): checked, its hooks only, and
// hold() for the room to bracket a gesture so the plugin's proposes in it land as one step.
// needs: the plugin block's needs (a surface needs 'surface').
export function surfaceFor(s, hold, needs = []) {
  if (![].concat(needs || []).includes('surface')) throw new Error('A surface needs "surface" in the plugin block\'s needs');
  if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !SURFACE_ID.test(s.id)) throw new Error('A surface needs an id: lowercase words joined by dashes or dots');
  if (typeof s.draw !== 'function') throw new Error(`Surface ${s.id} needs draw(el, ctx)`);
  const size = (v) => (Number.isFinite(v) && v > 0 ? Math.min(v, 4000) : undefined);
  const out = { id: s.id, width: size(s.width), height: size(s.height), hold: () => (hold ? hold() : () => {}) };
  for (const k of SURFACE_HOOKS) if (typeof s[k] === 'function') out[k] = s[k];
  return Object.freeze(out);
}

// What a box hands its surface (since 1.1.0): plain data (a JSON copy, deep frozen), at most
// 64 KB written out; anything else is left out.
function boxData(data) {
  if (data === undefined) return {};
  try {
    const text = JSON.stringify(data);
    if (text === undefined || text.length > 65536) return {};
    const freeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) freeze(v); } return o; };
    return { data: freeze(JSON.parse(text)) };
  } catch { return {}; }
}

export const BOX_STYLES = Object.freeze(['plain', 'title', 'heading', 'line', 'shelf', 'quiet', 'page']);
// A thin rule's settings, each in the core's own shape (ontologies/index.js): sliders, switches,
// choices and lists as they are; since 1.1.1 also { kind: 'choice', id, name, options: [{ id, name }],
// default } and { kind: 'toggle', id, name, default }. One without a key is left out.
export function ruleSettings(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const st of list) {
    if (!st || typeof st !== 'object') continue;
    if (st.kind === 'choice') {
      const options = (Array.isArray(st.options) ? st.options : []).filter((o) => o && o.id != null).map((o) => [o.id, String(o.name ?? o.id)]);
      if (typeof st.id !== 'string' || !options.length) continue;
      out.push({ key: st.id, label: String(st.name || st.id), type: 'choice', options, default: options.some(([v]) => v === st.default) ? st.default : options[0][0] });
    } else if (st.kind === 'toggle') {
      if (typeof st.id !== 'string') continue;
      out.push({ key: st.id, label: String(st.name || st.id), type: 'switch', default: !!st.default });
    } else if (typeof st.key === 'string') out.push(st);
  }
  return out;
}

export function simpleRule(rule, lib, ontologies = () => null, globals = () => null) {
  const { model, groups, gaps: G, rules: R } = lib;
  const stampOf = (w) => `${G.version(w)}|${JSON.stringify(w.ahead || {})}`;
  const said = (fn, w, ...args) => { try { return fn(readsOver(lib, w, ontologies()), ...args); } catch (err) { console.warn(`Rule ${rule.id}: ${fn.name || 'a hook'} failed`, err); return null; } };
  // Lands what drop() or land() proposed for `mark`; returns the reasons of those refused.
  const propose = (w, room, mark, out) => {
    const why = [];
    for (const p of (Array.isArray(out) ? out : [out]).filter((p) => p && typeof p === 'object')) {
      const id = p.mark ?? mark;
      let r = null;
      if (!w.things[id] || model.parentOf(w, id) !== room) r = { why: 'Not a mark of this room' };
      else if (model.shut(w, id)) r = { why: 'The mark is locked' };
      else if (p.due != null || p.revisit != null) r = lib.ahead.ask(w, id, p.due != null ? 'due' : 'revisit', { at: +(p.due ?? p.revisit), note: typeof p.note === 'string' ? p.note : '' });
      else if (p.clear) r = lib.ahead.get(w, id) ? lib.ahead.clear(w, id) : null;
      else if (p.gap) r = G.open(w, id, p.gap);
      else if (p.resolve) r = G.resolve(w, id);
      else if (p.place != null) r = placeIn(w, id, String(p.place), p.x, p.y);
      else if (p.join != null) r = joinTo(w, room, id, String(p.join), p.at, p.from == null ? null : String(p.from));
      else r = { why: `A proposal is one of ${PROPOSALS.join(', ')}` };
      if (r?.why) why.push(r.why);
    }
    return why;
  };
  // A { place } proposal: the mark goes into another room (loose there, or at x, y under that
  // room's mode when given), as places.put would put it.
  const placeIn = (w, id, context, x, y) => {
    const to = w.things[context];
    if (!to || model.kindOf(to) !== 'room') return { why: 'A mark is placed into a room' };
    if (context === model.parentOf(w, id)) return null;
    if (model.shut(w, context)) return { why: 'That room is locked' };
    const at = Number.isFinite(x) && Number.isFinite(y);
    if (!model.move(w, id, context, at ? x : 0, at ? y : 0, { loose: !at })) return { why: 'The mark cannot go into that room' };
    if (at) { const mode = model.view(w, context).mode; groups.putAt(w, context, mode, id, x, y); }
    return null;
  };
  // A { join } proposal (since 1.1.1): the mark becomes a part of a group of the same room, at
  // `at` in its order (0 first; left out, where the group puts a newcomer), as links.link would
  // join it: the group's own family says whether it may sit in another group of the family too.
  // A mark already a part of it moves to `at` (counted among the other parts). With `from` (since
  // 1.1.1), a group of the same room the mark leaves in the same step: a drop from one chapter into
  // another moves it rather than copying it (a family's membership is many).
  const joinTo = (w, room, id, group, at, from = null) => {
    const g = w.things[group];
    if (!g || !model.isGroup(g)) return { why: 'Only a group can hold a part' };
    if (model.parentOf(w, group) !== room) return { why: 'A mark joins a group of its own room' };
    if (model.shut(w, group)) return { why: 'The group is locked' };
    if (at != null && !(Number.isInteger(at) && at >= 0)) return { why: 'A part joins at a position in the order: 0 first' };
    if (from != null && from !== group) {
      const f = w.things[from];
      if (!f || !model.isGroup(f) || model.parentOf(w, from) !== room) return { why: 'A mark leaves a group of its own room' };
      if (model.shut(w, from)) return { why: 'The group it leaves is locked' };
      if (!model.members(w, from).some((m) => m.id === id)) return { why: 'The mark is not a part of the group it would leave' };
    }
    const ms = model.members(w, group);
    if (ms.some((m) => m.id === id)) { if (ms.length === 1) return null; model.leave(w, group, id); }
    if (!model.join(w, group, id, at ?? null)) return { why: 'The part cannot join: it would hold its own group' };
    if (from != null && from !== group && model.members(w, from).some((m) => m.id === id)) model.leave(w, from, id);
    return null;
  };
  // A rule's memo key: the room's places, the floor's (a contents page of the floor's rooms
  // redraws when they move), every link, every mark, the gaps and the moments ahead.
  // Since 1.1.1 also the rule's settings for new rooms and the room's own (a value changed in its ⚙
  // lays it out again: the ⚙ writes it without a new version of the marks), and (for a rule whose arrange read it) the
  // draft's: whether a thought is being written, and its box's height.
  const memo = new WeakMap(); // w → Map context → { stamp, key, map, usesDraft }
  const keyOf = (w, room) => `${lib.places.version(w, room)}|${lib.places.version(w, lib.places.home(w, room))}|${lib.links.version(w)}|${model.marksVersion(w)}|${stampOf(w)}`
    + (settingsList.length ? `|${JSON.stringify(globals()?.[rule.id] || null)}|${JSON.stringify(w.things[room]?.rules?.[rule.id] || null)}` : '') + (memo.get(w)?.get(room)?.usesDraft ? `|${lib.draft?.key(room) ?? ''}` : '');
  // Its settings (since 1.1.1 also { kind: 'choice', id, name, options: [{ id, name }], default } and
  // { kind: 'toggle', id, name, default }, read as the core's own shape), and their values in a
  // room, handed to each hook as its last argument: { [id]: value }, the room's, else the rule's
  // for new rooms, else the default.
  const settingsList = ruleSettings(rule.settings);
  const settingsIn = (w, room) => Object.freeze(Object.fromEntries(settingsList.map((st) => [st.key, sealed(model.roomSetting(w, room, rule.id, st, globals() || {}))])));
  const hand = rule.hand !== false;
  const units = (w, room) => model.roomUnits(w, room);
  const o = {
    id: rule.id, name: rule.name || rule.id, note: rule.note || '', icon: rule.icon, order: rule.order ?? 60,
    groups: null, settings: settingsList.length ? settingsList : rule.settings, claims: Array.isArray(rule.claims) ? rule.claims : undefined,
    units,
    layout(w, room) {
      let byRoom = memo.get(w); if (!byRoom) memo.set(w, (byRoom = new Map()));
      const key = keyOf(w, room);
      const had = byRoom.get(room);
      if (had && had.key === key) return had.map;
      const out = new Map(), own = units(w, room), ids = new Set(own.map((u) => u.id));
      let placed = [];
      const asked = lib.draft?.reads?.() ?? 0;
      try { placed = rule.arrange(readsOver(lib, w, ontologies()), room, settingsIn(w, room)) || []; } catch (err) { console.warn(`Rule ${rule.id}: arrange failed`, err); }
      const usesDraft = (lib.draft?.reads?.() ?? 0) !== asked;
      // A row may give the unit's width and height (the room wraps the thought to them), and a
      // mark may have several rows, each a fragment with the lines it shows ({ lines: [from, to] }:
      // a paragraph that runs on to the next page).
      for (const p of placed) {
        if (!p || !ids.has(p.mark) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        const q = { x: p.x, y: p.y };
        if (Number.isFinite(p.width) && p.width > 0) q.width = p.width;
        if (Number.isFinite(p.height) && p.height > 0) q.height = p.height;
        if (p.align === 'start') q.align = 'start';
        // Words for a zoom band (since 1.1.0): under it the unit shows them in place of its own.
        const bands = Object.fromEntries(['far', 'mid', 'near'].filter((b) => typeof p[b] === 'string' && p[b].trim()).map((b) => [b, p[b].trim().slice(0, 200)]));
        if (Object.keys(bands).length) { q.bands = Object.freeze(bands); out.banded = true; }
        const lines = Array.isArray(p.lines) && p.lines.length === 2 && p.lines.every((n) => Number.isInteger(n) && n >= 0) && p.lines[1] > p.lines[0] ? [p.lines[0], p.lines[1]] : null;
        const had = out.get(p.mark);
        if (had && lines && had.fragments) { had.fragments.push(Object.freeze({ ...q, lines: Object.freeze(lines) })); continue; }
        if (had) continue;
        if (lines) q.fragments = [Object.freeze({ ...q, lines: Object.freeze(lines) })];
        out.set(p.mark, q);
      }
      let i = 0;
      const below = Math.max(0, ...[...out.values()].map((p) => p.y)) + 260;
      for (const u of own) if (!out.has(u.id)) out.set(u.id, { x: (i % 8) * 240, y: below + Math.floor(i++ / 8) * 140 });
      if (hand) for (const [id, p] of groups.spotsOf(w, room, rule.id)) if (out.has(id) && p && Number.isFinite(p.x)) { const q = out.get(id); out.set(id, { ...q, x: p.x, y: p.y, fragments: undefined }); }
      for (const q of out.values()) if (q.fragments) Object.freeze(q.fragments);
      byRoom.set(room, { key: usesDraft && !had?.usesDraft ? keyOf(w, room) + `|${lib.draft?.key(room) ?? ''}` : key, map: out, usesDraft });
      return out;
    },
    point(w, room, id) { return this.layout(w, room).get(id) || null; },
    readsDraft: (w, room) => !!memo.get(w)?.get(room)?.usesDraft, // its arrange read the thought being written (the room lays it out again as the draft grows)
    banded(w, room) { return !!this.layout(w, room).banded; }, // some unit has words for a zoom band
    drop(w, room, id, x, y) {
      if (model.shut(w, room)) return;
      if (rule.drop) propose(w, room, id, said(rule.drop, w, room, id, x, y, settingsIn(w, room)));
      if (hand) groups.putAt(w, room, rule.id, id, x, y);
    },
    unplace: hand ? (w, room, id) => groups.unplace(w, room, rule.id, id) : undefined,
    placed: () => true,
  };
  // The boxes it draws, remembered with the layout's key; each checked to be a box.
  if (rule.draw) {
    const drawn = new WeakMap();
    o.boxes = (w, room) => {
      let byRoom = drawn.get(w); if (!byRoom) drawn.set(w, (byRoom = new Map()));
      const key = keyOf(w, room);
      const had = byRoom.get(room);
      if (had && had.key === key) return had.boxes;
      const out = said(rule.draw, w, room, settingsIn(w, room));
      const boxes = (Array.isArray(out) ? out : []).filter((b) => b && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(b[k])) && b.w > 0 && b.h > 0)
        .map((b) => Object.freeze({ x: b.x, y: b.y, w: b.w, h: b.h, label: b.label == null ? '' : String(b.label), note: b.note == null ? '' : String(b.note),
          style: BOX_STYLES.includes(b.style) ? b.style : 'plain', level: [1, 2, 3].includes(b.level) ? b.level : 0,
          right: b.right == null ? '' : String(b.right), opens: typeof b.opens === 'string' && w.things[b.opens] ? b.opens : null,
          ...(typeof b.surface === 'string' && SURFACE_ID.test(b.surface) ? { surface: b.surface, ...boxData(b.data) } : {}) })); // a surface drawn in it (since 1.1.0)
      byRoom.set(room, { key, boxes });
      return boxes;
    };
  }
  if (rule.land) o.land = (w, room, id, x, y) => (model.shut(w, room) ? [] : propose(w, room, id, said(rule.land, w, room, id, x, y, settingsIn(w, room))));
  if (rule.admit) o.admit = (w, p) => { const why = rule.admit(readsOver(lib, w, ontologies()), p); return why && why !== true ? { ok: false, reason: typeof why === 'string' ? why : why.reason } : { ok: true }; };
  return o;
}

// ---- The parts: what a rule or a view of the tables shares ----

// Picks names from a module, failing loudly if one is missing (a rename in world shows here).
function pick(from, names, where) {
  const out = {};
  for (const name of names) {
    if (!(name in from)) throw new Error(`Plugin API: world's ${where} has no "${name}"`);
    out[name] = from[name];
  }
  return Object.freeze(out);
}

// The rule kit: plain functions of a world handed to them (a rule's layout and gestures get the
// world from the room that asks; a view reads parts.world()). A write with them is a rule's own
// gesture, which the room lands as one step; anything else proposes through the six tables.
export const MODEL = ['parentOf', 'shut', 'hash', 'roomSetting', 'setRoomSetting', 'isGroup', 'isLeaf', 'create',
  'join', 'members', 'itemsIn', 'within', 'groupOf', 'groupsIn', 'roomItems', 'thoughtText', 'view', 'setOrder', 'groupLabel',
  'room', 'roomThoughts', 'kindOf', 'update', 'remove', 'groupsOf', 'addRoom', 'seedRoomSettings', 'search', 'MESSY', 'DEFAULT_MODE',
  'leave', 'replaceIn', 'isLooseGroup', 'spotOf', 'setSpot', 'unsetSpot',
  'roomUnits', 'roomTrains', 'trainThoughts', 'startTrain', 'offsetOf', 'setOffset', 'unsetOffset', 'defaultMode',
  'cellOf', 'floorOf', 'roomsOn', 'span', 'shapeOf'];
export const GROUPS = ['placedForeign', 'trayForeign', 'inForeign', 'waiting', 'wait', 'spot', 'putAt', 'unput', 'spotsOf', 'place', 'unplace'];
export const RELATIONS = ['arrowsOf', 'cleanRelationList', 'relationEntry', 'relationEnds', 'listText', 'relationName', 'splitList',
  'cleanRelations', 'relationShown', 'withRelation', 'RELATIONS'];
export const TRAINS = ['stepAfter', 'setHeights', 'STEP'];
export const KINDS = ['ITEMS', 'kindFor', 'isKnown'];
export const TWINS = ['isTwin', 'twinOf', 'sides', 'addTwin'];
export const LINES = ['svg', 'layer', 'group', 'line', 'knot', 'slack', 'strand', 'path', 'middle', 'between',
  'labelSpot', 'sidePoint', 'facing', 'PAD', 'ENDS', 'ENDS_WORDS', 'cleanEnds', 'PAUSE', 'HEAD'];

// The parts with no app behind them: the world's rules chosen from its lib (world/lib.js). A
// plugin's tests call it with the same modules.
export function surface(lib) {
  return {
    model: pick(lib.model, MODEL, 'model'),
    groups: pick(lib.groups, GROUPS, 'groups'),
    relations: pick(lib.relations, RELATIONS, 'relations'),
    lines: pick(lib.lines, LINES, 'lines'),
    arrows: pick(lib.arrowview, ['arrowView'], 'arrowview'),
    maths: pick(lib.maths, ['maths', 'broken'], 'maths'),
    kinds: pick(lib.items, KINDS, 'items'),
    twins: pick(lib.twin, TWINS, 'twin'),
    pictures: pick(lib.picture, ['shrinkPicture', 'keepOrShrink'], 'picture'),
    layout: pick(lib.spiral, ['spiralPoint'], 'spiral'),
    trains: pick(lib.steps, TRAINS, 'steps'),
  };
}

// The places to plug in that core features own: the slot's name to a plugin → the app's slot.
export const SLOTS = {
  rules: 'world.ontologies',   // a way of seeing a room (world/ontologies/index.js says its shape)
  linkKinds: 'links.kinds',    // a kind of link: cites, contradicts (API.md: { kind, name, note?, both?, quiet?, admit?(from, to, reads) })
  kinds: 'world.items',        // a kind of mark: a passage, a picture, a PDF page (world/items/index.js)
  commands: 'keys',            // a named action, with its keys if it has any (keys/README.md)
  more: 'rail.more',           // an entry under ⋯ More (frame/README.md)
  editor: 'room.editor',       // a section in the Editor for the chosen thing (room/README.md)
  formats: 'world.formats',    // a file format: rooms in and out, and edited as text (world/formats.js)
  carriers: 'world.carriers',  // a carrier of the six tables (the account's sync; world/README.md)
  providers: 'ai.providers',   // an AI provider: does tasks (app/core/AI.md)
  engines: 'ai.engines',       // a runtime several AI providers share (app/core/AI.md)
  aiServices: 'ai.services',   // a replacement for the AI scheduler, cache or budget (app/core/AI.md)
  holds: 'world.holds',        // what a mark may hold beyond the core's: a Twin's sides (world/model.js HOLDS)
  groups: 'world.groups',      // a kind of group: a rule's own (rule) or a family, a book, its chapters (world/model.js declareGroupKinds)
  families: 'world.families',  // older: a family of groups (use groups); read the same (world/model.js declareFamilies)
  buttons: 'room.buttons',     // a button in a room's rail, under Tools (room/README.md)
  menu: 'header.buttons',      // a row in the ☰ menu (Folio's slot, folio/runtime/Shell.js)
  views: 'views',              // a page of the app under everything else (Folio's slot; the picture behind)
  account: 'account',          // who is signed in, and their account page (Folio's slot; the first item)
  spans: 'world.spans',        // a kind of span: the look of some words in a thought, kept on the mark (world/spans.js)
  decorators: 'world.decorators', // how a thought's words are drawn, read-only: never kept (world/spans.js)
  bar: 'room.bar',             // since 1.1.0: a word on a room's bar, beside Search (room/bars.js)
  strip: 'room.strip',         // since 1.1.0: a tool's status, one line at the foot of a room's canvas (room/strip.js)
  pages: 'pages.plugin',       // since 1.1.0: a page of the plugin's own, from the ☰ menu, in the frame (pages/Pages.js)
  surfaces: 'room.surfaces',   // since 1.1.0: an element a kind or a rule's box draws in, with the pointer while focused (room/surface.js)
};

// The zoom's bands when no room feature runs (the room's own, room/shared.js BANDS, are the ones
// that count): far, mid, near, each [from, to).
const BANDS_FALLBACK = Object.freeze({ far: Object.freeze([0.25, 0.5]), mid: Object.freeze([0.5, 1.75]), near: Object.freeze([1.75, 4]) });

// What plugins offer each other (t.peers): one name, one offer at a time; the offer goes when the
// plugin that made it is switched off. shared: a Map the app keeps, or null for none.
// Since 1.1.1 a plugin may hear each offer made or taken back (on).
const PEER_EARS = new WeakMap(); // the shared map → the listeners of every plugin
function peersFor(shared, owner, gone) {
  const map = shared || new Map();
  const mine = new Set();
  if (!PEER_EARS.has(map)) PEER_EARS.set(map, new Set());
  const ears = PEER_EARS.get(map);
  const tell = (name, offered, by) => { for (const fn of [...ears]) { try { fn(row({ name, offered, owner: by })); } catch (err) { console.warn('peers: a listener failed', err); } } };
  const withdraw = (key) => { if (map.get(key)?.owner !== owner) return; map.delete(key); tell(key, false, owner); };
  gone(() => { for (const name of mine) withdraw(name); mine.clear(); });
  return Object.freeze({
    offer: (name, value) => {
      const key = String(name);
      const held = map.get(key);
      if (held && held.owner !== owner) throw new Error(`${held.owner} already offers ${key}`);
      map.set(key, { owner, value });
      mine.add(key);
      tell(key, true, owner);
      return () => { withdraw(key); mine.delete(key); };
    },
    get: (name) => map.get(String(name))?.value ?? null,
    // fn({ name, offered, owner }) on each offer made (offered: true) or taken back; returns a function that stops hearing.
    on: (fn) => { const ear = (o) => fn(o); ears.add(ear); const off = () => ears.delete(ear); gone(off); return off; },
  });
}

// One dock for one plugin: what it opens is noted, so it all closes when the plugin is switched off.
function dockFor(dock, gone) {
  if (!dock) return null;
  const mine = new Set();
  gone(() => { for (const key of mine) dock.close(key, true); mine.clear(); });
  return Object.freeze({
    open: async (o = {}) => {
      if (!o.key) throw new Error('A dock tab needs a key');
      const handle = await dock.open({ ...o, onClose: () => { mine.delete(o.key); o.onClose?.(); } });
      if (handle) mine.add(o.key);
      return handle;
    },
    close: (key, force) => dock.close(key, force),
    show: (key) => dock.show(key),
    isOpen: (key) => dock.isOpen(key),
    isShowing: (key) => dock.isShowing(key),
  });
}

// The API one plugin gets: the six tables, rules and carriers (kernel()), the slots it plugs into,
// the screen it may use (ui), and the parts rules and views share. app: the Folio app; world: the
// world service; plugin: the Feature asking (its id owns what it adds, and it all goes when it is
// switched off: gone(fn)); parts: surface(world.lib), made once; lib: world.lib; events: { on };
// toast, files ({ open, save, arrived }, files.js), link(url), roundTrip(urlFor) (the browser and back), desktop (inside the desktop app), docks, keys, frame,
// floors, service(name), room(), ai (the AI framework's service, app/core/ai): the app's, or null.
export function connect({ app, world, plugin, parts, lib = null, events = null, toast = () => {}, files = null, link = () => false, roundTrip = async () => null, desktop = false, docks = null, keys = null,
  frame = null, floors = null, service = () => null, room = null, gone = () => {}, ai = null, store = null, peers = null }) {
  const wanted = plugin.manifest?.plugin?.api ?? API_VERSION;
  if (wanted > API_VERSION) throw new Error(`${plugin.manifest?.name || plugin.id} is written for plugin API ${wanted}; this app offers ${API_VERSION}`);
  if (wanted < OLDEST_API) throw new Error(`${plugin.manifest?.name || plugin.id} is written for plugin API ${wanted}, which is gone; this app offers ${API_VERSION} (and still connects ${OLDEST_API})`);
  const owner = plugin.id;
  const add = (slot) => (item) => app.slot(slot).add(item, owner); // returns a function that takes it away again
  const declared = () => (app.slot(SLOTS.linkKinds)?.items || []).map((e) => (e && e.item && e.owner !== undefined ? e.item : e));
  const tables = kernel({ lib: lib || world.lib, world, events, gone, floors, linkKinds: declared, spanKinds: () => app.slot(SLOTS.spans)?.items || [] });
  if (frame) gone(() => frame.hide(plugin));
  const slots = Object.freeze({
    ...Object.fromEntries(Object.entries(SLOTS).map(([name, slot]) => [name, Object.freeze({ add: add(slot) })])),
    rules: Object.freeze({
      add: (rule) => add(SLOTS.rules)(typeof rule?.arrange === 'function' && !rule.units ? simpleRule(rule, lib || world.lib, () => world.ontologies, () => world.globals) : rule),
      get: (id) => world.ontology(id),          // the rule with this id (the default when it is off or unknown)
      get all() { return world.ontologies; },    // every rule there is now
      get settings() { return world.globals; },  // each rule's settings for new rooms: { [rule]: { key: value } }
    }),
    commands: Object.freeze({
      add: add(SLOTS.commands), label: (id) => keys?.label(id) || '',
      // Since 1.1.1: the commands live where the person is now, [{ id, name, keys }], and running one
      // by id as its keys would ({ ok }, refused when it is not live there, has nothing to run, or
      // works in a room that is locked).
      list: () => rows((keys?.live?.() || []).map((k) => ({ id: k.id, name: String(k.words || k.id), keys: Object.freeze([...(k.keys || [])]) }))),
      run: (id) => {
        const k = (keys?.live?.() || []).find((x) => x.id === id);
        if (!k) return refuse('No such command here now');
        const open = room?.()?.id?.() ?? null;
        if ((k.zone === 'room' || k.zone === 'editing') && open != null && tables.distance.shut(open)) return refuse('The room is locked');
        return keys?.run?.(id) ? landed(id) : refuse('That command has nothing to run');
      },
    }),
    surfaces: Object.freeze({ add: (s) => add(SLOTS.surfaces)(surfaceFor(s, HOLDS.get(tables), plugin.manifest?.plugin?.needs)) }),
    // A page of its own: the page itself (the pages feature shows it in the frame) and its row in
    // the ☰ menu, which opens it; the one function given back takes both away.
    pages: Object.freeze({
      add: (page) => {
        if (!page || typeof page.id !== 'string' || !page.id) throw new Error('A page needs an id');
        const off = add(SLOTS.pages)(page);
        const menuRow = add(SLOTS.menu)({ id: `page:${page.id}`, label: String(page.label || page.id), icon: page.icon || 'dots', order: page.order ?? 50,
          onClick: () => service('pages')?.open(page.id), ...(page.visible ? { visible: () => page.visible() } : {}) });
        return () => { off(); menuRow(); };
      },
    }),
  });
  // The zoom (since 1.1.0): the room's, read and set through the open room (room/view.js).
  const zoomNs = Object.freeze({
    get: () => { const z = room?.()?.zoom?.(); return z ? row({ zoom: z.zoom, band: z.band }) : null; },
    set: (zoom, at) => { const r = room?.(); const z = r?.setZoom ? r.setZoom(+zoom, at) : null; return z ? row({ ok: true, zoom: z.zoom, band: z.band }) : row({ ok: false, reason: 'No room is open' }); },
    on: (fn) => {
      const r = room?.();
      if (!r?.onZoom) return () => {};
      const off = r.onZoom((z) => fn(row({ zoom: z.zoom, band: z.band, context: z.context })));
      gone(off);
      return off;
    },
    get bands() { return room?.()?.bands || BANDS_FALLBACK; },
  });
  // What the person is looking at: { context, mark, marks } (marks since 1.1.1: all that is chosen;
  // mark the one chosen, null when several are), or null outside a room; chosen.on(fn) hears each change (since 1.1.1).
  const chosenOf = (r) => {
    const context = r?.id?.() ?? null;
    if (context == null) return null;
    const marks = r.chosenAll ? [...r.chosenAll()] : (r.chosen?.() != null ? [r.chosen()] : []);
    return row({ context, mark: r.chosen?.() ?? null, marks: Object.freeze(marks) });
  };
  const chosenFn = () => chosenOf(room?.());
  chosenFn.on = (fn) => {
    const r = room?.();
    if (!r?.onChosen) return () => {};
    const off = r.onChosen((o) => fn(row({ context: o.context, mark: o.mark, marks: Object.freeze([...o.marks]) })));
    gone(off);
    return off;
  };
  Object.freeze(chosenFn);
  return Object.freeze({
    version: API_VERSION,
    app: Object.freeze({ name: app.config.name, version: app.config.version, desktop: !!desktop }),
    plugin: Object.freeze({ id: owner, name: plugin.manifest?.name || owner }),
    ...tables,
    slots,
    // What plugins offer each other, by name, through the API (an imported plugin has no other
    // way to another plugin): offer(name, value) is the plugin's own and goes when it is switched
    // off; get(name) is the value offered now, or null. Ask with get when it is needed, not once
    // at start: the plugin offering it may start later, or not at all.
    peers: peersFor(peers, owner, gone),
    // The AI framework (app/core/AI.md): tasks, the providers that do them, the maker's verdicts.
    ai: aiFor(ai, tables, readsOf(tables), { id: owner, name: plugin.manifest?.name || owner, spec: plugin.manifest?.plugin?.sidecar }),
    // What the plugin keeps on this computer, never in a .traum file (app/core/store): small state
    // and large files with a quota; null when the store isn't there.
    store: store ? store.for(owner) : null,
    // The screen a plugin may use, and what the person is looking at: the open room and the one
    // mark chosen there, as ids, or null.
    ui: Object.freeze({
      toast: (text) => toast(text),
      // How words wrap at a width as the room draws a thought: { lines, lineHeight, height }.
      measure: (text, width) => measure(text, width),
      // How tall a mark draws at a width, for a rule laying marks in a column (a page): words by
      // their lines; a kind with height(mark, width) by its own word (a table, a figure); inline:
      // whether the kind says it flows among paragraphs (slots.kinds' inline).
      size: (id, width) => {
        const th = tables.marks.get(id);
        if (!th) return null;
        const k = (app.slot(SLOTS.kinds)?.items || []).find((x) => x?.kind === th.kind) || (lib || world.lib).items.kindFor(th.kind);
        let h = null;
        if (typeof k.height === 'function') { try { h = +k.height(th, +width); } catch { h = null; } }
        if (Number.isFinite(h) && h > 0) return row({ height: h, inline: !!k.inline });
        const m = measure(tables.marks.text(id) || ' ', width);
        return row({ height: m.height, lines: m.lines, lineHeight: m.lineHeight, inline: th.kind === 'line' || th.kind === 'passage' || !!k.inline });
      },
      // The words being written (a new thought, or one opened again): the caret, and what a
      // plugin may do there. Nothing is kept until Enter keeps the thought, as one step; a kept
      // mark's words change through replace(mark, …), one step.
      text: Object.freeze({
        caret: () => { const c = room?.()?.text?.caret?.(); return c ? row(c) : null; },
        select: (from, to = from) => !!room?.()?.text?.select?.(+from, +to),
        replace: (mark, from, to, words) => {
          const live = room?.()?.text, c = live?.caret?.();
          if (c && (mark == null || mark === c.mark)) return live.replace(+from, +to, words) ? row({ ok: true, id: c.mark }) : row({ ok: false, reason: 'Nothing is being written' });
          const th = tables.marks.get(mark);
          if (!th) return row({ ok: false, reason: 'No such mark' });
          if (typeof th.text !== 'string') return row({ ok: false, reason: 'That mark has no words to replace' });
          const a = Math.max(0, Math.min(th.text.length, Math.floor(+from))), b = Math.max(a, Math.min(th.text.length, Math.floor(+to)));
          return tables.marks.edit(mark, { text: th.text.slice(0, a) + String(words ?? '') + th.text.slice(b) });
        },
        // A kept line opened to write in, the caret at `at` (its end by default), as a triple-click
        // opens it (since 1.1.1): the caret runs on from one paragraph to the next.
        edit: (mark, at = null) => {
          const th = tables.marks.get(mark), r = room?.(), open = r?.id?.() ?? null;
          if (!th) return row({ ok: false, reason: 'No such mark' });
          if (th.kind !== 'line') return row({ ok: false, reason: 'Only words are written in: open a mark of another kind its own way' });
          if (open == null || tables.places.home(mark) !== open) return row({ ok: false, reason: 'The mark is not in the open room' });
          if (tables.distance.shut(mark)) return row({ ok: false, reason: 'The room is locked' });
          return r?.text?.edit?.(mark, at == null ? null : Math.floor(+at)) ? row({ ok: true, id: mark }) : row({ ok: false, reason: 'The mark cannot be written in here' });
        },
        style: (kind, from = null, to = null) => !!room?.()?.text?.style?.(String(kind), from, to),
        spans: () => rows(room?.()?.text?.spans?.() || []),
        on: (fn) => { const off = room?.()?.text?.on?.(fn) || (() => {}); gone(off); return off; },
      }),
      zoom: zoomNs,
      files: Object.freeze({
        open: (accept = '') => (files ? files.open(String(accept)) : Promise.resolve(null)),
        save: (name, content, type = 'text/plain') => (files ? files.save(String(name), content, type) : Promise.resolve(false)),
        arrived: (fn) => { const off = files ? files.arrived(fn) : () => {}; gone(off); return off; },
      }),
      link: (url) => link(String(url)),
      roundTrip: (urlFor) => roundTrip(urlFor),
      download: (name, content, type = 'text/plain') => (files ? files.save(String(name), content, type) : Promise.resolve(false)),
      chosen: chosenFn,
      // Since 1.1.1: chooses marks of the open room ({ ok }; refused outside a room or for marks not
      // there), and draws marks again on the next frame without a table changing (a decorator's
      // state changed; coalesced, however often it is asked).
      choose: (ids) => { const r = room?.(); if (r?.id?.() == null) return refuse('No room is open'); return r.choose?.([].concat(ids ?? [])) ? row({ ok: true }) : refuse('Those marks are not in the open room'); },
      repaint: (ids = null) => { const r = room?.(); if (r?.id?.() == null || !r.repaint) return false; r.repaint(ids == null ? null : [].concat(ids)); return true; },
      docks: docks ? Object.freeze({ left: dockFor(docks.left, gone), right: dockFor(docks.right, gone), canvasOnly: () => docks.canvasOnly?.() }) : null,
      frame: frame ? Object.freeze({
        show: (o) => frame.show(plugin, o), update: (o) => frame.update(plugin, o), hide: () => frame.hide(plugin),
        hint: (text) => frame.hint(text), clearHint: () => frame.clearHint(),
      }) : null,
      open: Object.freeze({
        rooms: () => { service('create')?.open(); },
        room: (id) => { service('create')?.open(); service('rooms')?.openRoom(id); },
        // To a mark: into the room it is at home in, with the view on it and it chosen (a room: into it).
        mark: (id) => {
          const m = tables.marks.get(id);
          if (!m) return false;
          const home = m.kind === 'room' ? id : tables.places.home(id);
          if (!home || tables.marks.get(home)?.kind !== 'room') return false;
          service('create')?.open(); service('rooms')?.openRoom(home);
          if (home !== id) room?.()?.go?.(id, home);
          return true;
        },
        // A page a plugin added (slots.pages), by id: shown in the frame; false when there is none.
        page: (id) => !!service('pages')?.open(String(id)),
      }),
    }),
    // What rules and views share: the rule kit and the drawing parts (surface()), and the world
    // they are handed, read afresh each time (it is replaced when read back from storage).
    parts: Object.freeze({ ...parts, world: () => world.world }),
  });
}
