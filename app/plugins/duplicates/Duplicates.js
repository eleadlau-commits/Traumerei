// Duplicates: a kind of link, "duplicates": the two say the same
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Its rows are the
// links table's and stay (and travel in files) when it is switched off. Saves nothing else.
import { Feature } from 'folio';

export const KIND = { kind: 'duplicates', name: 'Duplicates', note: 'the two say the same', both: true,
  admit: (from, to, reads) => true };

export function install(t) { t.slots.linkKinds.add(KIND); }

export default class Duplicates extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
