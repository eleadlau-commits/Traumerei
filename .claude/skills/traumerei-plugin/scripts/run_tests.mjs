// Runs a plugin's tests/*.test.js with Node and no repo: `node run_tests.mjs path/to/my-plugin`.
// 'folio/testing' is a copy of Folio's tiny test library; 'folio' is a stand-in (Feature, ui.el
// making plain objects), so test the plain functions in rules.js, not the screen. In the repo,
// `python build.py check <id>` runs the same files in a real browser, with the whole suite.
import { register } from 'node:module';
import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TESTING = `
const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
const show = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
export const assert = {
  ok(v, m = 'Expected a true value, got ' + show(v)) { if (!v) throw new Error(m); },
  equal(a, e, m) { if (a !== e) throw new Error(m || 'Expected ' + show(e) + ', got ' + show(a)); },
  deepEqual(a, e, m) { if (show(a) !== show(e)) throw new Error(m || 'Expected ' + show(e) + ', got ' + show(a)); },
  match(t, p, m) { if (!p.test(String(t))) throw new Error(m || 'Expected ' + show(t) + ' to match ' + p); },
  throws(fn, p, m) { try { fn(); } catch (err) { if (p && !p.test(err.message)) throw new Error(m || 'Wrong error: ' + err.message); return; } throw new Error(m || 'Expected an error, but none was thrown'); },
};
export async function runAll() {
  let failed = 0;
  for (const t of tests) { try { await t.fn(); console.log('PASS ' + t.name); } catch (err) { failed++; console.log('FAIL ' + t.name + '\\n     ' + err.message); } }
  console.log('\\n' + (tests.length - failed) + ' passed, ' + failed + ' failed');
  return failed;
}`;
const FOLIO = `
export class Feature { constructor(app, manifest) { this.app = app; this.id = manifest?.id; } start() {} stop() {} use() { return null; } }
export class App {}
export const ui = { el: (tag, attrs = {}, ...kids) => ({ tag, attrs, kids: kids.flat() }) };
export const time = {};
export const VERSION = '0';`;
const data = (code) => 'data:text/javascript,' + encodeURIComponent(code);
const hooks = `
const MAP = { 'folio/testing': ${JSON.stringify(data(TESTING))}, 'folio': ${JSON.stringify(data(FOLIO))} };
export async function resolve(spec, ctx, next) { return MAP[spec] ? { url: MAP[spec], shortCircuit: true } : next(spec, ctx); }`;
register(data(hooks));

const folder = resolve(process.argv[2] || '.');
let files = [];
try { files = readdirSync(join(folder, 'tests')).filter((f) => f.endsWith('.test.js')).sort(); } catch {}
if (!files.length) { console.log(`No tests in ${join(folder, 'tests')}`); process.exit(1); }
for (const f of files) await import(pathToFileURL(join(folder, 'tests', f)).href);
const { runAll } = await import('folio/testing');
process.exit((await runAll()) ? 1 : 0);
