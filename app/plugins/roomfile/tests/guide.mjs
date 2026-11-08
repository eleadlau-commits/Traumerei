// The format guide can't fall behind the code: FORMAT.md has a section for every kind of object
// and every ontology there is, and every example file in it reads with nothing reported.
// Run with `node app/plugins/roomfile/tests/guide.mjs` (every pull request runs it: check.yml).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as lib from '../../../core/world/lib.js';
import { bind } from '../world.js';
import { ITEMS } from '../../../core/world/items/index.js';
import { gather } from '../../../core/world/ontologies/index.js';
import { emptyWorld } from '../../../core/world/model.js';
import { parse } from '../grammar.js';
import { importRoom, exportRoom } from '../traum.js';
import { bind as bindProust } from '../../proust/world.js';
import { surface } from '../../../core/api/api.js';
import { proust } from '../../proust/rules.js';

bind(lib);
bindProust(surface(lib)); // Proust is a plugin: it gets the world's rules through the plugin API
const guide = readFileSync(fileURLToPath(new URL('../FORMAT.md', import.meta.url)), 'utf8');
const ontologies = gather([proust]);
const wrong = [];

for (const kind of [...Object.keys(ITEMS), 'group', 'relation']) {
  if (!guide.includes(`\n### Kind: ${kind}\n`)) wrong.push(`FORMAT.md has no "### Kind: ${kind}" section.`);
}
for (const o of ontologies) {
  if (!guide.includes(`\n### Ontology: ${o.id}\n`)) wrong.push(`FORMAT.md has no "### Ontology: ${o.id}" section.`);
  if (!o.traum) wrong.push(`The ontology ${o.id} has no traum member, so it can't write its # In ${o.id} section.`);
}
for (const kind of Object.keys(ITEMS)) if (!ITEMS[kind].traum) wrong.push(`The item kind ${kind} has no traum member.`);

// Every fenced example that is a whole file reads with nothing reported (the picture data is cut short
// in the guide, so a picture there reads as one that couldn't be fetched, which is said, not wrong).
const examples = [...guide.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]).filter((t) => /^# Objects$/m.test(t));
for (const text of examples) {
  const w = emptyWorld(1);
  const { room, report } = importRoom(w, parse(text), { ontologies, now: 10 });
  const real = report.filter((r) => !/couldn't be fetched/.test(r));
  if (!room || real.length) wrong.push(`An example in FORMAT.md doesn't read cleanly:\n  ${real.join('\n  ')}\n${text.split('\n').slice(0, 6).join('\n')}`);
  else if (!exportRoom(w, room.id, { ontologies })) wrong.push('An example in FORMAT.md exports to nothing.');
}

if (wrong.length) { console.error(wrong.join('\n')); process.exit(1); }
console.log(`FORMAT.md covers ${Object.keys(ITEMS).length + 2} kinds and ${ontologies.length} ontologies; ${examples.length} examples read cleanly.`);
