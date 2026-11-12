// Settings → AI (app/core/AI.md, Settings → AI): each task with the provider chosen for it and the
// ones it falls back to, the cloud switch, the rooms that keep everything on this machine, the
// sidecars allowed to run, and the memory budget. The choices are the person's (ai.choices).
//
// pane({ ai, rooms, el, redraw }): ai the `ai` service; rooms() → [{ id, name }]; el Folio's ui.el;
// redraw() draws the pane again after a change. Returns a node.

const AUTO = '';

export function pane({ ai, rooms = () => [], el, redraw = () => {} }) {
  const c = ai.choices;
  const set = (fn) => (e) => { fn(e); redraw(); };
  const check = (on, label, onchange) => el('label', { class: 'row' },
    el('input', { type: 'checkbox', checked: on ? '' : null, 'aria-label': label, onchange: set((e) => onchange(e.target.checked)) }), el('span', {}, label));

  const tasks = ai.tasks().map((task) => {
    const providers = ai.list(task);
    const chosen = c.chosen(task) || AUTO;
    const select = el('select', { 'aria-label': `Provider for ${task}`, onchange: set((e) => c.choose(task, e.target.value || null)) },
      el('option', { value: AUTO, ...(chosen === AUTO ? { selected: '' } : {}) }, 'Automatic: our own system when it is there'),
      ...providers.map((p) => el('option', { value: p.id, ...(chosen === p.id ? { selected: '' } : {}) }, `${p.name}${p.hints.where === 'remote' ? ' (cloud)' : ''}`)));
    const order = ai.order(task);
    const first = ai.first(task);
    const then = order.filter((id) => id !== first);
    const words = !providers.length ? 'No provider does this yet.'
      : `${first ? `Now: ${name(providers, first)}.` : 'Nothing may run now.'}${then.length ? ` Then: ${then.map((id) => name(providers, id)).join(', ')}.` : ''}`;
    return el('div', { class: 'stack ai-task' },
      el('label', { class: 'row' }, el('span', {}, `${cap(task)}: ${ai.schema(task).note}`), select),
      el('p', { class: 'hint small' }, words));
  });

  const sidecars = ai.list().filter((p) => p.hints.runs === 'sidecar');
  const roomList = rooms();
  return el('div', { class: 'stack ai-settings' },
    el('p', { class: 'hint' }, 'AI in Träumerei only suggests: whatever it proposes waits for you to keep or refuse. Each task uses the provider chosen here, and the next one when it is missing, failing or out of room.'),
    ...tasks,
    check(c.cloud(), 'Allow cloud providers (they send your words off this machine)', (on) => c.setCloud(on)),
    roomList.length ? el('div', { class: 'stack' }, el('p', { class: 'hint small' }, 'Rooms that keep everything on this machine, whatever the switch above says:'),
      ...roomList.map((r) => check(c.blocked(r.id), r.name || 'Untitled', (on) => c.block(r.id, on)))) : null,
    sidecars.length ? el('div', { class: 'stack' }, el('p', { class: 'hint small' }, 'Programs allowed to run beside the app (desktop app only):'),
      ...sidecars.map((p) => check(c.allowed(p.id), p.name, (on) => c.allow(p.id, on)))) : null,
    machineRow(ai, el, set),
    el('label', { class: 'row' }, el('span', {}, 'Memory for AI models (MB)'),
      el('input', { type: 'number', min: '256', step: '256', value: String(c.memory()), 'aria-label': 'Memory for AI models in MB', onchange: set((e) => c.setMemory(e.target.value)) })));
}

// This computer's tier: what was detected, and a choice to say otherwise.
const MACHINE_WORDS = { 'every-pc': 'Any computer (no GPU)', mid: 'Mid (enough cores and memory)', gpu: 'With a GPU' };
function machineRow(ai, el, set) {
  if (!ai.machine) return null;
  const m = ai.machine();
  const chosen = ai.choices.machineChoice?.() || '';
  return el('label', { class: 'row' }, el('span', {}, 'This computer'),
    el('select', { 'aria-label': 'This computer\'s tier for AI', onchange: set((e) => ai.choices.setMachine(e.target.value)) },
      el('option', { value: '', ...(chosen ? {} : { selected: '' }) }, `As detected: ${MACHINE_WORDS[m.detected] || m.detected}`),
      ...Object.entries(MACHINE_WORDS).map(([tier, words]) => el('option', { value: tier, ...(chosen === tier ? { selected: '' } : {}) }, words))));
}

const name = (providers, id) => providers.find((p) => p.id === id)?.name || id;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
