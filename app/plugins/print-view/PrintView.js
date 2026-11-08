// Print view: Ctrl+Alt+P shows the open room as a plain, read-only page in a new window, ready to
// print: its name, then each group with its parts, then the thoughts in none, each with its gap
// and what is due. A corpus plugin (kernel phase 8): written against app/core/API.md alone.
// Saves nothing.
import { Feature } from 'folio';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function page(t, context) {
  const marks = t.marks.in(context) || [];
  const held = new Set();
  const line = (id) => {
    const g = t.gaps.of(id), a = t.moments.next(id);
    const tag = [g && !g.derived ? (g.state === 'resolved' ? '✓' : '○') : '', a?.at ? `due ${new Date(a.at).toDateString()}` : ''].filter(Boolean).join(' ');
    return `<li>${esc(t.marks.text(id))}${tag ? ` <small>${esc(tag)}</small>` : ''}</li>`;
  };
  const groups = marks.filter((m) => m.kind === 'group').map((g) => {
    const parts = t.links.members(g.id); parts.forEach((p) => held.add(p));
    return `<h2>${esc(g.title || 'Group')}</h2><ul>${parts.map(line).join('')}</ul>`;
  });
  const loose = marks.filter((m) => m.kind !== 'group' && !held.has(m.id)).map((m) => line(m.id));
  return `<!doctype html><meta charset="utf-8"><title>${esc(t.marks.text(context))}</title>`
    + '<style>body{font:15px/1.6 Georgia,serif;max-width:40em;margin:2em auto;color:#111}h2{font-size:1em;margin-top:2em}small{color:#777}</style>'
    + `<h1>${esc(t.marks.text(context))}</h1>${groups.join('')}${loose.length ? `<ul>${loose.join('')}</ul>` : ''}`;
}

export function install(t) {
  t.slots.commands.add({ id: 'print-view.open', keys: ['Ctrl+Alt+P'], zone: 'room', order: 64, words: 'Show this room as a page to print',
    when: () => !!t.ui.chosen()?.context,
    run: () => {
      const html = page(t, t.ui.chosen().context);
      const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
      if (!win) { t.ui.toast('The print page could not open (a pop-up blocker?)'); return; }
      win.document.write(html); win.document.close();
    } });
}

export default class PrintView extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
