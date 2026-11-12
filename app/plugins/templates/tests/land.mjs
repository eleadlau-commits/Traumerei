// Every template room reads as traum/3 with nothing reported, lands in an empty world with no
// plugin loaded, and has open gaps (a template is a room that is not finished yet).
// Run with `node app/plugins/templates/tests/land.mjs` (every pull request runs it: check.yml).

import * as model from '../../../core/world/model.js';
import * as X from '../../../core/world/traum.js';
import { TEMPLATES as FOUR, SAMPLE } from '../rules.js';

const TEMPLATES = [...FOUR, SAMPLE];

const NOW = new Date(2026, 10, 12, 16).getTime();
let bad = 0;
for (const tpl of TEMPLATES) {
  const got = X.read(tpl.make(NOW));
  if (!got) { console.error(`${tpl.name}: not read as traum/3`); bad++; continue; }
  if (got.report.length) { console.error(`${tpl.name} reports:\n  ${got.report.join('\n  ')}`); bad++; }
  const w = model.emptyWorld(1000);
  const out = model.landTables(w, got.tables, got.root, { now: NOW });
  if (out.why) { console.error(`${tpl.name}: does not land: ${out.why}`); bad++; continue; }
  const t = model.tablesOf(w, out.id);
  const openGaps = t.gaps.filter((g) => g.state === 'open').length;
  if (!openGaps) { console.error(`${tpl.name}: no open gaps`); bad++; }
  console.log(`${tpl.name}: ${t.marks.length} marks, ${openGaps} open gaps, ${t.moments.filter((m) => m.state).length} returns`);
}
if (bad) process.exit(1);
console.log(`Templates: ${TEMPLATES.length} rooms read and land with no plugin loaded.`);
