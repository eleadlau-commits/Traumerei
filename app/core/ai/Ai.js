// The AI framework (app/core/AI.md is its contract): defines the places providers, engines and
// replacement services plug into, keeps the person's choices (a provider per task, the cloud
// switch, rooms that keep everything on this machine, sidecars allowed to run), and offers the
// `ai` service. Plugins reach it only through the plugin API (`t.ai`, `t.slots.providers`,
// `t.slots.engines`, `t.slots.aiServices`); the API feature hands it to them.
//
// Saved data (this feature's storage): `choice` { [task]: provider id }, `cloud` (false),
// `blocked` [room ids], `allowed` [provider ids], `memory` (MB, 2048), `machine` ('' = as detected, or a tier).

import { Feature, ui } from 'folio';
import { makeAi } from './service.js';
import { TASKS, schemaOf } from './tasks.js';
import { exam, verdictCases } from './exam.js';
import * as bridges from './bridges.js';
import { pane } from './settings.js';
import { detect } from './machine.js';
import { makeSidecars } from './sidecar.js';
import { MACHINES } from './tasks.js';

export const SLOTS = Object.freeze({ providers: 'ai.providers', engines: 'ai.engines', services: 'ai.services' });

export default class Ai extends Feature {
  start() {
    this.defineSlot(SLOTS.providers, 'A provider: { id, name, version, tasks, hints?, engine?, available?(), load?(), unload?(), run(task, input, ctx), verdict?(v) } (app/core/AI.md).');
    this.defineSlot(SLOTS.engines, 'An engine several providers share: { id, name, kind?, memory?, gpu?, load?(), unload?() } (app/core/AI.md).');
    this.defineSlot(SLOTS.services, 'A replacement for a shared AI service: { id, replaces: "scheduler" | "cache" | "budget", make(defaults) } (app/core/AI.md).');
    const s = this.storage;
    // What the person may change (Settings → AI); never handed to plugins.
    const toggle = (key, id, on) => { const list = new Set(s.get(key, [])); if (on) list.add(id); else list.delete(id); s.set(key, [...list]); };
    const choices = Object.freeze({
      choose: (task, id) => { const c = { ...s.get('choice', {}) }; if (id) c[task] = id; else delete c[task]; s.set('choice', c); },
      chosen: (task) => s.get('choice', {})[task] || null,
      setCloud: (on) => s.set('cloud', !!on), cloud: () => s.get('cloud', false) === true,
      block: (context, on = true) => toggle('blocked', context, on), blocked: (context) => s.get('blocked', []).includes(context),
      // Revoking stops the program now; allowing again lets it be asked for again.
      allow: (id, on = true) => { toggle('allowed', id, on); if (on) this.sidecars?.forget(id); else this.sidecars?.stop(id); }, allowed: (id) => s.get('allowed', []).includes(id),
      setMemory: (mb) => s.set('memory', Math.max(256, Number(mb) || 2048)), memory: () => Number(s.get('memory', 2048)) || 2048,
      setMachine: (tier) => s.set('machine', MACHINES.includes(tier) ? tier : ''), machineChoice: () => (MACHINES.includes(s.get('machine', '')) ? s.get('machine', '') : ''),
      detected: () => this.detected,
    });
    // Until detection answers, the lowest tier: core must work there.
    this.detected = Object.freeze({ tier: 'every-pc', cores: 1, memory: null, gpu: false, pending: true });
    detect().then((m) => { this.detected = m; }, () => {});
    const shell = globalThis.__TAURI_INTERNALS__ || null;
    this.sidecars = makeSidecars({ invoke: shell ? (cmd, args) => shell.invoke(cmd, args) : null, store: () => this.use('store'), choices, ask: (o) => this.askSidecar(o) });
    this.whenStopped(() => { for (const id of this.sidecars.running()) this.sidecars.stop(id); });
    const ai = serve({ slot: (name) => this.slot(name), choices, desktop: !!shell, sidecars: this.sidecars });
    this.provide('ai', ai);
    // Settings → AI. The rooms come from the world service (its README), when it is there.
    const world = this.use('world');
    const rooms = () => { const w = world?.world; const m = world?.lib?.model; return w && m ? m.children(w, null).filter((r) => m.kindOf(r) === 'room').map((r) => ({ id: r.id, name: r.name })) : []; };
    this.add('settings', { id: 'ai', title: 'AI', order: 79, render: () => {
      const box = ui.el('div', {});
      const draw = () => box.replaceChildren(pane({ ai, rooms, el: ui.el, redraw: draw }));
      draw();
      return box;
    } });
  }
}

// Asked once per plugin, the first time its program is needed (sidecar.js).
Ai.prototype.askSidecar = function askSidecar({ id, name, program, bytes, host }) {
  const who = this.app.features.get(id)?.manifest.name || name || id;
  const mb = bytes >= 1048576 ? `${Math.round(bytes / 1048576)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return new Promise((done) => {
    let answer = false;
    const d = ui.dialog({ title: 'A program for a plugin', size: 'box', onClose: () => done(answer) });
    const yes = ui.el('button', { type: 'button', class: 'word', onclick: () => { answer = true; d.close(); } }, 'Allow');
    d.setContent(
      ui.el('p', {}, `${who} would like to run its own program on this computer: ${program} (${mb}, downloaded once from ${host}).`),
      ui.el('p', { class: 'hint small' }, 'It runs only while Träumerei uses it, answers only this computer, and stops when idle or when Träumerei closes. Settings → AI can revoke it.'),
      ui.el('div', { class: 'row' }, yes, ui.el('button', { type: 'button', class: 'word', onclick: () => d.close() }, 'Not now')));
    d.open();
    requestAnimationFrame(() => yes.focus());
  });
};

// The `ai` service over the app's slots and the person's choices (also what the tests' host runs).
// slot(name) → a Folio slot; choices: as above (chosen, cloud, blocked, allowed, memory, and the setters).
export function serve({ slot, choices, desktop = false, now, sidecars = null }) {
  const items = (name) => () => slot(name)?.items || [];
  // The machine tier: the person's choice in Settings → AI, else what was detected.
  const machine = () => {
    const found = choices.detected?.() || { tier: 'gpu', cores: null, memory: null, gpu: null };
    const chosen = choices.machineChoice?.() || '';
    return Object.freeze({ ...found, tier: chosen || found.tier, detected: found.tier, chosen: !!chosen });
  };
  const ai = makeAi({
    providers: items(SLOTS.providers), engines: items(SLOTS.engines), services: items(SLOTS.services), desktop, now,
    settings: { choice: choices.chosen, cloud: choices.cloud, blocked: choices.blocked, allowed: choices.allowed, memory: choices.memory, machine: () => machine().tier },
  });
  return Object.freeze({ ...ai, machine, sidecar: (plugin) => (sidecars ? sidecars.for(plugin) : null), tasks: () => Object.keys(TASKS), schema: schemaOf, slots: SLOTS, choices, exam: (o) => exam(ai, o), verdictCases,
    bridges: Object.freeze({ worker: bridges.worker, http: bridges.http, openai: bridges.openai }) });
}

// Choices kept in memory, for tests and a host with no storage.
export function memoryChoices(start = {}) {
  const s = { choice: {}, cloud: false, blocked: [], allowed: [], memory: 2048, machine: '', detected: { tier: 'gpu', cores: 8, memory: 8, gpu: true }, ...start };
  const toggle = (key, id, on) => { const l = new Set(s[key]); if (on) l.add(id); else l.delete(id); s[key] = [...l]; };
  return {
    choose: (task, id) => { if (id) s.choice[task] = id; else delete s.choice[task]; }, chosen: (task) => s.choice[task] || null,
    setCloud: (on) => { s.cloud = !!on; }, cloud: () => s.cloud,
    block: (c, on = true) => toggle('blocked', c, on), blocked: (c) => s.blocked.includes(c),
    allow: (id, on = true) => toggle('allowed', id, on), allowed: (id) => s.allowed.includes(id),
    setMemory: (mb) => { s.memory = Math.max(256, Number(mb) || 2048); }, memory: () => s.memory,
    setMachine: (tier) => { s.machine = MACHINES.includes(tier) ? tier : ''; }, machineChoice: () => s.machine, detected: () => s.detected,
  };
}
