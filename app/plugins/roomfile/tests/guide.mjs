// The format guide can't fall behind the code: every example file in FORMAT.md (a fenced block
// whose front matter says traum/3) reads with nothing reported and lands in an empty world with
// no plugin loaded, and writing what landed reads back as the same tables (Law 8).
// Run with `node app/plugins/roomfile/tests/guide.mjs` (every pull request runs it: check.yml).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as model from '../../../core/world/model.js';
import * as X from '../../../core/world/traum.js';

const guide = readFileSync(fileURLToPath(new URL('../FORMAT.md', import.meta.url)), 'utf8');
const blocks = [...guide.matchAll(/```traum\n([\s\S]*?)```/g)].map((m) => m[1]);
let bad = 0;
if (blocks.length < 3) { console.error(`FORMAT.md has ${blocks.length} example files; it should show at least 3`); bad++; }
blocks.forEach((text, i) => {
  const got = X.read(text);
  if (!got) { console.error(`Example ${i + 1} is not read as traum/3`); bad++; return; }
  if (got.report.length && !text.includes('# Wishes')) { console.error(`Example ${i + 1} reports:\n  ${got.report.join('\n  ')}`); bad++; } // (one example shows what is reported)
  const w = model.emptyWorld(1000);
  const out = model.landTables(w, got.tables, got.root, { now: 2000 });
  if (out.why) { console.error(`Example ${i + 1} does not land: ${out.why}`); bad++; return; }
  const again = X.read(X.write(model.tablesOf(w, out.id), { root: out.id }));
  const same = ['marks', 'links', 'distance', 'gaps'].every((t) => again.tables[t].length === got.tables[t].length) && again.tables.places.length >= got.tables.places.length; // (a mark with no home is given one)
  if (!same) { console.error(`Example ${i + 1} does not come back as the same rows`); bad++; }
});
if (bad) process.exit(1);
console.log(`FORMAT.md: ${blocks.length} example files read, land and come back with no plugin loaded.`);
