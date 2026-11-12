// The evaluation harness (app/core/AI.md): scores any provider on the same exam, so a new system
// can prove itself against the old one. An exam is a list of cases; each case is an input and a
// mark for the answer (0 to 1). The commonest exam is the maker's own past verdicts: would the
// provider have scored what was kept above what was refused? Each call is also held to its task's
// speed budget (tasks.js TIERS), translation at the provider's edge included. Calls are measured
// warm: the first case is run once before the exam as the load, held to its own budget (LOAD_BUDGET).

import { TIERS, LOAD_BUDGET } from './tasks.js';

// ai: the framework (service.js makeAi); provider: an id; task; cases: [{ input, mark(output) → 0..1 }];
// tier: 'interactive' (default) or 'background'; warm: false to skip the loading call.
// Resolves with { provider, task, tier, cases, score (mean mark), ms: { mean, max }, load: { ms, over },
// over (calls over budget), failed (calls with no answer), passed (answered all, none over budget, loaded in time) }.
export async function exam(ai, { provider, task, cases, tier = 'interactive', warm = true, now = () => (globalThis.performance?.now?.() ?? Date.now()) }) {
  const budget = (TIERS[tier] || TIERS.interactive)[task] || { start: 100, perItem: 2 };
  let load = 0;
  if (warm && cases.length) {
    const t0 = now();
    await ai.call(task, cases[0].input, { only: provider, priority: tier === 'interactive' ? 'now' : 'idle', fresh: true, ...cases[0].opts });
    load = now() - t0;
  }
  const loadOver = load > (LOAD_BUDGET[tier] ?? LOAD_BUDGET.interactive);
  let total = 0, failed = 0, over = 0, max = 0, spent = 0;
  for (const c of cases) {
    const t0 = now();
    const r = await ai.call(task, c.input, { only: provider, priority: tier === 'interactive' ? 'now' : 'idle', fresh: true, ...c.opts });
    const ms = now() - t0;
    spent += ms; max = Math.max(max, ms);
    if (!r.ok) { failed++; continue; }
    if (!r.cached && ms > budget.start + budget.perItem * (c.input.items?.length || 1)) over++;
    total += Math.max(0, Math.min(1, Number(c.mark(r.output)) || 0));
  }
  const n = cases.length || 1;
  return Object.freeze({ provider, task, tier, cases: cases.length, score: total / n, ms: Object.freeze({ mean: spent / n, max }),
    load: Object.freeze({ ms: load, over: loadOver }), over, failed, passed: !failed && !over && !loadOver });
}

// The maker's verdicts as a judge exam: each kept or refused suggestion is a case; a provider's
// mark is 1 when its score falls on the side of the verdict (0.5 the line).
// verdicts: [{ act, kept, says?, features?, items }] (items: the marks it was about, as task items).
export function verdictCases(verdicts) {
  return verdicts.filter((v) => Array.isArray(v.items) && v.items.length).map((v) => ({
    input: { act: v.act, items: v.items, ...(v.says ? { says: v.says } : {}), ...(v.features ? { features: v.features } : {}) },
    mark: (out) => (v.kept ? out.score >= 0.5 : out.score < 0.5) ? 1 : 0,
  }));
}

// Two providers on one exam, side by side: { a, b, better } (better: the id that scored higher
// and passed, or null when neither or both tie).
export async function compare(ai, { a, b, task, cases, tier, now }) {
  const ra = await exam(ai, { provider: a, task, cases, tier, now });
  const rb = await exam(ai, { provider: b, task, cases, tier, now });
  const good = (r) => (r.passed ? r.score : -1);
  const better = good(ra) === good(rb) ? null : good(ra) > good(rb) ? a : b;
  return Object.freeze({ a: ra, b: rb, better: better && good(better === a ? ra : rb) >= 0 ? better : null });
}
