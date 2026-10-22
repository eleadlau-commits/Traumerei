// The sliders: one per parameter, grouped, each showing its value. Screen code only.

import { ui } from 'folio';

const { el } = ui;

const shown = (p, v) => (p.step >= 1 ? String(v) : Number(v).toFixed(Math.max(0, -Math.floor(Math.log10(p.step)))));

// sliders(PARAMS, values, onChange(key, value)) → { node, groups, set(values) }
// groups maps each group's name to its box, for pages that place the groups themselves.
export function sliders(params, values, onChange) {
  const rows = new Map();
  const groups = new Map();
  for (const p of params) {
    if (!groups.has(p.group)) groups.set(p.group, el('fieldset', { class: 'renderer-group' }, el('legend', {}, p.group)));
    const out = el('output', { class: 'renderer-value' }, shown(p, values[p.key]));
    const input = el('input', {
      type: 'range', min: p.min, max: p.max, step: p.step, value: values[p.key], 'aria-label': p.label,
      oninput: (e) => {
        const v = Number(e.target.value);
        out.textContent = shown(p, v);
        onChange(p.key, v);
      },
    });
    rows.set(p.key, { input, out, p });
    groups.get(p.group).append(el('label', { class: 'renderer-slider' }, el('span', {}, p.label), out, input));
  }
  return {
    node: el('div', { class: 'renderer-sliders', 'data-own-swipe': true }, ...groups.values()),
    groups,
    set(next) {
      for (const [key, r] of rows) {
        r.input.value = next[key];
        r.out.textContent = shown(r.p, next[key]);
      }
    },
  };
}
