// Focus mode: one key (Ctrl+Alt+Shift+F) hides every dock and names, in the status bar, the one
// thing to do in this room: the chosen thought's open gap, else the room's oldest. Again brings
// the docks back. A corpus plugin (kernel phase 8): written against app/core/API.md alone.
// Saves nothing.
import { Feature } from 'folio';

export function oneThing(t, context, mark = null) {
  const own = mark && t.gaps.of(mark);
  const g = own && !own.derived && own.state === 'open' ? own : t.gaps.oldest(context);
  return g ? t.marks.text(g.mark) : null;
}

export function install(t) {
  let on = false;
  t.slots.commands.add({ id: 'focus.toggle', keys: ['Ctrl+Alt+Shift+F'], zone: 'room', order: 75, words: 'Focus: hide the docks and name the one thing to do',
    run: () => {
      on = !on;
      t.ui.docks?.canvasOnly();
      const c = t.ui.chosen();
      const thing = on && c ? oneThing(t, c.context, c.mark) : null;
      if (on) t.ui.frame?.hint(thing ? `Focus: ${thing}` : 'Focus: nothing open here'); else t.ui.frame?.clearHint();
      t.ui.toast(on ? (thing ? `Focus: ${thing}` : 'Focus') : 'Focus off');
    } });
}

export default class FocusMode extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
