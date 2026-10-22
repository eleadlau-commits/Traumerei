// __NAME__: __DESCRIPTION__
//
// Saved data: (list what this feature saves in this.storage, e.g. 'items' → [...])

import { Feature, ui } from 'folio';

const { el } = ui;

export default class __CLASS__ extends Feature {
  start() {
    // Add things to the app here. For example, a section in Settings:
    this.add('settings', {
      id: '__ID__',
      title: '__NAME__',
      order: 50,
      render: () => el('p', { class: 'hint' }, 'Hello from __NAME__.'),
    });
  }
}
