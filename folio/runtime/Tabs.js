// The tab bar along the bottom: one tab per view. The selected tab is filled in the accent colour
// and the line above the bar glows over it. Both slide when the selection changes.
//
// Swiping left or right on the bar (or anywhere on the page, through move()) moves to the next
// or previous tab, stopping at the ends. While the finger is down, the bar shifts with it a little and the highlight moves
// part of the way towards the tab it's heading for. Tapping a tab works as usual.

import { el, icon } from './ui.js';

const DECIDE = 8; // px before a touch counts as sideways or not
const SWITCH = 30; // px of sideways swipe needed to change tab

export class Tabs {
  constructor(select) {
    this.select = select; // select(id) opens a view
    this.pill = el('span', { class: 'tab-pill', 'aria-hidden': 'true' });
    this.track = el('div', { class: 'tab-track' }, this.pill);
    this.nav = el('nav', { class: 'tabbar', 'aria-label': 'Main', hidden: true }, this.track);
    this.views = [];
    this.buttons = [];
    this.index = 0;
    this.drag = null; // { x, y, dx, sideways, pos } while a finger is on the bar
    this.swallowClick = false; // a swipe ends over a tab; that isn't a tap
    this.followSwipes();
  }

  render(views, current) {
    this.views = views;
    this.index = Math.max(0, views.indexOf(current));
    this.nav.style.setProperty('--tabs', Math.max(views.length, 1));
    this.buttons = views.map((v) => el('button', {
      type: 'button',
      class: 'tab',
      'aria-current': v === current ? 'page' : null,
      onclick: () => this.select(v.id),
    }, icon(v.icon || 'dots'), el('span', {}, v.label)));
    this.track.replaceChildren(this.pill, ...this.buttons);
    this.place(this.drag?.sideways ? this.drag.pos : this.index);
  }

  // Goes to the next (+1) or previous (-1) tab, stopping at the ends.
  move(direction) {
    const target = this.views[this.index + direction];
    if (target) this.select(target.id);
  }

  // Puts the highlight and glow at a tab (a fraction is between two tabs).
  place(pos) {
    const n = Math.max(this.views.length, 1);
    this.nav.style.setProperty('--pos', pos);
    this.nav.style.setProperty('--glow-x', `${((pos + 0.5) / n) * 100}%`);
    const lit = Math.round(pos);
    this.buttons.forEach((b, i) => b.classList.toggle('lit', i === lit));
  }

  followSwipes() {
    const nav = this.nav;
    nav.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.drag = { x: t.clientX, y: t.clientY, dx: 0, sideways: null, pos: this.index };
    }, { passive: true });

    nav.addEventListener('touchmove', (e) => {
      const d = this.drag;
      if (!d) return;
      const t = e.changedTouches[0];
      d.dx = t.clientX - d.x;
      const dy = t.clientY - d.y;
      if (d.sideways === null && Math.hypot(d.dx, dy) > DECIDE) d.sideways = Math.abs(d.dx) > Math.abs(dy);
      if (!d.sideways || this.views.length < 2) return;
      nav.classList.add('dragging');
      // Half a tab's movement for each tab-width the finger travels, at most one tab, and only a
      // little past either end.
      const width = this.track.offsetWidth / this.views.length || 1;
      const last = this.views.length - 1;
      let pos = this.index + Math.max(-1, Math.min(1, -d.dx / width / 2));
      if (pos < 0) pos *= 0.3;
      if (pos > last) pos = last + (pos - last) * 0.3;
      d.pos = pos;
      this.place(pos);
      nav.style.setProperty('--shift', `${Math.max(-12, Math.min(12, d.dx * 0.08))}px`);
    }, { passive: true });

    const end = () => {
      const d = this.drag;
      this.drag = null;
      nav.classList.remove('dragging');
      nav.style.setProperty('--shift', '0px');
      if (!d?.sideways) return;
      this.swallowClick = true;
      setTimeout(() => { this.swallowClick = false; }, 400);
      const target = Math.abs(d.dx) >= SWITCH ? this.index + (d.dx < 0 ? 1 : -1) : this.index;
      if (target !== this.index && this.views[target]) this.select(this.views[target].id);
      else this.place(this.index); // settle back where it was
    };
    nav.addEventListener('touchend', end, { passive: true });
    nav.addEventListener('touchcancel', end, { passive: true });
    nav.addEventListener('click', (e) => {
      if (!this.swallowClick) return;
      this.swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  }
}
