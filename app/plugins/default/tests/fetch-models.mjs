// Downloads the models in models.js into a folder laid out like the plugin's store, checks each
// file's size and sha256 against the table, and writes engine.json there, so a traumerei-engine
// started with --store <folder> can answer. engine.yml runs it before the exam.
//
//   node app/plugins/default/tests/fetch-models.mjs <folder> [tier]
//
// A file whose url still says /resolve/main/, or whose size or checksum is not filled in yet, is
// surveyed instead: its revision, size and sha256 are printed (and written to <folder>/found.json)
// so they can be pinned in models.js. Fails when a filled-in size or checksum doesn't match.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODELS, pick } from '../models.js';
import { configFor, TASKS } from '../provider.js';

const [folder, tier = 'mid'] = process.argv.slice(2);
if (!folder) { console.error('Say the folder: node fetch-models.mjs <folder> [tier]'); process.exit(2); }
mkdirSync(folder, { recursive: true });

const found = {};
let bad = 0;
const revisions = new Map(); // repo → commit of main
for (const id of new Set(TASKS.map((task) => pick(tier, task)))) {
  for (const f of Object.values(MODELS[id].files)) {
    const [, repo, rev] = f.url.match(/^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/([^/]+)\//) || [];
    if (repo && rev === 'main' && !revisions.has(repo)) {
      const r = await fetch(`https://huggingface.co/api/models/${repo}/revision/main`);
      revisions.set(repo, r.ok ? (await r.json()).sha : null);
    }
    const res = await fetch(f.url);
    if (!res.ok) { console.error(`${f.name}: ${f.url} answered ${res.status}`); bad++; continue; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(folder, f.name), bytes);
    found[f.name] = { url: f.url, bytes: bytes.length, sha256, ...(rev === 'main' ? { revision: revisions.get(repo) } : {}) };
    const surveyed = rev === 'main' || !f.bytes || !f.sha256;
    if (!surveyed && (f.bytes !== bytes.length || f.sha256 !== sha256)) {
      console.error(`${f.name}: models.js says ${f.bytes} bytes, sha256 ${f.sha256}; the file is ${bytes.length} bytes, sha256 ${sha256}`);
      bad++;
    }
    console.log(`${surveyed ? 'surveyed' : 'checked '} ${f.name}: ${bytes.length} bytes, sha256 ${sha256}${rev === 'main' ? `, main is ${revisions.get(repo)}` : ''}`);
  }
}

// engine.json as the plugin writes it, with the checksums of the files as they are here.
const config = configFor(tier);
if (config.embed) {
  config.embed.model_sha256 = found[config.embed.model]?.sha256 || config.embed.model_sha256;
  config.embed.tokenizer_sha256 = found[config.embed.tokenizer]?.sha256 || config.embed.tokenizer_sha256;
}
writeFileSync(join(folder, 'engine.json'), JSON.stringify(config));
writeFileSync(join(folder, 'found.json'), JSON.stringify(found, null, 2));
process.exit(bad ? 1 : 0);
