// JSON of the six tables: a room (or, with nothing open, the whole world) out as its six tables
// in JSON, and such a file in again as a new room. A corpus plugin (kernel phase 8): written
// against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

export const FORMAT = 'traumerei-tables/1';
export const out = (t, context = null) => JSON.stringify({ format: FORMAT, root: context, tables: t.carriers.tables(context) }, null, 1);
export function land(t, text) {
  let o; try { o = JSON.parse(text); } catch { return { ok: false, reason: 'Not JSON' }; }
  if (o?.format !== FORMAT || !o.tables || !o.root) return { ok: false, reason: 'Not the six tables of a room' };
  return t.carriers.land({ tables: o.tables, root: o.root });
}

export function install(t) {
  t.slots.formats.add({ id: 'json-tables', name: 'The six tables (.json)', order: 62, accepts: (file) => /\.json$/i.test(file?.name || ''),
    importRoom: async ({ file } = {}) => { if (!file) return null; const r = land(t, await file.text()); if (!r.ok) t.ui.toast(r.reason); return r.ok ? { id: r.id } : null; } });
  t.slots.commands.add({ id: 'json-tables.out', zone: 'everywhere', order: 69, words: 'Export the six tables as JSON (this room, or the whole world)',
    run: () => { const c = t.ui.chosen()?.context ?? null; t.ui.download(`${c ? t.marks.text(c) : 'world'}.json`, out(t, c), 'application/json'); } });
}

export default class JsonTables extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
