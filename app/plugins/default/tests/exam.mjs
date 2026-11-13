// The default system's exam for embed, against Provoke's reader, through the framework's own
// harness (app/core/ai/exam.js `compare`), held to the task's speed budgets (tasks.js TIERS).
// Needs a running engine with the models in its store (engine.yml does this on every pull request):
//
//   ENGINE_URL=http://127.0.0.1:<port> node app/plugins/default/tests/exam.mjs [--json out.json]
//
// Three exams: quality (same-topic neighbours on the 60-thought general exam and on parts of it);
// cold speed (a search-sized call, a 300-thought room and a 1,500-thought room, none seen before);
// and reread speed (a 1,500-thought room the engine has seen, plus 30 new thoughts: the usual
// case once Default.js has warmed a room). Each runs in the interactive tier (the person waits)
// and the background tier. Fails unless `default` passes every exam and scores at least as well
// as the reader on quality.

import { makeAi } from '../../../core/ai/service.js';
import { http } from '../../../core/ai/bridges.js';
import { compare } from '../../../core/ai/exam.js';
import { provider as reader } from '../../provoke/provider.js';
import { ID, VERSION, TASKS } from '../provider.js';
import { THOUGHTS, sameTopic, unitRows, room } from './cases.js';

const url = process.env.ENGINE_URL;
if (!url) { console.error('Set ENGINE_URL to a running traumerei-engine.'); process.exit(2); }
const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

const def = http({ id: ID, name: 'Träumerei (default)', version: VERSION, tasks: TASKS, url, hints: { speed: 'fast', memory: 120 } });
const ai = makeAi({ providers: () => [def, reader()], desktop: true, settings: { allowed: () => true } });

const strip = ({ id, text }) => ({ id, text });
const quality = (items, k) => ({ input: { items: items.map(strip) }, mark: (o) => sameTopic(items, o.vectors, k) });
const topics = [...new Set(THOUGHTS.map((x) => x.topic))];
const EXAMS = {
  quality: [
    quality(THOUGHTS, 5),
    quality(THOUGHTS.filter((x) => topics.slice(0, 2).includes(x.topic)), 3),
    quality(THOUGHTS.filter((x) => topics.slice(2, 5).includes(x.topic)), 3),
    quality(THOUGHTS.filter((x) => x.topic !== topics[5]), 5),
  ],
};
const unit = (o) => (unitRows(o.vectors) ? 1 : 0);
const seen = room(1500, 'seen ');
const cold = (tier) => [1, 300, 1500].map((n) => ({ input: { items: n === 1 ? [{ id: 'q', text: `why does bread need patience (${tier})` }] : room(n, `${tier} ${Date.now()} `) }, mark: unit }));
const reread = (tier) => [0, 1, 2].map((k) => ({ input: { items: [...seen, ...room(30, `${tier} new ${k} `).map((x) => ({ ...x, id: `n${x.id}` }))] }, mark: unit }));

// The engine sees the reread room once, as Default.js's warming would.
await ai.call('embed', { items: seen }, { only: ID, priority: 'idle' });

const rows = [];
let bad = 0;
for (const tier of ['interactive', 'background']) {
  for (const [name, cases] of Object.entries({ ...EXAMS, cold: cold(tier), reread: reread(tier) })) {
    const r = await compare(ai, { a: ID, b: 'provoke-reader', task: 'embed', cases, tier });
    for (const x of [r.a, r.b]) {
      rows.push({ exam: name, tier, provider: x.provider, score: +x.score.toFixed(3), meanMs: Math.round(x.ms.mean), maxMs: Math.round(x.ms.max), loadMs: Math.round(x.load.ms), over: x.over, failed: x.failed, passed: x.passed });
    }
    if (!r.a.passed) { bad++; console.error(`default did not pass ${name} (${tier}): ${r.a.over} over budget, ${r.a.failed} failed, load over: ${r.a.load.over}`); }
    if (name === 'quality' && r.a.score < r.b.score) { bad++; console.error(`default scored below the reader on quality (${tier})`); }
  }
}
console.table(rows);
if (out) (await import('node:fs')).writeFileSync(out, JSON.stringify({ engine: url, version: VERSION, rows }, null, 2));
process.exit(bad ? 1 : 0);
