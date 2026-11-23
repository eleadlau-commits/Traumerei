// Speed budgets: the check on every pull request fails when one is broken.
//
//   node tests/speed.mjs [path to the built page]   (default standalone/traumerei.html)
//   node tests/speed.mjs --plugin packed/<id>.traumplug --world <sample> [--pad 1500] [page]
//
// With --plugin, the plugin is imported before the page starts (as Settings → Plugins keeps an
// import) and the timings are taken in the --world room instead of Messy thoughts, seen through
// the mode it was saved in: a plugin's room open, Enter and keydown, held to the same budgets.
// --world is a .traum file, or a plugin's tests/sample.js (it exports sampleWorld(lib), as Book's
// does). The room is filled up to --pad thoughts (1,500 by default) with plain ones, so a plugin's
// room is measured at the size the core's is. The build row is then the plugin file's size.
//
// Opens the built one-file page in Chromium with a room of 1,500 thoughts saved on the device and
// measures what a person feels:
//   room open  from Enter on the room's square to the first frame with every thought drawn  0.8 s
//   Enter      from Enter on a thought being written to the first frame with it kept         0.35 s
//   first key  from the letter that starts a thought to the first frame with it shown         0.35 s
//   keydown    the longest a key typed into a thought keeps the page busy                    20 ms
//   build      the one-file page                                                            under 2 MB
// Each timing is the middle of three runs, so one slow moment on the machine does not fail it.
// Needs Playwright or playwright-core (CI installs playwright-core and points SPEED_BROWSER at its
// Chrome).

import { createRequire } from 'module';
import { readFileSync, statSync } from 'fs';
import { resolve, basename } from 'path';
import { pathToFileURL } from 'url';
import * as model from '../app/core/world/model.js';
import * as lib from '../app/core/world/lib.js';

const need = createRequire(import.meta.url);
const { chromium } = (() => { try { return need('playwright'); } catch { return need('playwright-core'); } })();

const BUDGET = { open: 800, enter: 350, keydown: 20, buildKB: 2048 };
const RUNS = 3;
const opts = parseArgs(process.argv.slice(2));
const page = resolve(opts.page || 'standalone/traumerei.html');

// [page] --plugin <file> --world <file> --pad <n>
function parseArgs(argv) {
  const o = { page: null, plugin: null, world: null, pad: 1500 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plugin' || a === '--world' || a === '--pad') {
      const v = argv[++i];
      if (v == null) { console.error(`${a} needs a value`); process.exit(2); }
      o[a.slice(2)] = a === '--pad' ? Number(v) : v;
    } else if (a.startsWith('--')) { console.error(`Unknown option ${a}`); process.exit(2); }
    else o.page = a;
  }
  if (o.plugin && !o.world) { console.error('--plugin needs --world: the room to time it in'); process.exit(2); }
  if (!Number.isInteger(o.pad) || o.pad < 0) { console.error('--pad is a number of thoughts'); process.exit(2); }
  return o;
}

// The plugin's room: a .traum file landed in an empty world, or a sample module's sampleWorld(lib).
// Filled up to `pad` thoughts at home in it. Returns { world (JSON), room (id), lines, mode }.
async function pluginWorld(file, pad) {
  let w, room;
  if (/\.traum$/.test(file)) {
    const got = lib.traum.read(readFileSync(file, 'utf8'));
    if (!got) throw new Error(`${file} is not a .traum file this app reads`);
    w = model.emptyWorld(1);
    const out = model.landTables(w, got.tables, got.root, { now: 2 });
    if (out.why) throw new Error(`${file} does not land: ${out.why}`);
    room = out.id;
  } else {
    const mod = await import(pathToFileURL(resolve(file)).href);
    if (typeof mod.sampleWorld !== 'function') throw new Error(`${file} exports no sampleWorld(lib)`);
    ({ w, room } = mod.sampleWorld(lib));
  }
  if (!w?.things?.[room]) throw new Error(`${file} gives no room`);
  const lines = () => model.children(w, room).filter((th) => th.kind === 'line').length;
  let t = 1_800_000_000_000;
  for (let n = lines(); n < pad; n++) model.create(w, room, { kind: 'line', text: `thought ${n} ${'word '.repeat(1 + (n % 12))}`.trim() }, t++);
  return { world: JSON.stringify(w), room, lines: lines(), mode: w.views?.[room]?.mode || null };
}

// A room of 1,500 thoughts in trains of one to nine, spread over the room the way people write.
function fixture(n = 1500) {
  let seed = 7;
  const r = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const w = model.emptyWorld(1);
  let t = 10, made = 0;
  while (made < n) {
    const train = model.startTrain(w, model.MESSY, Math.round(r() * 4000), Math.round(r() * 3000), t++);
    const len = 1 + Math.floor(r() * 9);
    for (let k = 0; k < len && made < n; k++, made++) {
      model.addThought(w, train.id, `thought ${made} ${'word '.repeat(1 + Math.floor(r() * 12))}`.trim(), t++);
    }
  }
  return JSON.stringify(w);
}

// Inside the page, for the next press of `key`: how long its handling keeps the page busy (from the
// keydown to the end of the text it types, measured at the window, the last to hear each event),
// and how long until the frame after it is painted.
function watch() {
  window.__arm = (key) => { window.__got = new Promise((settle) => {
    let t0 = 0, end = 0;
    const mark = () => { end = performance.now(); };
    const start = (e) => {
      if (e.key !== key) return;
      window.removeEventListener('keydown', start, true);
      t0 = end = performance.now();
      window.addEventListener('keydown', mark, { once: true });
      window.addEventListener('input', mark, { once: true });
      requestAnimationFrame(() => setTimeout(() => {
        window.removeEventListener('keydown', mark);
        window.removeEventListener('input', mark);
        settle({ busy: end - t0, frame: performance.now() - t0 });
      }, 0));
    };
    window.addEventListener('keydown', start, true);
  }); };
}

// Presses a key and returns what watch() saw. Armed (and awaited) first: input can reach the page
// before a script sent with it.
async function timed(p, key, press = key) {
  await p.evaluate((k) => window.__arm(k), key);
  await p.keyboard.press(press);
  return p.evaluate(() => window.__got);
}

async function typed(p, text) {
  let worst = 0;
  for (const ch of text) {
    const b = (await timed(p, ch, ch === ' ' ? 'Space' : ch)).busy;
    if (process.env.SPEED_DEBUG) console.log(JSON.stringify(ch), b.toFixed(1));
    worst = Math.max(worst, b);
  }
  return worst;
}

const middle = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function once(browser, { world, room, plugin, lines, mode }) {
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(({ s, imported }) => {
    localStorage.clear();
    localStorage.setItem('traumerei.world.world3', s);
    // An import Settings → Plugins kept: started with the app, as after a restart.
    if (imported) localStorage.setItem('traumerei.plugins.imported', JSON.stringify(imported));
  }, { s: world, imported: plugin ? { [plugin.id]: { text: plugin.text, at: 1 } } : null });
  await p.addInitScript(watch);
  await p.goto(pathToFileURL(page).href);
  // The app opens on the rooms page (Home ships as a plugin file since 1.0.4).
  const tile = p.locator(`.rooms-tile[data-room="${room}"]`);
  await tile.waitFor();
  if (plugin) await p.waitForFunction(() => document.readyState === 'complete');
  await tile.focus();

  const say = (what) => { if (process.env.SPEED_DEBUG) console.log(what); };
  say('room tile ready');
  // Room open.
  const open = (await timed(p, 'Enter')).frame;
  say(`room open ${open.toFixed(1)} ms`);
  const drawn = await p.evaluate(() => document.querySelectorAll('.room-world .room-thought').length);
  if (!plugin && drawn < lines) throw new Error(`the room showed ${drawn} of ${lines} thoughts`);
  if (plugin && !drawn) throw new Error('the room showed no thoughts');
  if (plugin && mode) {
    // Seen through the plugin's mode: a plugin that did not start leaves the room in another.
    const seen = await p.evaluate(() => document.querySelector('[data-mode]')?.dataset.mode || null);
    if (seen !== mode) throw new Error(`the room opened in mode ${seen}, not ${mode}: did ${plugin.id} start?`);
  }
  await p.waitForTimeout(800); // the zoom settles

  // The first letter starts a thought; the rest are typed into it; Enter keeps it; then the next.
  const first = (await timed(p, 'a')).frame;
  let keydown = await typed(p, ' new thought');
  const enter = (await timed(p, 'Enter')).frame;
  const next = (await timed(p, 'a')).frame;
  keydown = Math.max(keydown, await typed(p, 'nd the next one'));
  const kept = await p.evaluate(() => document.querySelectorAll('.room-world .room-thought').length);
  if (kept <= drawn) throw new Error(`Enter left ${kept} thoughts drawn in the room, no more than the ${drawn} it opened with`);
  if (errors.length) throw new Error(`the page failed: ${errors[0]}`);
  await p.close();
  return { open, first: Math.max(first, next), enter, keydown };
}

const browser = await chromium.launch(process.env.SPEED_BROWSER ? { executablePath: process.env.SPEED_BROWSER } : {});
let setup;
try {
  if (opts.plugin) {
    const text = readFileSync(opts.plugin, 'utf8');
    const id = /"id"\s*:\s*"([a-z][a-z0-9-]*)"/.exec(text)?.[1];
    if (!id) throw new Error(`${opts.plugin} is not a .traumplug (no id in its manifest)`);
    setup = { ...(await pluginWorld(opts.world, opts.pad)), plugin: { id, text } };
  } else setup = { world: fixture(), room: 'messy', lines: 1500, plugin: null };
} catch (err) { await browser.close(); console.error(err.message); process.exit(1); }
const runs = [];
try {
  for (let i = 0; i < RUNS; i++) runs.push(await once(browser, setup));
} finally {
  await browser.close();
}

const got = {
  open: middle(runs.map((r) => r.open)),
  first: middle(runs.map((r) => r.first)),
  enter: middle(runs.map((r) => r.enter)),
  keydown: middle(runs.map((r) => r.keydown)),
  buildKB: statSync(opts.plugin || page).size / 1024,
};
const what = setup.plugin ? `${setup.plugin.id}: ` : '';
const rows = [
  [`${what}Room of ${setup.lines.toLocaleString('en')} opens`, got.open, BUDGET.open, 'ms'],
  ['First letter starts a thought', got.first, BUDGET.enter, 'ms'],
  ['Enter keeps a thought', got.enter, BUDGET.enter, 'ms'],
  ['Longest key typed into a thought', got.keydown, BUDGET.keydown, 'ms'],
  [setup.plugin ? `${what}plugin file (${basename(opts.plugin)})` : 'One-file page', got.buildKB, BUDGET.buildKB, 'KB'],
];
for (const r of rows.slice(1, 4)) r[0] = what + r[0];
let failed = 0;
for (const [name, v, max, unit] of rows) {
  const ok = v <= max;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${v.toFixed(unit === 'KB' ? 0 : 1)} ${unit} (budget ${max} ${unit})`);
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::error::${name} took ${v.toFixed(0)} ${unit}, over its budget of ${max} ${unit}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [`### Speed budgets${setup.plugin ? `: ${setup.plugin.id}` : ''}`, '| | took | budget |', '|---|---|---|',
    ...rows.map(([n, v, m, u]) => `| ${v <= m ? '✓' : '✗'} ${n} | ${v.toFixed(u === 'KB' ? 0 : 1)} ${u} | ${m} ${u} |`), ''].join('\n') + '\n');
}
process.exit(failed ? 1 : 0);
