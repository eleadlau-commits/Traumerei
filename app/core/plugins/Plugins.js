// Plugins: Settings → Plugins, one row for every plugin (a feature in app/plugins/ with a plugin
// block): its name, what it adds, and why it isn't running if it isn't (rows.js), with a switch
// that works at once. A plugin switched off keeps its data; switched on, it carries on where it
// was. Turning one off that others need says which go with it first, and asks.
//
// Safe mode starts the app with every plugin off, this time only: the Settings word, ?safe in the
// address, or holding Shift while the app starts (Folio's App.safeMode).
//
// It offers the `plugins` service (README.md). Saved data: none of its own (Folio keeps what is
// off, as 'folio.disabled').

import { Feature, ui } from 'folio';
import { plugins, isOn, startsOff, note, kindWords, dependentsWords, offMode } from './rows.js';

const { el } = ui;

export default class Plugins extends Feature {
  start() {
    this.asking = null; // the plugin whose turning off is being asked about: { id, others }
    // What a plugin opened through the plugin API (its dock tabs, its top bar) goes with it.
    this.on('app:stopped', (id) => this.use('traumerei')?.release(id));
    this.on('app:features', () => this.app.shell?.refreshSettings?.());
    const self = this;
    this.provide('plugins', {
      list: () => plugins(this.app.features).map((f) => ({ id: f.manifest.id, name: f.manifest.name, on: isOn(f), status: f.status })),
      isOn: (id) => isOn(this.app.features.get(id)),
      turnOn: (id) => this.turnOn(id),
      turnOff: (id) => this.turnOff(id, true),
      offMode: (modeId) => { const f = offMode(this.app.features, modeId); return f ? { id: f.manifest.id, name: f.manifest.name } : null; },
      get safe() { return !!self.app.safe; },
    });
    this.add('settings', { id: 'core-plugins', title: 'Plugins', icon: 'gear', order: 90, render: () => this.page() });
    if (this.app.safe) setTimeout(() => this.toast('Safe mode: every plugin is off this time. Settings → Plugins starts normally.'), 400);
  }

  name(id) { return this.app.features.get(id)?.manifest.name || id; }

  async turnOn(id) {
    const started = await this.app.startFeature(id);
    const f = this.app.features.get(id);
    if (isOn(f)) {
      const also = started.filter((x) => x !== id).map((x) => this.name(x));
      this.toast(also.length ? `${f.manifest.name} is on, and ${also.join(', ')}` : `${f.manifest.name} is on`);
      return true;
    }
    this.toast(`${f?.manifest.name || id} couldn't start: ${f?.reason || 'not available'}`);
    return false;
  }

  // Turns a plugin off; when others need it, asks first (sure: don't ask).
  turnOff(id, sure = false) {
    const others = this.app.dependents(id);
    if (others.length && !sure) { this.asking = { id, others }; this.redraw(); return false; }
    this.asking = null;
    const off = this.app.stopFeature(id);
    this.toast(off.length > 1 ? `${this.name(id)} is off, and ${off.filter((x) => x !== id).map((x) => this.name(x)).join(', ')}` : `${this.name(id)} is off · its data is kept`);
    return true;
  }

  redraw() { this.app.shell?.refreshSettings?.(); }

  // ---- Settings → Plugins ----

  page() {
    const all = plugins(this.app.features);
    const on = all.filter(isOn).length;
    const safe = !!this.app.safe;
    // Plugins that start off ("starts": "off": the stress corpus) wait under a fold.
    const [main, more] = [all.filter((f) => !startsOff(f)), all.filter(startsOff)];
    const moreOn = more.filter(isOn).length;
    const fold = more.length ? el('details', { class: 'advanced plugins-more', open: this.moreOpen, ontoggle: () => { this.moreOpen = fold.open; } },
      el('summary', {}, 'More plugins', el('small', {}, `${moreOn} of ${more.length} on`)),
      ui.hint('These start off. Switch one on and it stays on.', { small: true }),
      el('div', { class: 'feature-list plugins-list', role: 'list' }, more.map((f) => this.row(f, safe)))) : null;
    return el('div', { class: 'plugins' },
      safe
        ? el('div', { class: 'plugins-safe' },
          el('p', { class: 'hint' }, 'Safe mode: every plugin is off this time, whatever was chosen. Nothing is lost.'),
          el('button', { type: 'button', class: 'word', onclick: () => this.app.restart(false) }, 'Start normally'))
        : null,
      el('p', { class: 'hint' }, `${on} of ${all.length} on. A plugin switched off keeps its data, and comes back as it was.`),
      el('div', { class: 'feature-list plugins-list', role: 'list' }, main.map((f) => this.row(f, safe))),
      fold,
      safe ? null : el('div', { class: 'plugins-foot' },
        el('button', { type: 'button', class: 'word', onclick: () => this.app.restart(true) }, 'Start in safe mode'),
        ui.hint('Every plugin off, this time only. Holding Shift while Träumerei starts does the same.', { small: true })));
  }

  row(f, safe) {
    const id = f.manifest.id;
    const n = note(f);
    const kinds = kindWords(f);
    const asking = this.asking?.id === id ? this.asking : null;
    const sw = ui.toggle({
      checked: isOn(f),
      disabled: safe,
      label: `Use ${f.manifest.name}`,
      onChange: (checked) => { if (checked) this.turnOn(id); else this.turnOff(id); },
    });
    const row = el('div', { class: `feature-row plugins-row${isOn(f) ? '' : ' off'}`, role: 'listitem', 'data-plugin': id },
      el('div', { class: 'feature-text' },
        el('b', {}, f.manifest.name, kinds ? el('span', { class: 'plugins-kind' }, ` · ${kinds}`) : null),
        el('small', { class: n.problem ? 'plugins-problem' : '' }, n.text)),
      sw);
    if (!asking) return row;
    // Asked before turning off what others need: Enter turns them all off, Escape keeps them.
    const yes = el('button', { type: 'button', class: 'word', onclick: () => this.turnOff(id, true) }, 'Turn them off');
    const no = el('button', { type: 'button', class: 'word', onclick: () => { this.asking = null; this.redraw(); } }, 'Keep them on');
    const box = el('div', { class: 'plugins-ask', role: 'alertdialog', 'aria-label': `Turn off ${f.manifest.name}`,
      onkeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); no.click(); } } },
    el('p', {}, dependentsWords(f.manifest.name, asking.others.map((x) => this.name(x)))), yes, no);
    requestAnimationFrame(() => yes.focus());
    return el('div', {}, row, box);
  }
}
