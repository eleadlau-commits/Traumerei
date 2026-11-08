// Cites: a kind of link, "cites": this thought draws on that one
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Its rows are the
// links table's and stay (and travel in files) when it is switched off. Saves nothing else.
import { Feature } from 'folio';

export const KIND = { kind: 'cites', name: 'Cites', note: 'this thought draws on that one', both: false,
  admit: (from, to, reads) => true };

export function install(t) { t.slots.linkKinds.add(KIND); }

export default class Cites extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
