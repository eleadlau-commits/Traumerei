// Part of the plugins feature: plugins imported from a file (a .traumplug made by
// `python build.py pack-plugin`, app/plugins/README.md §6). Plain functions, so the checks are
// tested without a page.
//
// A package is one JavaScript module: `manifest` (format traumplug/1, id, name, description,
// version, requires, plugin), `css`, and a default `(folio) => class extends folio.Feature`.
// Before it runs, the compiler's checks run again here (the plugin API version, the oldest app,
// its kinds and needs from the app's one list, one way in), since nothing compiled it into this app.

export const FORMAT = 'traumplug/1';
const ID = /^[a-z][a-z0-9-]*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const USES = /\.use\(\s*['"]([\w.:-]+)['"]/g;
// The services an imported plugin may ask for by name: the plugin API, nothing else.
export const ONE_WAY_IN = Object.freeze(['traumerei']);
// The features it may require: the one that offers the plugin API.
const MAY_REQUIRE = Object.freeze(['api']);

const versionKey = (v) => String(v).split('.').map((n) => Number(n) || 0);
const older = (a, b) => { const x = versionKey(a), y = versionKey(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };

// Loads a package's text as a module (a blob: URL, so it needs no server and no bare imports).
export async function loadModule(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  try { return await import(/* @vite-ignore */ url); } finally { URL.revokeObjectURL(url); }
}

// The problem with a package, in words, or '' when it may be offered for import.
// mod: the loaded module; text: its source; app: { version, pluginApi, pluginKinds, pluginNeeds };
// taken(id): true when a feature with that id is already in the app (built in, or imported).
export function problem(mod, text, app, taken = () => false) {
  const m = mod?.manifest;
  if (!m || typeof m !== 'object') return 'This isn\'t a Träumerei plugin: it has no manifest.';
  if (m.format !== FORMAT) return `This plugin is in a format this app doesn't read (${m.format || 'none'}; it reads ${FORMAT}).`;
  if (typeof mod.default !== 'function') return 'This plugin has no code to start.';
  if (!ID.test(m.id || '')) return 'This plugin\'s id must be lowercase words joined by dashes.';
  if (taken(m.id)) return `A plugin called ${m.id} is already here. Remove it first, or rename this one.`;
  if (!m.name || typeof m.name !== 'string') return 'This plugin has no name.';
  if (m.version && !VERSION.test(m.version)) return 'This plugin\'s version must look like 1.0.0.';
  const p = m.plugin;
  if (!p || typeof p !== 'object') return 'This plugin has no plugin block.';
  if (!Number.isInteger(p.api) || p.api < 1) return 'This plugin doesn\'t say which plugin API it was written for.';
  if (p.api > (app.pluginApi || 1)) return `This plugin is written for plugin API ${p.api}; this app offers API ${app.pluginApi || 1}. Update Träumerei first.`;
  if (!VERSION.test(p.minApp || '')) return 'This plugin doesn\'t say the oldest app it works with.';
  if (older(app.version, p.minApp)) return `This plugin needs Träumerei ${p.minApp} or newer (this is ${app.version}).`;
  const kinds = [].concat(p.kind || []), needs = [].concat(p.needs || []);
  const odd = kinds.find((k) => app.pluginKinds && !(k in app.pluginKinds));
  if (odd) return `This plugin says it adds "${odd}", which this app doesn't know.`;
  const oddNeed = needs.find((k) => !(k in (app.pluginNeeds || {})));
  if (oddNeed) return `This plugin needs "${oddNeed}", which this app can't give.`;
  if (p.sidecar && !needs.includes('sidecar')) return 'This plugin brings a program but doesn\'t say it needs "sidecar".';
  const req = [].concat(m.requires || []).find((r) => !MAY_REQUIRE.includes(r));
  if (req) return `This plugin needs the feature "${req}"; an imported plugin may need only the plugin API.`;
  for (const [, name] of String(text).matchAll(USES)) if (!ONE_WAY_IN.includes(name)) return `This plugin asks for "${name}"; a plugin reaches the app only through the plugin API.`;
  return '';
}

// The registry entry the app starts it from.
export function entry(m) {
  return Object.freeze({
    id: m.id, name: m.name, description: m.description || '', version: m.version || '0.1.0',
    requires: [...(m.requires || [])], uses: [], platforms: ['web', 'android', 'ios'], imported: true,
    plugin: Object.freeze({ kind: [], needs: [], load: 'start', ...m.plugin }),
  });
}

// The plugin's class with one way in held at run time as well: `use` answers only the plugin API,
// and `add` reaches only Settings and the slots it defined itself.
export function oneWayIn(Plugin) {
  return class Imported extends Plugin {
    use(name) { return ONE_WAY_IN.includes(name) ? super.use(name) : null; }
    add(slot, item) {
      if (slot !== 'settings' && !(this.ownSlots || []).includes(slot)) throw new Error(`An imported plugin adds only through the plugin API (it tried the ${slot} slot)`);
      return super.add(slot, item);
    }
    defineSlot(name, ...rest) { (this.ownSlots ||= []).push(name); return super.defineSlot(name, ...rest); }
  };
}

// The words on the import card: what it is, who made it, what it adds and needs.
export function card(m, app) {
  const p = m.plugin || {};
  const kinds = [].concat(p.kind || []).map((k) => app.pluginKinds?.[k] || k);
  const needs = [].concat(p.needs || []).map((k) => app.pluginNeeds?.[k] || k);
  return Object.freeze({
    title: `${m.name} ${m.version || ''}`.trim(),
    by: p.author ? `by ${p.author}` : '',
    description: m.description || '',
    adds: kinds.length ? `Adds ${kinds.join(', ')}.` : '',
    needs: needs.length ? `It ${needs.join(', ')}.` : 'It needs nothing beyond the plugin API.',
    sidecar: p.sidecar ? `It comes with a program for this computer (${p.sidecar.program || 'unnamed'}), which runs only once you allow it.` : '',
  });
}
