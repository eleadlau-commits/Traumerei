// Sidecars (sidecar.js): asked once per plugin, the program downloaded into its store, started by
// the shell, its port handed to the HTTP bridge, stopped when idle or revoked; never on the web.

import { test, assert } from 'folio/testing';
import { makeSidecars, invalidSpec } from '../sidecar.js';
import { memoryChoices } from '../Ai.js';

const SPEC = { program: 'engine.exe', url: 'https://example.org/engine.exe', bytes: 10, checksum: `sha256:${'a'.repeat(64)}`, args: ['--port', '{port}'], idle: 60 };
function rig(o = {}) {
  const calls = [], asked = [], downloads = [];
  const timers = new Map(); let seq = 0;
  const choices = memoryChoices();
  const store = { trusted: (id) => ({ files: { download: async (url, name, opts) => { downloads.push([id, url, name, opts.asked]); return o.download || { ok: true, bytes: 10 }; } } }) };
  const s = makeSidecars({
    invoke: o.web ? null : async (cmd, args) => { calls.push([cmd, args]); if (cmd === 'sidecar_start') { if (o.refuse) throw new Error('its program doesn\'t match its checksum'); return 4321; } return true; },
    store, choices, ask: async (q) => { asked.push(q); return o.say ?? true; },
    healthy: async () => true, wait: async () => {},
    clock: { set: (fn, ms) => { const h = ++seq; timers.set(h, { fn, ms }); return h; }, clear: (h) => timers.delete(h) },
  });
  return { s, calls, asked, downloads, timers, choices };
}
const plugin = { id: 'engine-plugin', name: 'Engine', spec: SPEC };

test('sidecar: a declaration needs program, https address, size and checksum', () => {
  assert.equal(invalidSpec(SPEC), '');
  assert.match(invalidSpec({ ...SPEC, checksum: 'md5:x' }), /checksum/);
  assert.match(invalidSpec({ ...SPEC, url: 'http://x' }), /https/);
  assert.match(invalidSpec({ ...SPEC, program: '../x.exe' }), /program/);
  assert.match(invalidSpec({ ...SPEC, bytes: 0 }), /how large/);
});

test('sidecar: asked once, downloaded into its store, started on a port, and stopped when idle', async () => {
  const r = rig();
  const h = r.s.for(plugin);
  const a = await h.start();
  assert.deepEqual(a, { ok: true, port: 4321 });
  assert.deepEqual(r.asked.map((q) => [q.id, q.program, q.host]), [['engine-plugin', 'engine.exe', 'example.org']]);
  assert.ok(r.choices.allowed('engine-plugin'), 'remembered');
  assert.deepEqual(r.downloads, [['engine-plugin', SPEC.url, 'engine.exe', true]]);
  assert.deepEqual(r.calls[0], ['sidecar_start', { plugin: 'engine-plugin', program: 'engine.exe', checksum: SPEC.checksum, args: ['--port', '{port}'] }]);
  assert.equal((await h.start()).port, 4321);
  assert.equal(r.asked.length, 1);
  assert.equal(r.calls.filter((c) => c[0] === 'sidecar_start').length, 1, 'started once');
  const [timer] = [...r.timers.values()];
  assert.equal(timer.ms, 60000);
  timer.fn();
  await Promise.resolve();
  assert.ok(!h.running);
  assert.ok(r.calls.some((c) => c[0] === 'sidecar_stop'));
});

test('sidecar: no on the card, a bad checksum, or the web: nothing runs, and it says why', async () => {
  const no = rig({ say: false });
  assert.match((await no.s.for(plugin).start()).reason, /not allowed/);
  assert.match((await no.s.for(plugin).start()).reason, /not allowed/);
  assert.equal(no.asked.length, 1, 'not asked twice');
  assert.equal(no.calls.length, 0);
  assert.match((await rig({ refuse: true }).s.for(plugin).start()).reason, /checksum/);
  assert.match((await rig({ web: true }).s.for(plugin).start()).reason, /desktop app/);
  assert.match((await rig({ download: { ok: false, reason: 'The download failed: 404' } }).s.for(plugin).start()).reason, /404/);
});

test('sidecar: its provider speaks the HTTP bridge on the port, under the plugin\'s id', async () => {
  const r = rig();
  const p = r.s.for(plugin).provider({ name: 'Engine embed', version: '2', tasks: ['embed'] });
  assert.equal(p.id, 'engine-plugin');
  assert.equal(p.hints.runs, 'sidecar');
  assert.ok(p.hints.asks);
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init) => { asked.push(url); return { ok: true, json: async () => ({ output: { vectors: { dim: 1, data: { float32: 'AACAPw==' } } } }) }; };
  try {
    const out = await p.run('embed', { items: [{ id: 'a', text: 'x' }] }, { version: 1, signal: null, part: () => {} });
    assert.equal(out.vectors.data[0], 1);
    assert.equal(asked[0], 'http://127.0.0.1:4321/traumerei/ai/v1/embed');
  } finally { globalThis.fetch = real; }
});
