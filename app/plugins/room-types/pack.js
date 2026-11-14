// Room types: Export. A made type as one .traumplug (traumplug/1, app/core/plugins/imported.js):
// a manifest, no styles, the type's file, and a factory whose class registers the same rule. The
// reader's compile and the rule's ruleOf go in as their own source, so it runs the page's code.
import { compile } from './file.js';
import { ruleOf } from './rule.js';

export function pack(file, md, { author = 'E', minApp = '1.0.2' } = {}) {
  const manifest = {
    format: 'traumplug/1', id: `made-${file.id}`, name: file.name, description: file.note || 'A room type made in Settings → Room types.',
    version: '1.0.0', requires: ['api'], plugin: { api: 2, minApp, kind: ['mode'], load: 'start', author },
  };
  const data = { id: file.id, name: file.name, note: file.note, icon: file.icon, lines: file.lines, code: file.code, md: String(md) };
  return `// Träumerei plugin package (traumplug/1): ${file.name.replace(/\n/g, ' ')}, a room type made in Settings → Room types. Import it in Settings → Plugins.
export const manifest = ${JSON.stringify(manifest)};
export const css = "";
export const file = ${JSON.stringify(data)};
const compile = ${compile.toString()};
const ruleOf = ${ruleOf.toString()};
export default (folio) => class extends folio.Feature {
  start() {
    const t = this.use('traumerei').connect(this);
    const made = file.code ? compile(file.code) : { hooks: {} };
    t.slots.rules.add(ruleOf({ ...file, hooks: made.hooks || {} }, (hook, err) => console.warn(\`\${file.name}: \${hook} failed\`, err)));
  }
};
`;
}
