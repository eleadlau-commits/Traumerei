// Picture: pictures in a room, a plugin. It adds one item kind (item.js) through the plugin API
// (app/core/API.md): the room's Add menu, the loose tray's +, Alt+I, pasting and dropping a
// picture file, the sheet and the Editor all come from that kind. Switched off, every picture is
// kept exactly as it is and shows as a quiet stand-in, until it is on again.

import { Feature } from 'folio';
import { picture } from './item.js';

export default class Picture extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Picture needs the plugin API');
    t.items.add(picture({ maths: t.maths.maths, shrinkPicture: t.pictures.shrinkPicture }));
  }
}
