// Spell marks: a wavy line under a misspelt word, and Ctrl+. to put the right spelling in: in the
// thought being written (at the caret), or in the chosen thought (as one step). A decorator plus
// the text seam. Its word list is a small one of common slips; a real checker would load a
// dictionary into t.store. A corpus plugin (open core, step 2): written against app/core/API.md alone.
import { Feature } from 'folio';

export const SLIPS = {
  teh: 'the', recieve: 'receive', seperate: 'separate', definately: 'definitely', occured: 'occurred',
  untill: 'until', wich: 'which', becuase: 'because', thier: 'their', alot: 'a lot', goverment: 'government',
  enviroment: 'environment', tommorow: 'tomorrow', begining: 'beginning', beleive: 'believe', freind: 'friend',
};

// Each misspelt word: { from, to, word, right }.
export function slips(text) {
  const out = [];
  for (const m of String(text).matchAll(/[\p{L}']+/gu)) {
    const right = SLIPS[m[0].toLowerCase()];
    if (right) out.push({ from: m.index, to: m.index + m[0].length, word: m[0], right: m[0][0] === m[0][0].toUpperCase() ? right[0].toUpperCase() + right.slice(1) : right });
  }
  return out;
}

export function install(t) {
  t.slots.decorators.add({ id: 'spell-marks', decorate: (text) => slips(text).map((s) => ({ from: s.from, to: s.to, class: 'wavy' })) });
  // While writing: the slip at the caret (or the last one before it).
  t.slots.commands.add({
    id: 'spell-marks.fix', keys: ['Ctrl+.'], words: 'put the right spelling in', zone: 'editing',
    run: () => {
      const c = t.ui.text.caret();
      if (!c) return;
      const s = slips(c.text).filter((x) => x.from <= c.to).pop();
      if (!s) { t.ui.toast('No misspelt word before the caret'); return; }
      t.ui.text.replace(c.mark, s.from, s.to, s.right);
    },
  });
  // On the chosen thought: every slip in it, as one step.
  t.slots.commands.add({
    id: 'spell-marks.fix-chosen', keys: ['Ctrl+Alt+.'], words: 'put the right spellings in the chosen thought', zone: 'room',
    run: () => {
      const id = t.ui.chosen()?.mark;
      const text = id ? t.marks.get(id)?.text : null;
      if (typeof text !== 'string') { t.ui.toast('Choose a thought first'); return; }
      const found = slips(text);
      if (!found.length) { t.ui.toast('Nothing misspelt here'); return; }
      t.together(() => { for (const s of found.reverse()) t.ui.text.replace(id, s.from, s.to, s.right); });
      t.ui.toast(found.length === 1 ? 'One word put right' : `${found.length} words put right`);
    },
  });
}

export default class SpellMarks extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
