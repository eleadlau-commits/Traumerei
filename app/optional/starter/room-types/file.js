// Room types: one Markdown file is one room type. Plain functions, no app (tests/file.test.js).
//
//   # Name                     the first heading: the type's name (its id is the name as a slug)
//   One line under it.         the note the mode menus show
//   key: value                 lines that say what the menus would: arrange, cell, columns, order,
//                              links, hand, icon (KEYS below)
//   ```js … ```                the code behind it: assignments to arrange, admit, draw, drop, land
//
// Anything else is ignored, so notes to oneself are fine.

export const KEYS = Object.freeze({
  arrange: ['grid', 'rows', 'columns', 'spiral', 'by links', 'code'],
  cell: 'width x height',
  columns: 'a number',
  order: ['oldest first', 'newest first', 'by text', 'open gaps first'],
  links: 'link kinds, by name, joined by commas',
  hand: ['yes', 'no'],
  icon: 'SVG drawing on a 24 × 24 grid',
});
export const HOOKS = Object.freeze(['arrange', 'admit', 'draw', 'drop', 'land']);
export const DEFAULTS = Object.freeze({ arrange: 'grid', cell: { w: 240, h: 160 }, columns: 6, order: 'oldest first', links: null, hand: true, icon: '<rect x="4" y="4" width="16" height="16"/>' });

export const slug = (name) => String(name).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Markdown text → { id, name, note, icon, lines, code, codeLine, hooks, errors }. errors: words,
// each naming its line; a type with errors is not saved.
export function read(text) {
  const errors = [], lines = { ...DEFAULTS };
  let name = '', note = '', code = '', codeLine = 0, inCode = null, fence = '', codeBuf = [];
  const rows = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  rows.forEach((raw, i) => {
    const n = i + 1, line = raw.trim();
    if (inCode !== null) {
      if (line.startsWith(fence)) { if (inCode === 'js') { code = codeBuf.join('\n'); } inCode = null; return; }
      if (inCode === 'js') codeBuf.push(raw);
      return;
    }
    const open = /^(```+|~~~+)\s*([\w-]*)/.exec(line);
    if (open) {
      fence = open[1]; const lang = open[2].toLowerCase();
      if ((lang === 'js' || lang === 'javascript') && !code) { inCode = 'js'; codeLine = n + 1; codeBuf = []; } else inCode = 'other';
      return;
    }
    if (!name) { const h = /^#\s+(.+?)\s*#*$/.exec(line); if (h) name = h[1]; return; }
    if (!line) return;
    const kv = /^([a-z]+)\s*:\s*(.*)$/i.exec(line);
    if (kv && kv[1].toLowerCase() in KEYS) { const why = setLine(lines, kv[1].toLowerCase(), kv[2].trim()); if (why) errors.push(`Line ${n}: ${why}`); return; }
    if (!note && !line.startsWith('#') && !kv) note = line.replace(/^[-*>]\s*/, '');
  });
  if (inCode === 'js') { code = codeBuf.join('\n'); errors.push(`Line ${codeLine - 1}: the code block is never closed with \`\`\``); }
  if (!name) errors.push('Line 1: a room type needs a name, as its first heading (# Name)');
  const id = slug(name);
  if (name && !id) errors.push('Line 1: the name needs at least one letter or digit');
  let hooks = {};
  if (code) {
    const made = compile(code);
    if (made.why) errors.push(`Line ${codeLine}${made.line ? `+${made.line - 1}` : ''}: the code does not run: ${made.why}`);
    else hooks = made.hooks;
  }
  if (lines.arrange === 'code' && !hooks.arrange) errors.push('arrange: code needs an arrange = (reads, context) => … in the ```js block');
  return { id, name, note, icon: lines.icon, lines, code, codeLine, hooks, errors };
}

function setLine(lines, key, v) {
  const low = v.toLowerCase();
  if (key === 'arrange' || key === 'order' || key === 'hand') {
    if (!KEYS[key].includes(low)) return `${key} is one of ${KEYS[key].join(', ')}`;
    lines[key] = key === 'hand' ? low === 'yes' : low;
  } else if (key === 'cell') {
    const m = /^(\d+)\s*[x×]\s*(\d+)$/.exec(low);
    if (!m || +m[1] < 20 || +m[2] < 20) return 'cell is width x height in world units, e.g. 240 x 160';
    lines.cell = { w: +m[1], h: +m[2] };
  } else if (key === 'columns') {
    if (!/^\d+$/.test(low) || +low < 1) return 'columns is a whole number, 1 or more';
    lines.columns = +low;
  } else if (key === 'links') {
    lines.links = low === 'all' ? null : low.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (key === 'icon') lines.icon = v.startsWith('<') ? v : `<path d="${v.replace(/"/g, '')}"/>`;
  return '';
}

// The ```js block → { hooks } or { why, line? }. It runs with nothing in scope but its own five
// names (and the language's globals, as any imported plugin's code does).
export function compile(code) {
  const names = ['arrange', 'admit', 'draw', 'drop', 'land']; // (HOOKS, here again: Export copies this function's source)
  try {
    // eslint-disable-next-line no-new-func
    const got = new Function(`"use strict";\nlet ${names.join(', ')};\n${code}\n;return { ${names.join(', ')} };`)();
    const hooks = {};
    for (const k of names) if (got[k] != null) { if (typeof got[k] !== 'function') return { why: `${k} must be a function` }; hooks[k] = got[k]; }
    return { hooks };
  } catch (err) {
    const m = /<anonymous>:(\d+)/.exec(err.stack || '');
    return { why: err.message, line: m ? Math.max(1, +m[1] - 4) : 0 };
  }
}

// A new type's starting file.
export const STARTER = `# My room type

One line on what this room is for.

arrange: grid
cell: 240 x 160
columns: 4
order: oldest first
`;
