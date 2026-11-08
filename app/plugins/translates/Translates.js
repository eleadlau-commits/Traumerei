// Translates: a kind of link, "translates": this thought says that one in other words or another tongue
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Its rows are the
// links table's and stay (and travel in files) when it is switched off. Saves nothing else.
import { Feature } from 'folio';

export const KIND = { kind: 'translates', name: 'Translates', note: 'this thought says that one in other words or another tongue', both: false,
  admit: (from, to, reads) => reads.marks.text(from).trim() && reads.marks.text(from).trim() === reads.marks.text(to).trim() ? 'The same words are not a translation' : true };

export function install(t) { t.slots.linkKinds.add(KIND); }

export default class Translates extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
