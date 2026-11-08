// Contradicts: a kind of link, "contradicts": the two cannot both hold
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Its rows are the
// links table's and stay (and travel in files) when it is switched off. Saves nothing else.
import { Feature } from 'folio';

export const KIND = { kind: 'contradicts', name: 'Contradicts', note: 'the two cannot both hold', both: true,
  admit: (from, to, reads) => true };

export function install(t) { t.slots.linkKinds.add(KIND); }

export default class Contradicts extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
