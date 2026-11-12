// The AI framework (app/core/AI.md is its contract): defines the places providers, engines and
// replacement services plug into, keeps the person's choices (a provider per task, the cloud
// switch, rooms that keep everything on this machine, sidecars allowed to run), and offers the
// `ai` service. Plugins reach it only through the plugin API (`t.ai`, `t.slots.providers`,
// `t.slots.engines`, `t.slots.aiServices`); the API feature hands it to them.
//
// Saved data (this feature's storage): `choice` { [task]: provider id }, `cloud` (false),
// `blocked` [room ids], `allowed` [provider ids], `memory` (MB, 2048).

import { Feature } from 'folio';
import { makeAi } from './service.js';
import { TASKS, schemaOf } from './tasks.js';
import { exam, verdictCases } from './exam.js';

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
      allow: (id, on = true) => toggle('allowed', id, on), allowed: (id) => s.get('allowed', []).includes(id),
      setMemory: (mb) => s.set('memory', Math.max(256, Number(mb) || 2048)), memory: () => Number(s.get('memory', 2048)) || 2048,
    });
    this.provide('ai', serve({ slot: (name) => this.slot(name), choices, desktop: !!globalThis.__TAURI_INTERNALS__ }));
  }
}

// The `ai` service over the app's slots and the person's choices (also what the tests' host runs).
// slot(name) → a Folio slot; choices: as above (chosen, cloud, blocked, allowed, memory, and the setters).
export function serve({ slot, choices, desktop = false, now }) {
  const items = (name) => () => slot(name)?.items || [];
  const ai = makeAi({
    providers: items(SLOTS.providers), engines: items(SLOTS.engines), services: items(SLOTS.services), desktop, now,
    settings: { choice: choices.chosen, cloud: choices.cloud, blocked: choices.blocked, allowed: choices.allowed, memory: choices.memory },
  });
  return Object.freeze({ ...ai, tasks: () => Object.keys(TASKS), schema: schemaOf, slots: SLOTS, choices, exam: (o) => exam(ai, o), verdictCases });
}

// Choices kept in memory, for tests and a host with no storage.
export function memoryChoices(start = {}) {
  const s = { choice: {}, cloud: false, blocked: [], allowed: [], memory: 2048, ...start };
  const toggle = (key, id, on) => { const l = new Set(s[key]); if (on) l.add(id); else l.delete(id); s[key] = [...l]; };
  return {
    choose: (task, id) => { if (id) s.choice[task] = id; else delete s.choice[task]; }, chosen: (task) => s.choice[task] || null,
    setCloud: (on) => { s.cloud = !!on; }, cloud: () => s.cloud,
    block: (c, on = true) => toggle('blocked', c, on), blocked: (c) => s.blocked.includes(c),
    allow: (id, on = true) => toggle('allowed', id, on), allowed: (id) => s.allowed.includes(id),
    setMemory: (mb) => { s.memory = mb; }, memory: () => s.memory,
  };
}
