// The Settings window and the About window.
//
// Settings: Appearance (Automatic, Light or Dark) first, then the 'settings' sections from
// features, then the framework's own two:
//   Features  switches to turn features on and off for this phone, folded away until opened
//   About     the app's name and version, and any problems since it opened
// About is also its own small window, opened from the menu.

import { el, dialog, toggle, hint } from './ui.js';
import { APPEARANCES, applyAppearance, startAppearance } from './appearance.js';

export class Settings {
  constructor(app) {
    this.app = app;
    this.prefs = app.storage.area('folio');
    startAppearance(this.prefs.get('appearance', 'auto'));
    this.restartNeeded = false;
    this.featuresOpen = false; // the Features list stays as it was while the window is redrawn
  }

  // ---- Settings window ----

  open() {
    if (!this.window) this.window = dialog({ title: 'Settings', className: 'settings-dialog', onClose: () => { this.featuresOpen = false; } });
    this.render();
    this.window.open();
  }

  // Redraws the window if it's open, e.g. after a section's data changed.
  refresh() {
    if (this.window?.isOpen) this.render();
  }

  close() {
    this.window?.close();
  }

  render() {
    const slot = this.app.slot('settings');
    const sections = slot.map((s) => {
      const body = s.render();
      if (!body) return null;
      return el('section', { class: 'settings-section' }, s.title && el('h3', { class: 'sub-head' }, s.title), body);
    });
    this.window.setContent(this.appearanceSection(), ...sections, this.featuresSection(), el('section', { class: 'settings-section about' },
      el('h3', { class: 'sub-head' }, 'About'), ...this.aboutParts()));
  }

  // Light or dark: follow the phone, or always one of them. Saved as 'appearance' on this phone.
  appearanceSection() {
    const current = this.prefs.get('appearance', 'auto');
    const choose = (mode) => {
      this.prefs.set('appearance', mode);
      applyAppearance(mode);
      this.render();
    };
    return el('section', { class: 'settings-section' },
      el('h3', { class: 'sub-head' }, 'Appearance'),
      el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Appearance', style: `--tabs:${APPEARANCES.length}` },
        APPEARANCES.map(([mode, label]) => el('button', {
          type: 'button', role: 'radio', 'aria-checked': String(mode === current), 'aria-selected': String(mode === current), onclick: () => choose(mode),
        }, label))),
      hint(current === 'auto' ? 'Follows your phone\'s light or dark setting.' : `Always ${current}, whatever your phone is set to.`, { small: true }));
  }

  featuresSection() {
    const disabled = new Set(this.prefs.get('disabled', []));
    const features = [...this.app.features.values()].filter((f) => f.status !== 'not-for-platform');
    const rows = features.map((f) => {
      const on = !disabled.has(f.manifest.id);
      const note = {
        active: f.problem ? `Had a problem: ${f.problem}` : f.manifest.description,
        failed: `Couldn't start: ${f.reason}`,
        disabled: 'Switched off',
        skipped: f.reason,
      }[f.status] || f.manifest.description;
      return el('div', { class: `feature-row${f.status === 'active' ? '' : ' off'}` },
        el('div', { class: 'feature-text' }, el('b', {}, f.manifest.name), el('small', {}, note)),
        toggle({
          checked: on,
          label: `Use ${f.manifest.name}`,
          onChange: (checked) => {
            if (checked) disabled.delete(f.manifest.id);
            else disabled.add(f.manifest.id);
            this.prefs.set('disabled', [...disabled]);
            this.restartNeeded = true;
            this.render();
          },
        }));
    });
    const off = features.filter((f) => f.status !== 'active').length;
    const fold = el('details', { class: 'advanced features-fold', open: this.featuresOpen, ontoggle: () => { this.featuresOpen = fold.open; } },
      el('summary', {}, 'Features', el('small', {}, off ? `${features.length - off} on, ${off} off` : `All ${features.length} on`)),
      hint('Switch off anything you don\'t use. Features that need a switched-off feature are switched off too.', { small: true }),
      el('div', { class: 'feature-list' }, rows));
    return el('section', { class: 'settings-section' },
      fold,
      this.restartNeeded && el('button', { type: 'button', class: 'btn primary', onclick: () => location.reload() }, 'Restart the app to apply'));
  }

  // ---- About ----

  aboutParts() {
    const { name, version, build, framework } = this.app.config;
    const problems = this.app.problems;
    return [
      hint(`${name} ${version}${build ? ` (build ${build})` : ''} · Made with Folio ${framework}`, { small: true }),
      problems.length > 0 && el('details', { class: 'advanced' },
        el('summary', {}, `${problems.length} problem${problems.length > 1 ? 's' : ''} since the app opened`),
        el('ul', { class: 'problems' }, problems.slice(-20).map((p) => el('li', {}, `${p.feature || 'app'}: ${p.message}${p.where ? ` (${p.where})` : ''}`)))),
    ];
  }

  openAbout() {
    if (!this.about) this.about = dialog({ title: 'About', className: 'about-dialog' });
    const { description } = this.app.config;
    this.about.setContent(description && hint(description), ...this.aboutParts());
    this.about.open();
  }
}
