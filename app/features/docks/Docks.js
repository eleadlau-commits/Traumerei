// The docks: a page fixed to the left edge and one fixed to the right edge of the screen, that other
// features open things in (dock.js is one of them). While a dock shows, its width is published as
// the CSS variable --dock-left / --dock-right on <html> (0px when it is shut) and in the event
// 'docks:resized', so whatever sits beside it (the room) moves over instead of being covered.
// Other features use them only through the `docks` service, and the right dock also through the
// older `panel` service (README.md lists both).

import { Feature } from 'folio';
import { Dock } from './dock.js';

const SIDES = ['left', 'right'];
const LABEL = { left: 'Left dock', right: 'Right dock' };

export default class Docks extends Feature {
  start() {
    this.docks = {};
    for (const side of SIDES) {
      this.docks[side] = new Dock({
        side,
        label: LABEL[side],
        saved: this.storage.get(side),
        keep: (px) => this.storage.set(side, px),
        resized: (px) => this.publish(side, px),
      });
    }
    const services = {};
    for (const side of SIDES) services[side] = this.service(this.docks[side]);
    this.provide('docks', services);
    this.provide('panel', services.right); // the side panel, as editors have always opened in it
    window.addEventListener('resize', () => { for (const side of SIDES) this.docks[side].refit(); });
  }

  // What another feature may do with one dock.
  service(dock) {
    return {
      open: (o) => dock.open(o),
      close: (key = null, force = false) => dock.close(key, force),
      isOpen: (key = null) => dock.isOpen(key),
      get width() { return dock.showing; },
    };
  }

  publish(side, px) {
    document.documentElement.style.setProperty(`--dock-${side}`, `${px}px`);
    this.emit('docks:resized', { side, width: px });
  }
}
