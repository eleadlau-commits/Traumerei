// The app's frame: one top bar (menu on the left; buttons and account on the right), a title for each
// view, the tab bar along the bottom, full-screen pages (such as a setup screen), the menu and
// the Settings and About windows. Features fill it through the framework's own slots:
//
//   'header.buttons'  { id, label, icon, order, onClick(), visible?(), busy?() }   rows in the menu
//   'account'         { name(), open() }   who is signed in, and their account page (the first item)
//   'header.status'   { order, text() }               short text in the menu and under view titles
//   'header.actions'  { id, label, icon, order, onClick(), visible?() }   icon buttons in the top bar,
//                       left of the account button
//   'views'           { id, label, icon?, order, mount(container, { head, actions }), render(), step?(direction),
//                       visible?(), start?, darkHead?, hideTitle?, subtitle?(), contains?(id), open?(id), subviews?() }
//   'settings'        { id, title?, order, render() }   a section in the Settings window
//
// See folio/README.md for details and examples.

import { el, icon, toast, onSwipe, ownsSwipe } from './ui.js';
import { Menu } from './Menu.js';
import { Settings } from './Settings.js';
import { Tabs } from './Tabs.js';

export class Shell {
  constructor(app) {
    this.app = app;
    this.settings = new Settings(app);
    this.sections = new Map(); // view → { section, head, title, subtitle, extra, body, mounted }
    this.screens = []; // [{ owner, node }], the last one is shown
    this.currentId = null; // the open view; the app always opens on the start view
    this.ready = false; // set by the app once every feature has started (and added its views)
    // A view asked for in the address (#view=week), read now because features may tidy the address.
    this.wanted = new URLSearchParams(location.hash.slice(1)).get('view');

    this.menuButton = el('button', { type: 'button', class: 'top-btn', 'aria-label': 'Menu', onclick: () => this.openMenu() }, icon('menu'));
    this.accountButton = el('button', { type: 'button', class: 'top-btn account', 'aria-label': 'Account', onclick: () => this.openAccount() }, icon('account'));
    this.actions = el('div', { class: 'top-actions' });
    this.viewHost = el('div', { class: 'view-host' });
    this.empty = el('div', { class: 'empty', hidden: true });
    this.screenHost = el('div', { class: 'screen-host', hidden: true });
    this.main = el('main', {}, this.viewHost, this.empty);
    this.tabBar = new Tabs((id) => this.selectView(id));
    this.tabs = this.tabBar.nav;

    const root = document.getElementById('folio-root') || document.body.appendChild(el('div', { id: 'folio-root' }));
    this.frame = el('div', { class: 'app' },
      el('header', { class: 'topbar' }, this.menuButton, el('div', { class: 'top-right' }, this.actions, this.accountButton)),
      this.screenHost,
      this.main,
      this.tabs);
    root.replaceChildren(this.frame);

    // Swiping sideways anywhere on the page goes to the next or previous tab, unless the swipe
    // belongs to something there (see ownsSwipe).
    onSwipe(this.main, (dir, start) => { if (!ownsSwipe(start, this.main)) this.tabBar.move(dir); });
    document.addEventListener('keydown', (e) => {
      if (this.main.hidden || document.querySelector('dialog[open]')) return;
      if (e.target.matches?.('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') this.step(-1);
      if (e.key === 'ArrowRight') this.step(1);
    });
  }

  // ---- Title ----

  // The name in the browser tab (the top bar itself has no title).
  setTitle(text) {
    document.title = text || this.app.config.name;
  }

  // ---- Full-screen pages, e.g. a setup screen shown before there's anything to see ----

  showScreen(owner, node) {
    this.screens = this.screens.filter((s) => s.owner !== owner);
    this.screens.push({ owner, node });
    this.render();
  }

  hideScreen(owner) {
    const before = this.screens.length;
    this.screens = this.screens.filter((s) => s.owner !== owner);
    if (this.screens.length !== before) this.render();
  }

  // ---- Views ----

  get views() {
    const slot = this.app.slot('views');
    return slot.items.filter((v) => slot.run(v, (x) => (x.visible ? x.visible() : true), false));
  }

  get currentView() {
    const views = this.views;
    // Wait until every feature has started before choosing, or an early redraw could pick a
    // view that happens to be there already instead of the start view.
    if (this.currentId === null && this.ready) {
      this.currentId = (views.find((v) => v.start) || views[0])?.id ?? null;
      if (this.wanted) this.selectView(this.wanted, { quiet: true });
    }
    return views.find((v) => v.id === this.currentId) || views.find((v) => v.start) || views[0] || null;
  }

  // Switches to a view, or to a view inside another (such as Day inside Planner). Returns false
  // if no view with that id is installed.
  selectView(id, { quiet = false } = {}) {
    const slot = this.app.slot('views');
    const views = this.views;
    let view = views.find((v) => v.id === id);
    if (!view) {
      view = views.find((v) => slot.run(v, (x) => !!x.contains?.(id), false));
      if (!view) return false;
      slot.run(view, (x) => x.open?.(id));
    }
    const changed = this.currentId !== view.id;
    this.currentId = view.id;
    if (!quiet) {
      if (changed) window.scrollTo(0, 0);
      this.render();
    }
    return true;
  }

  step(direction) {
    const view = this.currentView;
    if (view?.step) this.app.slot('views').run(view, (v) => v.step(direction));
  }

  // ---- Drawing ----

  render() {
    this.renderStatus();
    this.renderActions();
    if (this.menu?.isOpen) this.renderMenu();
    const screen = this.screens.at(-1);
    this.screenHost.hidden = !screen;
    this.main.hidden = !!screen;
    // Only a view that asks for it (darkHead) has the dark area under its title too.
    this.frame.classList.toggle('dark-head', !screen && !!this.currentView?.darkHead);
    if (screen) {
      this.tabs.hidden = true;
      if (this.screenHost.firstChild !== screen.node) this.screenHost.replaceChildren(screen.node);
      return;
    }
    this.screenHost.replaceChildren();
    this.renderViews();
  }

  renderStatus() {
    const parts = this.app.slot('header.status').map((s) => s.text());
    if (!navigator.onLine) parts.push('offline');
    this.statusText = parts.filter(Boolean).join(' · ');
  }

  // Buttons other features put in the top bar ('header.actions'), left of the account button.
  renderActions() {
    const slot = this.app.slot('header.actions');
    this.actions.replaceChildren(...slot.items
      .filter((a) => slot.run(a, (x) => (x.visible ? x.visible() : true), false))
      .map((a) => el('button', {
        type: 'button',
        class: 'top-btn top-action',
        'aria-label': a.label,
        title: a.label,
        onclick: () => slot.run(a, (x) => x.onClick()),
      }, icon(a.icon || 'plus'))));
  }

  renderViews() {
    const slot = this.app.slot('views');
    const views = this.views;
    const current = this.currentView;

    this.tabs.hidden = views.length < 2;
    this.tabBar.render(views, current);

    for (const v of views) {
      let part = this.sections.get(v);
      if (!part) {
        part = { title: el('h1'), subtitle: el('p', { class: 'page-sub' }), actions: el('div', { class: 'page-actions' }), extra: el('div', { class: 'page-extra' }), body: el('div', { class: 'page-body' }), mounted: false };
        part.head = el('div', { class: 'page-head' }, el('div', { class: 'page-title' }, part.title, part.subtitle, part.actions), part.extra);
        part.section = el('section', { class: `view view-${v.id}` }, part.head, part.body);
        this.sections.set(v, part);
        this.viewHost.append(part.section);
      }
      if (!part.mounted && v === current) {
        part.mounted = true;
        slot.run(v, (x) => x.mount?.(part.body, { head: part.extra, actions: part.actions }));
      }
      part.section.hidden = v !== current;
    }
    for (const [v, part] of this.sections) if (!views.includes(v)) part.section.hidden = true;

    this.empty.hidden = !!current;
    if (!current) {
      this.empty.replaceChildren(el('b', {}, 'Nothing to show yet'),
        el('div', {}, 'This app has no views installed. Add a view feature to the app/features folder.'));
      return;
    }
    const part = this.sections.get(current);
    part.title.parentNode.hidden = !!current.hideTitle;
    part.title.textContent = current.label;
    part.subtitle.textContent = slot.run(current, (v) => v.subtitle?.(), null) ?? this.statusText;
    slot.run(current, (v) => v.render?.());
  }

  // ---- Menu: who is signed in and the status line, then the rows ----
  // The rows are the 'header.buttons' items mixed in by `order` with the framework's own:
  // Account (10), Settings (60) and About (80). Leave room for features between them.

  openMenu() {
    if (!this.menu) this.menu = new Menu();
    this.renderMenu();
    this.menu.open();
  }

  closeMenu() {
    this.menu?.close();
  }

  renderMenu() {
    const slot = this.app.slot('header.buttons');
    const own = [
      { label: 'Account', icon: 'account', order: 10, onClick: () => this.openAccount() },
      { label: 'Settings', icon: 'gear', order: 60, onClick: () => this.openSettings() },
      { label: 'About', icon: 'info', order: 80, onClick: () => this.openAbout() },
    ];
    const theirs = slot.items
      .filter((b) => slot.run(b, (x) => (x.visible ? x.visible() : true), false))
      .map((b) => ({ ...b, order: b.order ?? 50, onClick: () => slot.run(b, (x) => x.onClick()), busy: slot.run(b, (x) => !!x.busy?.(), false) }));
    const rows = [...own, ...theirs].sort((a, b) => a.order - b.order).map((r) => el('button', {
      type: 'button',
      class: `menu-row${r.busy ? ' spin' : ''}`,
      onclick: () => {
        this.closeMenu();
        r.onClick();
      },
    }, icon(r.icon || 'plus'), el('span', {}, r.label)));
    const who = this.accountName();
    this.menu.setContent(
      el('button', {
        type: 'button',
        class: 'menu-top',
        'aria-label': who ? `Signed in as ${who}. Open your account` : 'Not signed in. Open your account',
        onclick: () => {
          this.closeMenu();
          this.openAccount();
        },
      },
      el('span', { class: 'menu-avatar' }, icon('account')),
      el('span', { class: 'menu-who' }, el('b', {}, who || 'Not signed in'), this.statusText && el('small', {}, this.statusText))),
      el('div', { class: 'menu-list' }, rows));
  }

  // ---- Account: the 'account' item, if a feature offers accounts ----

  // The signed-in person's name, or null.
  accountName() {
    const slot = this.app.slot('account');
    return slot.first((a) => a.name?.()) || null;
  }

  // Opens the account page, or says it's coming if no feature offers accounts yet.
  openAccount() {
    const slot = this.app.slot('account');
    const item = slot.items[0];
    if (item) slot.run(item, (a) => a.open());
    else toast('Account is coming soon.');
  }

  // ---- Settings and About (see Settings.js) ----

  openSettings() { this.settings.open(); }

  refreshSettings() { this.settings.refresh(); }

  closeSettings() { this.settings.close(); }

  openAbout() { this.settings.openAbout(); }
}
