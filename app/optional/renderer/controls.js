// The controls: one per parameter, grouped. A slider shows its value; kind 'colour' is a colour
// picker and kind 'choice' a row of buttons, one per option. Screen code only.

import { ui } from 'folio';

const { el } = ui;

const shown = (p, v) => (p.step >= 1 ? String(v) : Number(v).toFixed(Math.max(0, -Math.floor(Math.log10(p.step)))));

// sliders(PARAMS, values, onChange(key, value)) → { node, groups, set(values) }
// groups maps each group's name to its box, for pages that place the groups themselves.
// A key listed in several groups gets a control in each, and they all follow one another.
export function sliders(params, values, onChange) {
  const rows = [];
  const groups = new Map();
  const changed = (key, v) => {
    for (const r of rows) if (r.p.key === key) r.show(v);
    onChange(key, v);
  };
  for (const p of params) {
    if (!groups.has(p.group)) groups.set(p.group, el('fieldset', { class: 'renderer-group' }, el('legend', {}, p.group)));
    const row = (p.kind === 'colour' ? colour : p.kind === 'choice' ? choice : slider)(p, values[p.key], changed);
    rows.push(row);
    groups.get(p.group).append(row.node);
  }
  return {
    node: el('div', { class: 'renderer-sliders', 'data-own-swipe': true }, ...groups.values()),
    groups,
    set(next) {
      for (const r of rows) r.show(next[r.p.key]);
    },
  };
}

function slider(p, value, changed) {
  const out = el('output', { class: 'renderer-value' }, shown(p, value));
  const input = el('input', {
    type: 'range', min: p.min, max: p.max, step: p.step, value, 'aria-label': p.label,
    oninput: (e) => changed(p.key, Number(e.target.value)),
  });
  return {
    p,
    node: el('label', { class: 'renderer-slider' }, el('span', {}, p.label), out, input),
    show(v) {
      input.value = v;
      out.textContent = shown(p, v);
    },
  };
}

function colour(p, value, changed) {
  const input = el('input', { type: 'color', value, 'aria-label': p.aria || p.label,
    oninput: (e) => changed(p.key, e.target.value) });
  return {
    p,
    node: el('label', { class: 'renderer-slider renderer-colour' }, el('span', {}, p.label), input),
    show(v) {
      if (input.value !== v) input.value = v;
    },
  };
}

function choice(p, value, changed) {
  const buttons = p.options.map(([id, label]) => el('button', {
    type: 'button', role: 'radio', 'data-value': id, onclick: () => changed(p.key, id),
  }, label));
  const show = (v) => {
    for (const b of buttons) {
      const on = String(b.dataset.value === v);
      b.setAttribute('aria-checked', on);
      b.setAttribute('aria-selected', on);
    }
  };
  show(value);
  return {
    p,
    node: el('div', { class: 'renderer-slider' }, el('span', {}, p.label),
      el('div', { class: 'seg renderer-choice', role: 'radiogroup', 'aria-label': p.aria || p.label, style: `--tabs:${p.options.length}` }, buttons)),
    show,
  };
}
