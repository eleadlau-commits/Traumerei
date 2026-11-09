// Part of the plugins feature: what Settings → Plugins says of each plugin, from Folio's record
// of it ({ manifest, status, reason, problem }). Plain functions, so they are tested without a page.

// What a plugin adds, in words (its plugin block's kind).
const KIND_WORDS = { mode: 'a mode', item: 'a kind of item', dock: 'a dock', tool: 'a tool', file: 'a file format',
  editor: 'an editor', page: 'a page', look: 'the look', command: 'commands' };

export const isPlugin = (f) => !!f?.manifest?.plugin;
export const isOn = (f) => f?.status === 'active';
export const startsOff = (f) => f?.manifest?.plugin?.starts === 'off'; // "starts": "off": switched on in Settings → Plugins

export function kindWords(f) {
  const kinds = [].concat(f.manifest.plugin?.kind || []);
  return kinds.map((k) => KIND_WORDS[k] || k).join(', ');
}

// The line under a plugin's name: what is wrong, else what it is.
export function note(f) {
  if (f.status === 'failed') return { text: `Couldn't start: ${f.reason}`, problem: true };
  if (f.status === 'active' && f.problem) return { text: `Had a problem: ${f.problem}`, problem: true };
  if (f.status === 'safe') return { text: 'Off in safe mode', problem: false };
  if (f.status === 'skipped' && f.reason) return { text: f.reason, problem: true };
  return { text: f.manifest.description || '', problem: false };
}

// Every plugin, by name.
export const plugins = (features) => [...features.values()].filter((f) => isPlugin(f) && f.status !== 'not-for-platform')
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));

// "Turning off Room files also turns off Source editor and Time." for the plugins that need it.
export function dependentsWords(name, names) {
  if (!names.length) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `Turning off ${name} also turns off ${list}.`;
}

// The plugin that gives a mode, by the mode's id (a mode plugin's id is its mode's), when it is
// off; null when there is none or it runs.
export function offMode(features, modeId) {
  const f = features.get(modeId);
  return f && isPlugin(f) && !isOn(f) && [].concat(f.manifest.plugin.kind || []).includes('mode') ? f : null;
}
