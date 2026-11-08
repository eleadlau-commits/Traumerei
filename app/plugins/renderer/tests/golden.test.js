// Golden test: a fingerprint (cyrb53) of every Washi and Plain output for a fixed picture and seed,
// recorded before the modes were split into engine/modes/. Any change to what Washi or Plain draw,
// down to one byte, fails it. If a change is meant to alter the look, record the new values here.

import { test, assert } from 'folio/testing';
import { cyrb53 } from '../engine/random.js';
import { Engine, DEFAULTS } from '../engine/index.js';
import { Spontaneity } from '../engine/spontaneity.js';

// cyrb53 of a byte array, in 4096-byte chunks folded together.
function hash(bytes) {
  let h = 0;
  for (let i = 0; i < bytes.length; i += 4096) {
    h = cyrb53(String.fromCharCode(...bytes.subarray(i, i + 4096)), h % 4294967296);
  }
  return h.toString(16);
}
const hashText = (s) => cyrb53(s).toString(16);

// A gradient with a bright disc and a terracotta block, so both modes have something to work with.
function picture(W, H) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = 4 * (y * W + x);
      const disc = Math.hypot(x - W * 0.3, y - H * 0.6) < H * 0.2 ? 120 : 0;
      const block = x > W * 0.6 && y < H * 0.5;
      rgba[q] = block ? 192 : Math.min(255, (255 * x) / W + disc);
      rgba[q + 1] = block ? 96 : Math.min(255, (255 * y) / H + disc);
      rgba[q + 2] = block ? 58 : 90;
      rgba[q + 3] = 255;
    }
  }
  return rgba;
}

const W = 96;
const H = 64;
const ANCHOR = { x: 0.4, y: 0.55 };
const SHIFTED = { ...DEFAULTS, tint: '#d8e4f0', baseL: 0.05, baseW: -0.02 };

function washi(P) {
  const e = new Engine();
  e.load(picture(W, H), W, H);
  const r = e.mask(P, ANCHOR);
  const out = {};
  for (const v of ['monochrome', 'mask', 'field', 'base', 'pattern', 'washi', 'living']) out[v] = hash(e.view(v, P, r).rgba);
  const live = e.living(P, e.view('living', P, r).rgba);
  const rects = [];
  for (let t = 0; t <= 10; t += 0.25) {
    rects.push(live.frame(t).join(';'));
    if (t === 3 || t === 10) out[`live${t}`] = hash(live.rgba);
  }
  out.rects = hashText(rects.join('|'));
  return out;
}

function plain(P) {
  const e = new Engine();
  e.load(picture(W, H), W, H);
  const out = {};
  for (const v of ['base', 'pattern', 'plain', 'living']) out[v] = hash(e.plainView(v, P).rgba);
  const g = e.glow(P);
  out.glow = hashText(JSON.stringify([g.colour, g.at(0), g.at(3), g.at(10)]));
  return out;
}

const GOLDEN = {
  washi: { monochrome: '156278ad1a26b3', mask: 'ac6fa1a3bc09', field: '1c5e6e2d4efc6b', base: '9649722d72c46', pattern: '1451aa97ee6867', washi: '156abfd74f4ff5', living: '156abfd74f4ff5', live3: '156abfd74f4ff5', live10: 'e4698cc645521', rects: '1d891f0d504c05' },
  washiShifted: { monochrome: '1e8630746ef244', mask: 'b97d84aa65a2', field: '12595877c6583c', base: 'ee69315488e95', pattern: 'fa9812b1c3816', washi: '1114e237183ab2', living: '1114e237183ab2', live3: '1114e237183ab2', live10: '1bea70c0c440f4', rects: '1d891f0d504c05' },
  plain: { base: '1b8005512b3baa', pattern: '79ccecfefcf1', plain: 'c0ef449ea005a', living: 'c0ef449ea005a', glow: 'd15fbf387c596' },
  plainCombed: { base: '1b8005512b3baa', pattern: 'a59793e9211c4', plain: '97b1507776ef2', living: '97b1507776ef2', glow: 'd15fbf387c596' },
  plainDrops: { base: '1b8005512b3baa', pattern: '10805f57b672e8', plain: '2e779943a81b1', living: '2e779943a81b1', glow: 'e40fcb1cbabb8' },
  white: { plain: '1b2496d6b48175' },
  hawkes: '8eadafdaf0e87',
};

const check = (name, got) => assert.equal(JSON.stringify(got), JSON.stringify(GOLDEN[name]), `${name}: ${JSON.stringify(got)}`);

test('golden: every Washi view, and the Living marks, are unchanged', () => check('washi', washi(DEFAULTS)));
test('golden: Washi with another tint, brightness and warmth is unchanged', () => check('washiShifted', washi(SHIFTED)));
test('golden: every Plain view and its lights are unchanged', () => check('plain', plain(DEFAULTS)));
test('golden: Plain with combed and drops dye is unchanged', () => {
  check('plainCombed', plain({ ...DEFAULTS, plainDye: 'combed' }));
  check('plainDrops', plain({ ...DEFAULTS, plainDye: 'drops', glowN: 5 }));
});
test('golden: Plain on a white picture takes the tint and is unchanged', () => {
  const e = new Engine();
  e.load(new Uint8ClampedArray(W * H * 4).fill(255), W, H);
  check('white', { plain: hash(e.plainView('plain', DEFAULTS).rgba) });
});
test('golden: the Hawkes event times over 1000 s are unchanged', () => {
  const sp = new Spontaneity(12345, 1.5, 1, DEFAULTS);
  const seen = [];
  for (let t = 0; t <= 1000; t += 7) for (const m of sp.advance(t)) if (m.id >= seen.length) seen[m.id] = `${m.t0},${m.parent},${m.x},${m.y}`;
  check('hawkes', hashText(seen.join(';')));
});
