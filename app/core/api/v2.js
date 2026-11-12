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


export const API_VERSION = 2;
export const TABLES = Object.freeze(['marks', 'places', 'links', 'distance', 'gaps', 'moments']);

// The readers a context can be declared for (KERNEL.md: distance).
export const READERS = Object.freeze(['me now', 'me later', 'others', 'machine']);
// The directions a gap can have (KERNEL.md: gaps).
export const DIRECTIONS = Object.freeze(['to world', 'from world', 'to maker']);
// The kinds of link there are (world/links.js says the same): part of, stands for, relation.
export const LINK_KINDS = Object.freeze(['part of', 'stands for', 'relation']);

const row = (o) => Object.freeze(o);
const rows = (list) => Object.freeze(list.map(row));
const landed = (id) => row({ ok: true, id });
const refuse = (reason) => row({ ok: false, reason });
const later = (what, phase) => refuse(`${what} arrives in kernel phase ${phase}; until then this is a name, not a table`);
export const ARCHIVE = 'archive';

// ---- Six tables over the world as it is ----
// lib: the world's rules (world.lib); world: the world service (its .world is w). Pure of the
// screen; the tests call it with the same modules.
export function kernel({ lib, world, events = null, gone = () => {}, floors = null, linkKinds = () => [] }) {
  const { model, groups, links: LINKS, places: PLACES_T } = lib; // (the links and places tables, world/links.js and places.js, reached as the world's rules are)
  const netFor = (rule) => lib.relations.netFor(rule);
  const declared = () => linkKinds() || [];
  let reads = null; // the read half, handed to a link kind's admit() (set once the tables are made)
  const w = () => world.world;
  const rules = () => (world.ontologies?.length ? world.ontologies.map((o) => o.id) : ['joyce', 'pessoa']);
  const lays = (rule) => !!world.ontologies?.find((o) => o.id === rule)?.lays;
  const thing = (id) => w().things[id] || null;
  const kindOf = (th) => model.kindOf(th);
  // A propose saves (one step); inside together(fn) the saves wait, and every change fn makes
  // lands as one step when it returns.
  let holding = 0, held = false;
  const save = () => { if (holding) held = true; else world.save?.(); };
  const together = (fn) => {
    holding++;
    try { return fn(); } finally { if (!--holding && held) { held = false; world.save?.(); } }
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
  const marks = Object.freeze({
    get: (id) => (thing(id) ? row({ ...thing(id) }) : null),
    in: (context) => rows(model.children(w(), context ?? null).map((th) => ({ ...th }))),
    ofKind: (kind) => rows(Object.values(w().things).filter((th) => kindOf(th) === kind).map((th) => ({ ...th }))),
    text: (id) => (thing(id) ? model.thoughtText(w(), thing(id)) : ''),
    search: (words, most) => rows(model.search(w(), words, most).map((th) => ({ ...th }))),
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
    named: (kind) => { const k = declared().find((d) => d.kind === kind); return k ? row({ kind: k.kind, name: k.name || k.kind, note: k.note || '', both: !!k.both }) : LINK_KINDS.includes(kind) ? row({ kind, name: kind, note: '', both: false }) : null; },
    count: () => LINKS.count(w()),
    // kind 'relation' takes the rule whose arrows these are (`rule`: 'russell', 'proust-links') and
    // goes through that rule's own checks (Russell refuses a loop, Law 3); label is the relation's
    // name (left out: the room's first), note the arrow's words.
    link: (from, to, kind, label = null, { rule = null, note = '' } = {}) => {
      if (kind === 'part of') {
        if (!model.isGroup(thing(to))) return refuse('Only a group can hold a part');
        return land(model.join(w(), to, from), LINKS.partId(to, from), 'The part cannot join: it is in another context, locked, or would hold its own group');
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
  const momentRow = (r) => ({ time: r.time, kind: r.kind === 'told' ? r.said : r.kind, ...(r.mark != null ? { mark: r.mark } : r.link != null ? { link: r.link } : r.place != null ? { place: r.place } : r.gap != null ? { gap: r.gap } : r.dist != null ? { dist: r.dist } : { context: r.context }), ...(r.step != null ? { step: r.step } : {}) });
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
      return rows(o ? [...lib.rules.layout(o, w(), context)].map(([mark, p]) => ({ mark, context, rule, position: Object.freeze({ x: p.x, y: p.y }) })) : []);
    },
    admit: (rule, proposal) => { const o = ontology(rule); return row(o ? { ...lib.rules.admit(o, w(), { ...(proposal || {}) }) } : { ok: false, reason: 'No such rule' }); },
    moves: (rule, context, mark) => { const o = ontology(rule); return rows(o ? lib.rules.moves(o, w(), context, mark) : []); },
    draws: (rule, context) => {
      const o = ontology(rule), d = o ? lib.rules.draws(o, w(), context) : { lines: [], arrows: [] };
      return row({ lines: Object.freeze(d.lines.map((l) => Object.freeze([...l]))), arrows: rows(d.arrows) });
    },
  });

  reads = readsOf({ marks, places, links, distance, gaps, moments });
  return Object.freeze({ marks, places, links, distance, gaps, moments, rules: ruleNs, carriers, together });
}

// The read half of the tables: what a rule's arrange(), a link kind's admit() and a view are handed.
export const READS = Object.freeze({
  marks: ['get', 'in', 'ofKind', 'text', 'search'],
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
export function simpleRule(rule, lib, ontologies = () => null) {
  const { model, groups, gaps: G, rules: R } = lib;
  const stampOf = (w) => `${G.version(w)}|${JSON.stringify(w.ahead || {}).length}`;
  const memo = new WeakMap(); // w → Map context → { stamp, key, map }
  const hand = rule.hand !== false;
  const units = (w, room) => model.roomUnits(w, room);
  const o = {
    id: rule.id, name: rule.name || rule.id, note: rule.note || '', icon: rule.icon, order: rule.order ?? 60,
    groups: null, settings: rule.settings,
    units,
    layout(w, room) {
      let byRoom = memo.get(w); if (!byRoom) memo.set(w, (byRoom = new Map()));
      const key = `${lib.places.version(w, room)}|${lib.links.version(w)}|${model.marksVersion(w)}|${stampOf(w)}`;
      const had = byRoom.get(room);
      if (had && had.key === key) return had.map;
      const out = new Map(), own = units(w, room), ids = new Set(own.map((u) => u.id));
      let placed = [];
      try { placed = rule.arrange(readsOver(lib, w, ontologies()), room) || []; } catch (err) { console.warn(`Rule ${rule.id}: arrange failed`, err); }
      for (const p of placed) if (p && ids.has(p.mark) && Number.isFinite(p.x) && Number.isFinite(p.y)) out.set(p.mark, { x: p.x, y: p.y });
      let i = 0;
      const below = Math.max(0, ...[...out.values()].map((p) => p.y)) + 260;
      for (const u of own) if (!out.has(u.id)) out.set(u.id, { x: (i % 8) * 240, y: below + Math.floor(i++ / 8) * 140 });
      if (hand) for (const [id, p] of groups.spotsOf(w, room, rule.id)) if (out.has(id) && p && Number.isFinite(p.x)) out.set(id, { x: p.x, y: p.y });
      byRoom.set(room, { key, map: out });
      return out;
    },
    point(w, room, id) { return this.layout(w, room).get(id) || null; },
    drop(w, room, id, x, y) { if (hand && !model.shut(w, room)) groups.putAt(w, room, rule.id, id, x, y); },
    unplace: hand ? (w, room, id) => groups.unplace(w, room, rule.id, id) : undefined,
    placed: () => true,
  };
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
  'leave', 'replaceIn', 'isLooseGroup', 'spotOf', 'setSpot', 'unsetSpot'];
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
    layout: pick(lib.pessoa, ['spiralPoint'], 'pessoa'),
    trains: pick(lib.joyce, TRAINS, 'joyce'),
  };
}

// The places to plug in that core features own: the slot's name to a plugin → the app's slot.
export const SLOTS = {
  rules: 'world.ontologies',   // a way of seeing a room (world/ontologies/index.js says its shape)
  linkKinds: 'links.kinds',    // a kind of link: cites, contradicts (API.md: { kind, name, note?, both?, admit?(from, to, reads) })
  kinds: 'world.items',        // a kind of mark: a passage, a picture, a PDF page (world/items/index.js)
  commands: 'keys',            // a named action, with its keys if it has any (keys/README.md)
  more: 'rail.more',           // an entry under ⋯ More (frame/README.md)
  editor: 'room.editor',       // a section in the Editor for the chosen thing (room/README.md)
  formats: 'world.formats',    // a file format: rooms in and out, and edited as text (world/formats.js)
  carriers: 'world.carriers',  // a carrier of the six tables (the account's sync; world/README.md)
};

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
// toast, files ({ open, save, arrived }, files.js), link(url), desktop (inside the desktop app), docks, keys, frame,
// floors, service(name), room(): the app's, or null.
export function connect({ app, world, plugin, parts, lib = null, events = null, toast = () => {}, files = null, link = () => false, desktop = false, docks = null, keys = null,
  frame = null, floors = null, service = () => null, room = null, gone = () => {} }) {
  const wanted = plugin.manifest?.plugin?.api ?? API_VERSION;
  if (wanted > API_VERSION) throw new Error(`${plugin.manifest?.name || plugin.id} is written for plugin API ${wanted}; this app offers ${API_VERSION}`);
  if (wanted < API_VERSION) throw new Error(`${plugin.manifest?.name || plugin.id} is written for plugin API ${wanted}, which is gone; this app offers ${API_VERSION}`);
  const owner = plugin.id;
  const add = (slot) => (item) => app.slot(slot).add(item, owner); // returns a function that takes it away again
  const declared = () => (app.slot(SLOTS.linkKinds)?.items || []).map((e) => (e && e.item && e.owner !== undefined ? e.item : e));
  const tables = kernel({ lib: lib || world.lib, world, events, gone, floors, linkKinds: declared });
  if (frame) gone(() => frame.hide(plugin));
  const slots = Object.freeze({
    ...Object.fromEntries(Object.entries(SLOTS).map(([name, slot]) => [name, Object.freeze({ add: add(slot) })])),
    rules: Object.freeze({
      add: (rule) => add(SLOTS.rules)(typeof rule?.arrange === 'function' && !rule.units ? simpleRule(rule, lib || world.lib, () => world.ontologies) : rule),
      get: (id) => world.ontology(id),          // the rule with this id (the default when it is off or unknown)
      get all() { return world.ontologies; },    // every rule there is now
      get settings() { return world.globals; },  // each rule's settings for new rooms: { [rule]: { key: value } }
    }),
    commands: Object.freeze({ add: add(SLOTS.commands), label: (id) => keys?.label(id) || '' }),
  });
  return Object.freeze({
    version: API_VERSION,
    app: Object.freeze({ name: app.config.name, version: app.config.version, desktop: !!desktop }),
    plugin: Object.freeze({ id: owner, name: plugin.manifest?.name || owner }),
    ...tables,
    slots,
    // The screen a plugin may use, and what the person is looking at: the open room and the one
    // mark chosen there, as ids, or null.
    ui: Object.freeze({
      toast: (text) => toast(text),
      files: Object.freeze({
        open: (accept = '') => (files ? files.open(String(accept)) : Promise.resolve(null)),
        save: (name, content, type = 'text/plain') => (files ? files.save(String(name), content, type) : Promise.resolve(false)),
        arrived: (fn) => { const off = files ? files.arrived(fn) : () => {}; gone(off); return off; },
      }),
      link: (url) => link(String(url)),
      download: (name, content, type = 'text/plain') => (files ? files.save(String(name), content, type) : Promise.resolve(false)),
      chosen: () => { const r = room?.(); const context = r?.id?.() ?? null; return context == null ? null : row({ context, mark: r.chosen?.() ?? null }); },
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
      }),
    }),
    // What rules and views share: the rule kit and the drawing parts (surface()), and the world
    // they are handed, read afresh each time (it is replaced when read back from storage).
    parts: Object.freeze({ ...parts, world: () => world.world }),
  });
}
