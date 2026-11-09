// Speed budgets: the check on every pull request fails when one is broken.
//
//   node tests/speed.mjs [path to the built page]   (default standalone/traumerei.html)
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
import { statSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import * as model from '../app/core/world/model.js';

const need = createRequire(import.meta.url);
const { chromium } = (() => { try { return need('playwright'); } catch { return need('playwright-core'); } })();

const BUDGET = { open: 800, enter: 350, keydown: 20, buildKB: 2048 };
const RUNS = 3;
const page = resolve(process.argv[2] || 'standalone/traumerei.html');

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

async function once(browser, world) {
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript((s) => { localStorage.clear(); localStorage.setItem('traumerei.world.world3', s); }, world);
  await p.addInitScript(watch);
  await p.goto(pathToFileURL(page).href);
  await p.getByRole('button', { name: 'Create', exact: true }).first().click();
  const tile = p.locator('.rooms-tile[data-room="messy"]');
  await tile.focus();

  // Room open.
  const open = (await timed(p, 'Enter')).frame;
  const drawn = await p.evaluate(() => document.querySelectorAll('.room-world .room-thought').length);
  if (drawn < 1500) throw new Error(`the room showed ${drawn} of 1,500 thoughts`);
  await p.waitForTimeout(800); // the zoom settles

  // The first letter starts a thought; the rest are typed into it; Enter keeps it; then the next.
  const first = (await timed(p, 'a')).frame;
  let keydown = await typed(p, ' new thought');
  const enter = (await timed(p, 'Enter')).frame;
  const next = (await timed(p, 'a')).frame;
  keydown = Math.max(keydown, await typed(p, 'nd the next one'));
  const kept = await p.evaluate(() => document.querySelectorAll('.room-world .room-thought').length);
  if (kept < 1501) throw new Error(`Enter left ${kept} thoughts in the room, not 1,501`);
  if (errors.length) throw new Error(`the page failed: ${errors[0]}`);
  await p.close();
  return { open, first: Math.max(first, next), enter, keydown };
}

const browser = await chromium.launch(process.env.SPEED_BROWSER ? { executablePath: process.env.SPEED_BROWSER } : {});
const world = fixture();
const runs = [];
try {
  for (let i = 0; i < RUNS; i++) runs.push(await once(browser, world));
} finally {
  await browser.close();
}

const got = {
  open: middle(runs.map((r) => r.open)),
  first: middle(runs.map((r) => r.first)),
  enter: middle(runs.map((r) => r.enter)),
  keydown: middle(runs.map((r) => r.keydown)),
  buildKB: statSync(page).size / 1024,
};
const rows = [
  ['Room of 1,500 opens', got.open, BUDGET.open, 'ms'],
  ['First letter starts a thought', got.first, BUDGET.enter, 'ms'],
  ['Enter keeps a thought', got.enter, BUDGET.enter, 'ms'],
  ['Longest key typed into a thought', got.keydown, BUDGET.keydown, 'ms'],
  ['One-file page', got.buildKB, BUDGET.buildKB, 'KB'],
];
let failed = 0;
for (const [name, v, max, unit] of rows) {
  const ok = v <= max;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${v.toFixed(unit === 'KB' ? 0 : 1)} ${unit} (budget ${max} ${unit})`);
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::error::${name} took ${v.toFixed(0)} ${unit}, over its budget of ${max} ${unit}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['### Speed budgets', '| | took | budget |', '|---|---|---|',
    ...rows.map(([n, v, m, u]) => `| ${v <= m ? '✓' : '✗'} ${n} | ${v.toFixed(u === 'KB' ? 0 : 1)} ${u} | ${m} ${u} |`), ''].join('\n') + '\n');
}
process.exit(failed ? 1 : 0);
