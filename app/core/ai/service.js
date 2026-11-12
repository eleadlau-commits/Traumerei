// The AI framework's core (app/core/AI.md): picks a provider for a task, falls back when it is
// missing, failing or over budget, and runs it through the shared services (scheduler, cache,
// budget, privacy policy). Pure of the screen and of the world: what it reads of the app comes in
// as functions, so the tests run it as it is.
//
// The hard rule lives here as well as in the contract: a provider is handed reads, never a way to
// write. What it returns goes back to the caller, who shows it as a suggestion the maker keeps or
// refuses.

import { TASKS, invalid } from './tasks.js';
import { fits } from './machine.js';

// Our own system's id. It is every task's default once it is there.
export const DEFAULT_SYSTEM = 'default';
export const PRIORITY = Object.freeze({ now: 0, soon: 1, idle: 2 });
const SPEED = { fast: 0, medium: 1, slow: 2 };

// Frozen all the way down, except vectors (a typed array with numbers in it can't be frozen).
function frozen(o) {
  if (o && typeof o === 'object' && !ArrayBuffer.isView(o) && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) frozen(v); }
  return o;
}

// A content hash of any input: FNV-1a over a stable writing of it (keys sorted, vectors as numbers).
export function hashOf(value) {
  const seen = (v) => {
    if (ArrayBuffer.isView(v)) return `[${Array.from(v).join(',')}]`;
    if (Array.isArray(v)) return `[${v.map(seen).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${seen(v[k])}`).join(',')}}`;
    return JSON.stringify(v ?? null);
  };
  const s = seen(value);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822507); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

// ---- The three swappable services, with their built-in defaults ----

// Cache: results by key (content hash plus task, provider and versions), the oldest used dropped first.
export function makeCache({ most = 500 } = {}) {
  const kept = new Map();
  return {
    get: (key) => { if (!kept.has(key)) return undefined; const v = kept.get(key); kept.delete(key); kept.set(key, v); return v; },
    set: (key, value) => { kept.delete(key); kept.set(key, value); while (kept.size > most) kept.delete(kept.keys().next().value); },
    clear: () => kept.clear(),
    get size() { return kept.size; },
  };
}

// Scheduler: runs jobs in order of priority, a few at a time; a job whose signal is aborted
// before it starts never runs. Jobs of a task that batches (embed), for the same provider and
// priority, queued in the same moment, run as one.
// job: { provider, task, priority, signal, input, go(input) → Promise<output> }
export function makeScheduler({ together = 2, batches = (task) => TASKS[task]?.batch || null } = {}) {
  const queue = [];
  let running = 0;
  let seq = 0;
  const aborted = (signal) => !!signal?.aborted;
  const pump = () => {
    while (running < together && queue.length) {
      queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
      const first = queue.shift();
      const batch = batches(first.task);
      const group = [first];
      if (batch) for (let i = queue.length - 1; i >= 0; i--) {
        const j = queue[i];
        if (j.task === first.task && j.provider === first.provider && j.priority === first.priority) group.unshift(...queue.splice(i, 1));
      }
      const live = group.filter((j) => { if (aborted(j.signal)) { j.reject(new Error('Cancelled')); return false; } return true; });
      if (!live.length) continue;
      live.sort((a, b) => a.seq - b.seq);
      running++;
      const input = live.length > 1 ? batch.join(live.map((j) => j.input)) : live[0].input;
      Promise.resolve().then(() => live[0].go(input)).then((out) => {
        const parts = live.length > 1 ? batch.split(out, live.map((j) => j.input)) : [out];
        live.forEach((j, i) => j.resolve(parts[i]));
      }, (err) => live.forEach((j) => j.reject(err))).finally(() => { running--; pump(); });
    }
  };
  return {
    run: (job) => new Promise((resolve, reject) => {
      if (aborted(job.signal)) { reject(new Error('Cancelled')); return; }
      queue.push({ ...job, priority: job.priority ?? PRIORITY.soon, seq: seq++, resolve, reject });
      queueMicrotask(pump); // the same moment's jobs gather first, so they can batch
    }),
    get waiting() { return queue.length; },
  };
}

// Budget: memory (MB) and a share of the GPU for each provider (or the engine it shares), so two
// providers don't both hold a large model. What is loaded stays until room is needed; then the
// least recently used goes (its unload() is called).
// holder: { id, memory?, gpu?, load?(), unload?() } — a provider, or the engine it runs on.
export function makeBudget({ memory = () => 2048, gpu = () => 1 } = {}) {
  const loaded = new Map(); // id → { holder, used, busy }
  let clock = 0;
  const total = (key) => [...loaded.values()].reduce((s, e) => s + (e.holder[key] || 0), 0);
  return {
    async acquire(holder) {
      const need = { memory: holder.memory || 0, gpu: holder.gpu || 0 };
      const have = loaded.get(holder.id);
      if (!have) {
        if (need.memory > memory() || need.gpu > gpu()) return { ok: false, reason: `${holder.id} needs more than the whole budget` };
        const free = () => total('memory') + need.memory <= memory() && total('gpu') + need.gpu <= gpu();
        const idle = [...loaded.values()].filter((e) => !e.busy).sort((a, b) => a.used - b.used);
        while (!free() && idle.length) { const e = idle.shift(); loaded.delete(e.holder.id); try { await e.holder.unload?.(); } catch { /* gone either way */ } }
        if (!free()) return { ok: false, reason: `No room in the budget for ${holder.id} while others work` };
        try { await holder.load?.(); } catch (err) { return { ok: false, reason: `${holder.id} could not load: ${err.message}` }; }
        loaded.set(holder.id, { holder, used: ++clock, busy: 0 });
      }
      const e = loaded.get(holder.id);
      e.used = ++clock; e.busy++;
      let done = false;
      return { ok: true, release: () => { if (!done) { done = true; e.busy--; } } };
    },
    loaded: () => [...loaded.keys()],
    drop: async (id) => { const e = loaded.get(id); if (e) { loaded.delete(id); await e.holder.unload?.(); } },
  };
}

// ---- The framework ----

// providers(): the providers added (each { id, name?, version, tasks, hints?, engine?, available?(), load?(), unload?(), run(task, input, ctx), verdict?(v) });
// engines(): the engines added ({ id, name?, kind?, memory?, gpu?, load?(), unload?() });
// services(): replacements for { scheduler?, cache?, budget? }, the last one added for each wins;
// settings: { choice(task) → provider id | null, cloud() → bool, blocked(context) → bool, allowed(providerId) → bool (a sidecar the person let run), memory() → MB, machine() → 'every-pc' | 'mid' | 'gpu' };
// desktop: inside the desktop app; now(): the clock.
export function makeAi({ providers = () => [], engines = () => [], services = () => [], settings = {}, desktop = false, now = () => Date.now() } = {}) {
  const choice = settings.choice || (() => null);
  const cloud = settings.cloud || (() => false);
  const blocked = settings.blocked || (() => false);
  const allowed = settings.allowed || (() => false);
  const machine = settings.machine || (() => 'gpu');
  const defaults = { cache: makeCache(), scheduler: makeScheduler(), budget: makeBudget({ memory: settings.memory || (() => 2048) }) };
  const service = (name) => { const r = [...services()].reverse().find((s) => s.replaces === name); if (!r) return defaults[name]; if (!r.made) r.made = r.make(defaults); return r.made; };

  const remote = (p) => p.hints?.where === 'remote';
  const sidecar = (p) => p.hints?.runs === 'sidecar';
  const speed = (p) => SPEED[p.hints?.speed] ?? 1;
  const doing = (task) => providers().filter((p) => p && Array.isArray(p.tasks) && p.tasks.includes(task) && typeof p.run === 'function');

  // Why a provider may not run here, now, for this context (the privacy policy and permissions), or null.
  const barred = (p, context) => {
    if (!fits(p.hints?.tier, machine())) return `needs a ${p.hints.tier} machine; this one is ${machine()}`;
    if (remote(p)) {
      if (!cloud()) return 'cloud providers are off (Settings → AI)';
      if (context == null) return 'a cloud provider needs to know whose room it reads';
      if (blocked(context)) return 'this room keeps everything on this machine';
    }
    if (sidecar(p)) {
      if (!desktop) return 'a process beside the app runs only in the desktop app';
      // A sidecar that asks (sidecar.js) asks the person itself the first time; others wait for Settings.
      if (!allowed(p.id) && !p.hints?.asks) return 'not allowed to run beside the app yet (Settings → AI)';
    }
    return null;
  };

  // The order providers are tried in for a task: the one chosen in Settings, our own system, then
  // the rest: a provider that calls itself a fallback after the others, local before remote, fast before slow.
  const order = (task) => {
    const all = doing(task);
    const first = [choice(task), DEFAULT_SYSTEM].filter(Boolean);
    const rank = (p) => { const i = first.indexOf(p.id); return i >= 0 ? i : first.length; };
    const last = (p) => (p.hints?.fallback ? 1 : 0);
    return all.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || last(a.p) - last(b.p) || remote(a.p) - remote(b.p) || speed(a.p) - speed(b.p) || a.i - b.i).map((e) => e.p);
  };

  const holderOf = (p) => {
    const e = p.engine ? engines().find((x) => x.id === p.engine) : null;
    if (p.engine && !e) return { missing: `its engine ${p.engine} is not there` };
    return e ? { id: `engine:${e.id}`, memory: e.memory, gpu: e.gpu, load: e.load, unload: e.unload } : { id: p.id, memory: p.hints?.memory, gpu: p.hints?.gpu, load: p.load, unload: p.unload };
  };

  // Runs a task. Resolves with a frozen result: { ok: true, task, version, provider: { id, version }, output, ms, cached, tried }
  // or { ok: false, task, reason, tried }, where tried lists [{ id, reason }] for each provider passed over.
  // opts: { context (the room it reads, for the privacy policy), priority ('now' | 'soon' | 'idle'), signal, part(fn), only (a provider id), fresh (skip the cache), reads, verdicts }.
  async function call(task, input, opts = {}) {
    const def = TASKS[task];
    if (!def) return frozen({ ok: false, task, reason: `No such task: ${task}`, tried: [] });
    const bad = invalid(def.input, input, 'the input') || (def.accepts && def.accepts(input) !== true ? def.accepts(input) : null);
    if (bad) return frozen({ ok: false, task, reason: bad, tried: [] });
    const tried = [];
    const list = opts.only ? order(task).filter((p) => p.id === opts.only) : order(task);
    if (!list.length) return frozen({ ok: false, task, reason: opts.only ? `${opts.only} does not do ${task}` : `No provider does ${task} yet`, tried });
    for (const p of list) {
      const pass = (reason) => tried.push(Object.freeze({ id: p.id, reason }));
      if (opts.signal?.aborted) return frozen({ ok: false, task, reason: 'Cancelled', tried });
      const why = barred(p, opts.context);
      if (why) { pass(why); continue; }
      try { if (p.available && !(await p.available())) { pass('not available'); continue; } } catch (err) { pass(`not available: ${err.message}`); continue; }
      // A verdict since changes what a learning provider would say: the count is part of the key.
      const said = opts.verdicts ? opts.verdicts(null).length : 0;
      const key = `${task}@${def.version}|${p.id}@${p.version}|v${said}|${hashOf(input)}`;
      const cache = service('cache');
      const hit = opts.fresh ? undefined : cache.get(key);
      if (hit) return frozen({ ok: true, task, version: def.version, provider: { id: p.id, version: String(p.version) }, output: hit, ms: 0, cached: true, tried });
      const holder = holderOf(p);
      if (holder.missing) { pass(holder.missing); continue; }
      const start = now();
      let output;
      try {
        output = await service('scheduler').run({
          provider: p.id, task, input, signal: opts.signal, priority: PRIORITY[opts.priority] ?? PRIORITY.soon,
          go: async (inp) => {
            const lease = await service('budget').acquire(holder);
            if (!lease.ok) throw Object.assign(new Error(lease.reason), { budget: true });
            try {
              return await p.run(task, inp, Object.freeze({ version: def.version, context: opts.context ?? null, signal: opts.signal || null,
                part: (x) => { try { opts.part?.(x); } catch { /* the caller's own trouble */ } }, reads: opts.reads || null, verdicts: opts.verdicts || (() => []) }));
            } finally { lease.release(); }
          },
        });
      } catch (err) {
        if (err.message === 'Cancelled' || opts.signal?.aborted) return frozen({ ok: false, task, reason: 'Cancelled', tried });
        pass(err.budget ? `over budget: ${err.message}` : `failed: ${err.message}`);
        continue;
      }
      const checked = def.check && !invalid(def.output, output) ? def.check(input, output) : true;
      const wrong = invalid(def.output, output, 'its answer') || (checked === true ? null : checked);
      if (wrong) { pass(`answered wrongly: ${wrong}`); continue; }
      frozen(output);
      cache.set(key, output);
      return frozen({ ok: true, task, version: def.version, provider: { id: p.id, version: String(p.version) }, output, ms: now() - start, cached: false, tried });
    }
    return frozen({ ok: false, task, reason: `No provider could do ${task}: ${tried.map((t) => `${t.id} ${t.reason}`).join('; ')}`, tried });
  }

  // The providers there are (for a task: in the order they'd be tried), as plain rows.
  const list = (task = null) => (task ? order(task) : providers().filter(Boolean)).map((p) => frozen({
    id: p.id, name: p.name || p.id, version: String(p.version ?? ''), tasks: [...(p.tasks || [])], engine: p.engine || null, hints: { ...(p.hints || {}) },
  }));

  // The provider a call would try first now, for a task and a room: its id, or null.
  const first = (task, context = null) => order(task).find((p) => !barred(p, context))?.id || null;

  // A verdict on a result, routed back to the provider that made it (its verdict(v), if it has one).
  // v: { provider, version, task, kept, features?, suggestion? }. True when a provider heard it.
  const verdict = (v) => {
    const p = providers().find((x) => x?.id === v?.provider);
    if (!p?.verdict) return false;
    try { p.verdict(frozen({ ...v })); return true; } catch { return false; }
  };

  return Object.freeze({ call, list, first, order: (task) => order(task).map((p) => p.id), barred: (id, context = null) => { const p = providers().find((x) => x?.id === id); return p ? barred(p, context) : 'no such provider'; }, verdict, service, defaults });
}
