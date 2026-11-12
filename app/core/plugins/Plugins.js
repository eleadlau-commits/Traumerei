// Plugins: Settings → Plugins, one row for every plugin (a feature in app/plugins/ with a plugin
// block): its name, what it adds, and why it isn't running if it isn't (rows.js), with a switch
// that works at once. A plugin switched off keeps its data; switched on, it carries on where it
// was. Turning one off that others need says which go with it first, and asks.
//
// Safe mode starts the app with every plugin off, this time only: the Settings word, ?safe in the
// address, or holding Shift while the app starts (Folio's App.safeMode).
//
// Import plugin… brings in a plugin packed into one file (a .traumplug, imported.js): checked as
// the compiler would, shown on a card the person accepts, kept in this feature's storage and
// started with the app from then on, handed only the plugin API. Remove takes it away again.
//
// It offers the `plugins` service (README.md). Saved data: `imported` { [id]: { text, at } }, the
// files of imported plugins (Folio keeps what is off, as 'folio.disabled').

import { Feature, ui, time, VERSION } from 'folio';
import { plugins, isOn, startsOff, note, kindWords, needsWords, dependentsWords, offMode } from './rows.js';
import { problem, loadModule, entry, oneWayIn, card } from './imported.js';

// What an imported plugin's `import … from 'folio'` reads.
const FOLIO = Object.freeze({ Feature, ui, time, VERSION });

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
      importText: (text) => this.importText(text),
      remove: (id) => this.removeImported(id),
      imported: () => Object.keys(this.storage.get('imported', {})),
    });
    // Imported plugins start once everything built in has (they need only the plugin API).
    this.ready = new Promise((done) => this.on('app:ready', () => this.startImported().then(done, done)));
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

  // What a plugin keeps on this computer (the store feature), with Clear; filled in once known.
  keeps(id) {
    const store = this.use('store');
    if (!store) return null;
    const line = el('small', { class: 'plugins-keeps', hidden: '' });
    store.used(id).then((n) => {
      if (!(n > 0)) return;
      line.hidden = false;
      line.replaceChildren(`Keeps ${store.size(n)} on this computer · `, el('button', { type: 'button', class: 'word plugins-clear',
        onclick: async () => { await store.clear(id); this.toast(`${this.name(id)}'s files are cleared`); this.redraw(); } }, 'Clear'));
    }, () => {});
    return line;
  }

  // ---- Imported plugins ----

  get appInfo() {
    const c = this.app.config || {};
    return { version: c.version || '1.0.0', pluginApi: c.pluginApi || 1, pluginKinds: c.pluginKinds || null, pluginNeeds: c.pluginNeeds || {} };
  }

  // Starts every kept import; one that no longer passes the checks shows why, with Remove.
  async startImported() {
    for (const [id, kept] of Object.entries(this.storage.get('imported', {}))) {
      let mod = null, why = '';
      try { mod = await loadModule(kept.text); why = problem(mod, kept.text, this.appInfo, (x) => this.app.features.has(x)); } catch (err) { why = `Its file couldn't be read: ${err.message}`; }
      if (why) {
        const m = mod?.manifest?.id === id ? mod.manifest : { id, name: id, plugin: { api: 1, minApp: '1.0.0' } };
        await this.app.addFeature(entry(m), { default: class extends Feature { start() { throw new Error(why); } } });
        continue;
      }
      await this.run(mod);
    }
  }

  // Hands the plugin its folio, holds one way in, puts its styles on the page and starts it.
  async run(mod) {
    const m = mod.manifest;
    let Plugin;
    try { Plugin = oneWayIn(mod.default(FOLIO)); } catch (err) { Plugin = class extends Feature { start() { throw err; } }; }
    document.head.querySelector(`style[data-plugin="${m.id}"]`)?.remove();
    if (mod.css) document.head.append(ui.el('style', { 'data-plugin': m.id }, mod.css));
    return this.app.addFeature(entry(m), { default: Plugin });
  }

  // Reads a package and, when it passes the checks, offers it on the import card. The problem in
  // words, or '' when the card is up.
  async importText(text) {
    let mod;
    try { mod = await loadModule(text); } catch (err) { return this.offerFailed(`This file isn't a plugin Träumerei can read (${err.message}).`); }
    const why = problem(mod, text, this.appInfo, (x) => this.app.features.has(x));
    if (why) return this.offerFailed(why);
    this.offer = { text, mod };
    this.redraw();
    return '';
  }

  offerFailed(why) { this.offer = { problem: why }; this.redraw(); return why; }

  // The person accepted the card: kept, and started now and at every start.
  async accept() {
    const o = this.offer;
    this.offer = null;
    if (!o?.mod) return false;
    const m = o.mod.manifest;
    this.storage.set('imported', { ...this.storage.get('imported', {}), [m.id]: { text: o.text, at: Date.now() } });
    await this.run(o.mod);
    const f = this.app.features.get(m.id);
    this.toast(isOn(f) ? `${m.name} is imported and on` : `${m.name} is imported, but couldn't start: ${f?.reason || 'not available'}`);
    this.redraw();
    return isOn(f);
  }

  removeImported(id) {
    const kept = { ...this.storage.get('imported', {}) };
    if (!kept[id]) return false;
    const name = this.name(id);
    delete kept[id];
    this.storage.set('imported', kept);
    this.app.removeFeature(id);
    document.head.querySelector(`style[data-plugin="${id}"]`)?.remove();
    this.toast(`${name} is removed`);
    this.redraw();
    return true;
  }

  // Import plugin…: a .traumplug from this computer (the webview shows Windows' Open dialog).
  pick() {
    const input = ui.el('input', { type: 'file', accept: '.traumplug', hidden: '' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (file) await this.importText(await file.text());
    });
    document.body.append(input);
    input.click();
  }

  importCard() {
    const o = this.offer;
    if (!o) return null;
    const cancel = el('button', { type: 'button', class: 'word', onclick: () => { this.offer = null; this.redraw(); } }, o.problem ? 'Close' : 'Cancel');
    if (o.problem) return el('div', { class: 'plugins-import', role: 'alert' }, el('p', { class: 'plugins-problem' }, o.problem), cancel);
    const c = card(o.mod.manifest, this.appInfo);
    const yes = el('button', { type: 'button', class: 'word', onclick: () => this.accept() }, 'Import');
    requestAnimationFrame(() => yes.focus());
    return el('div', { class: 'plugins-import', role: 'dialog', 'aria-label': `Import ${c.title}`,
      onkeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel.click(); } } },
    el('b', {}, c.title, c.by ? el('span', { class: 'plugins-kind' }, ` · ${c.by}`) : null),
    c.description ? el('p', {}, c.description) : null,
    c.adds ? el('p', { class: 'hint small' }, c.adds) : null,
    el('p', { class: 'hint small' }, c.needs),
    c.sidecar ? el('p', { class: 'hint small' }, c.sidecar) : null,
    el('p', { class: 'hint small' }, 'It reaches your rooms only through the plugin API, and Remove takes it away again.'),
    el('div', { class: 'row' }, yes, cancel));
  }

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
      this.importCard(),
      el('p', { class: 'hint' }, `${on} of ${all.length} on. A plugin switched off keeps its data, and comes back as it was.`),
      el('div', { class: 'feature-list plugins-list', role: 'list' }, main.map((f) => this.row(f, safe))),
      fold,
      safe ? null : el('div', { class: 'plugins-foot' },
        el('button', { type: 'button', class: 'word plugins-import-word', onclick: () => this.pick() }, 'Import plugin…'),
        ui.hint('A plugin packed into one .traumplug file.', { small: true }),
        el('button', { type: 'button', class: 'word', onclick: () => this.app.restart(true) }, 'Start in safe mode'),
        ui.hint('Every plugin off, this time only. Holding Shift while Träumerei starts does the same.', { small: true })));
  }

  row(f, safe) {
    const id = f.manifest.id;
    const n = note(f);
    const kinds = kindWords(f, this.app.config?.pluginKinds);
    const needs = needsWords(f, this.app.config?.pluginNeeds);
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
        el('small', { class: n.problem ? 'plugins-problem' : '' }, n.text),
        needs ? el('small', { class: 'plugins-needs' }, needs) : null,
        this.keeps(id),
        f.manifest.imported ? el('button', { type: 'button', class: 'word plugins-remove', onclick: () => this.removeImported(id) }, 'Remove') : null),
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
