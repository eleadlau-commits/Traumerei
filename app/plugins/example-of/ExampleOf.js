// Example of: a kind of link, "example of": this thought is a case of that one
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Its rows are the
// links table's and stay (and travel in files) when it is switched off. Saves nothing else.
import { Feature } from 'folio';

export const KIND = { kind: 'example of', name: 'Example of', note: 'this thought is a case of that one', both: false,
  admit: (from, to, reads) => reads.links.from(to, 'example of').some((r) => r.to === from) ? 'That one is already an example of this one' : true };

export function install(t) { t.slots.linkKinds.add(KIND); }

export default class ExampleOf extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
