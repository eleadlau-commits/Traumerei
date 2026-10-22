// The menu: a panel that slides in from the left over most of the screen, with the rest of the
// app dimmed behind it. It closes when you tap the dimmed part, swipe the panel back to the left,
// press Escape, or press back (Android, or the browser's back button).
//
// Shell decides what goes in it (setContent); this file only makes it open, close and move.

import { el } from './ui.js';

const SLIDE_MS = 280; // keep in step with .menu-drawer's transition in base.css

export class Menu {
  constructor({ label = 'Menu' } = {}) {
    this.panel = el('div', { class: 'menu-panel', tabindex: '-1', autofocus: true });
    this.element = el('dialog', { class: 'menu-drawer', 'aria-label': label }, this.panel);
    this.closing = 0; // timer while the panel slides out
    this.inHistory = false; // a history entry was added, so back closes the menu
    this.ownBacks = 0; // history.back() calls made here, whose popstate should be ignored

    // Tap the dimmed part (the dialog itself, outside the panel) to close.
    this.element.addEventListener('click', (e) => { if (e.target === this.element) this.close(); });
    // Escape, and Android's back gesture in browsers that send it to the dialog.
    this.element.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
    // Closed some other way (e.g. by code that closes every window): tidy up.
    this.element.addEventListener('close', () => this.finish());
    // Back: the Android app and browsers go back one history step, which lands here.
    window.addEventListener('popstate', () => {
      if (this.ownBacks > 0) {
        this.ownBacks -= 1;
        return;
      }
      if (!this.inHistory) return;
      this.inHistory = false;
      this.close();
    });
    this.followSwipes();
    document.body.append(this.element);
  }

  get isOpen() {
    return this.element.open && !this.closing;
  }

  setContent(...nodes) {
    this.panel.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
  }

  open() {
    if (this.closing) {
      clearTimeout(this.closing);
      this.closing = 0;
    } else if (this.element.open) {
      return;
    } else {
      this.element.showModal();
      this.element.getBoundingClientRect(); // start from the closed position, so it slides in
    }
    this.panel.style.transform = '';
    this.element.classList.add('shown');
    if (!this.inHistory) {
      history.pushState({ folioMenu: true }, '', location.href);
      this.inHistory = true;
    }
  }

  // Slides the panel out, then closes it.
  close() {
    if (!this.element.open || this.closing) return;
    this.element.classList.remove('shown');
    this.panel.style.transform = '';
    const wait = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : SLIDE_MS;
    this.closing = setTimeout(() => {
      this.closing = 0;
      this.element.close();
    }, wait);
  }

  finish() {
    clearTimeout(this.closing);
    this.closing = 0;
    this.element.classList.remove('shown', 'dragging');
    this.panel.style.transform = '';
    if (this.inHistory) {
      this.inHistory = false;
      this.ownBacks += 1;
      history.back();
    }
  }

  // The panel follows a finger dragging it left, and closes if it went far enough or fast.
  followSwipes() {
    let start = null; // { x, y, at, dx, sideways }
    this.panel.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      start = { x: t.clientX, y: t.clientY, at: Date.now(), dx: 0, sideways: null };
    }, { passive: true });
    this.panel.addEventListener('touchmove', (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (start.sideways === null && Math.hypot(dx, dy) > 8) start.sideways = Math.abs(dx) > Math.abs(dy);
      if (!start.sideways) return;
      start.dx = Math.min(0, dx);
      this.element.classList.add('dragging');
      this.panel.style.transform = `translateX(${start.dx}px)`;
    }, { passive: true });
    const end = () => {
      if (!start) return;
      const { dx, at, sideways } = start;
      start = null;
      this.element.classList.remove('dragging');
      if (!sideways) return;
      const fast = dx < -40 && Date.now() - at < 250;
      if (dx < -this.panel.offsetWidth / 3 || fast) this.close();
      else this.panel.style.transform = '';
    };
    this.panel.addEventListener('touchend', end, { passive: true });
    this.panel.addEventListener('touchcancel', end, { passive: true });
  }
}
