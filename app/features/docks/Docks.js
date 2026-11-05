// The docks: a page fixed to the left edge and one fixed to the right edge of the screen, that other
// features open things in (dock.js is one of them). While a dock shows, its width is published as
// the CSS variable --dock-left / --dock-right on <html> (0px when it is shut) and in the event
// 'docks:resized', so whatever sits beside it (the room) moves over instead of being covered.
// Other features use them only through the `docks` service, and the right dock also through the
// older `panel` service (README.md lists both).

import { Feature } from 'folio';
import { Dock } from './dock.js';
import { DOCK_KEYS } from './keys.js';

const SIDES = ['left', 'right'];
const LABEL = { left: 'Left dock', right: 'Right dock' };
const TAB = { left: '', right: 'Editor' }; // the tab a thing opens in when it names none

export default class Docks extends Feature {
  start() {
    this.docks = {};
    for (const side of SIDES) {
      this.docks[side] = new Dock({
        side,
        label: LABEL[side],
        tab: TAB[side],
        saved: this.storage.get(side),
        keep: (px) => this.storage.set(side, px),
        resized: (px) => this.publish(side, px),
        keyLabel: () => this.use('keys')?.label?.(`docks.${side}`) || '',
      });
    }
    const services = {};
    for (const side of SIDES) services[side] = this.service(this.docks[side]);
    services.canvasOnly = () => this.canvasOnly();
    this.provide('docks', services);
    this.provide('panel', services.right); // the side panel, as editors have always opened in it
    this.tuckedAll = null; // the docks Canvas only hid, to bring back
    const run = { 'docks.left': () => this.toggle('left'), 'docks.right': () => this.toggle('right'), 'docks.canvas': () => this.canvasOnly() };
    for (const k of DOCK_KEYS) this.add('keys', { ...k, zone: 'everywhere', run: run[k.id] });
    window.addEventListener('resize', () => { for (const side of SIDES) this.docks[side].refit(); });
  }

  // What another feature may do with one dock.
  service(dock) {
    return {
      open: (o) => dock.open(o),
      close: (key = null, force = false) => dock.close(key, force),
      closeAll: (force = false) => dock.closeAll(force),
      show: (key) => dock.show(key),
      isOpen: (key = null) => dock.isOpen(key),
      isShowing: (key) => dock.isShowing(key),
      toggle: () => this.toggle(dock.side),
      get shown() { return dock.visible; },
      get width() { return dock.showing; },
    };
  }

  // A dock's key: hides it, or brings it back, keeping what shows in it.
  toggle(side) {
    const dock = this.docks[side];
    this.tuckedAll = null;
    return dock.tuck(dock.visible);
  }

  // Canvas only: every dock that shows hides; the same again brings back just those.
  canvasOnly() {
    const showing = SIDES.filter((s) => this.docks[s].visible);
    if (showing.length) {
      for (const s of showing) this.docks[s].tuck(true);
      this.tuckedAll = showing;
    } else if (this.tuckedAll) {
      for (const s of this.tuckedAll) this.docks[s].tuck(false);
      this.tuckedAll = null;
    }
  }

  publish(side, px) {
    document.documentElement.style.setProperty(`--dock-${side}`, `${px}px`);
    this.emit('docks:resized', { side, width: px });
  }
}
