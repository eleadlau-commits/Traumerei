// `t.ai`: the AI framework as a plugin sees it (app/core/AI.md). The `ai` service (app/core/ai)
// picks and runs providers; this hands a plugin what it may use of it, gives providers the read
// half of the tables (never a write), and reads the maker's verdicts out of the tables, where they
// are stored once: a suggestion is a mark of kind `suggestion`, its subjects are its `provokes`
// links, and its verdict is its gap to the maker, resolved by a link (kept) or by judgement
// (refused).

const row = (o) => Object.freeze(o);
const none = (task) => Promise.resolve(row({ ok: false, task, reason: 'The AI framework is not there', tried: Object.freeze([]) }));

// ai: the `ai` service, or null; tables: the plugin's kernel tables; reads: their read half.
export function aiFor(ai, tables, reads) {
  const { marks, links, gaps } = tables;
  const item = (id) => { const m = marks.get(id); return m ? row({ id, text: marks.text(id), ...(m.at ? { at: m.at } : {}) }) : null; };
  // Every verdict the maker gave, oldest first: { suggestion, task, act, provider, version, kept, says, features, items, at }.
  const verdicts = (task = null) => marks.ofKind('suggestion').map((m) => {
    const g = gaps.of(m.id);
    if (!g || g.state !== 'resolved' || g.derived) return null;
    const [provider, version] = String(m.by || '').split('@');
    const t = m.task || (m.act === 'group' ? 'group' : 'link');
    const features = String(m.features || '').split(' ').filter(Boolean).map(Number);
    return row({
      suggestion: m.id, task: t, act: m.act || 'link', provider: provider || null, version: version || null,
      kept: !!g.resolvedBy && g.resolvedBy !== 'judgement', says: m.says || '', features: Object.freeze(features.every(Number.isFinite) ? features : []),
      items: Object.freeze(links.from(m.id, 'provokes').map((l) => item(l.to)).filter(Boolean)), at: g.resolvedAt ?? null,
    });
  }).filter((v) => v && (!task || v.task === task)).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  const frozenList = (list) => Object.freeze(list);
  return Object.freeze({
    tasks: () => frozenList(ai ? ai.tasks().map((name) => row({ name, version: ai.schema(name).version, note: ai.schema(name).note })) : []),
    schema: (task) => (ai ? ai.schema(task) : null),
    providers: (task = null) => (ai ? ai.list(task) : frozenList([])),
    first: (task, context = null) => (ai ? ai.first(task, context) : null),
    call: (task, input, opts = {}) => (ai ? ai.call(task, input, { ...opts, reads, verdicts: (which = task) => verdicts(which) }) : none(task)),
    verdict: (v) => (ai ? ai.verdict(v) : false),
    verdicts: (task = null) => frozenList(verdicts(task)),
    // Scores a provider on an exam (app/core/ai/exam.js): cases [{ input, mark(output) → 0..1 }];
    // for the judge task, without cases, the maker's own verdicts.
    exam: ({ provider, task, cases = null }) => {
      if (!ai) return Promise.resolve(null);
      const list = cases || (task === 'judge' ? ai.verdictCases(verdicts()) : []);
      return ai.exam({ provider, task, cases: list.map((c) => ({ ...c, opts: { reads, verdicts: () => verdicts(task), ...c.opts } })) });
    },
    item,
    // Ready-made providers for the three bridges (app/core/ai/bridges.js): worker(o), http(o), openai(o).
    bridges: ai?.bridges || Object.freeze({}),
  });
}
