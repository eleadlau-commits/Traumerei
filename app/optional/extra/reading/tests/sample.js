// The sample library, as the world's own tables: a room seen as Library holding four public-domain
// sources (Darwin, Mill, Thoreau, Wollstonecraft), each with its metadata, a citation key and a
// short stream of notes. No source text: only a few short quotations and comments. The tests read
// it, the speed budgets open it (tests/speed.mjs --world), and the sample .traum handed out with
// each stage is written from it (node app/optional/extra/reading/tests/write-sample.mjs).
// lib: the world's lib (world/lib.js).

export const LIBRARY = 'Reading notes: a sample library';

export const SOURCES = [
  { title: 'On the Origin of Species by Means of Natural Selection', type: 'book', citekey: 'darwin1859origin', authors: ['Darwin, Charles'], year: '1859', edition: '1st', publisher: 'John Murray', notes: [
    '"There is grandeur in this view of life, with its several powers, having been originally breathed into a few forms or into one."',
    'The closing paragraph answers the book\'s critics in advance: wonder survives the mechanism.',
    'Compare the "tangled bank" image with Thoreau\'s pond: both make one place stand for the whole.',
  ] },
  { title: 'On Liberty', type: 'book', citekey: 'mill1859liberty', authors: ['Mill, John Stuart'], year: '1859', publisher: 'John W. Parker and Son', notes: [
    '"The only freedom which deserves the name, is that of pursuing our own good in our own way, so long as we do not attempt to deprive others of theirs."',
    'The harm principle in one sentence. Where does Mill put speech that only offends?',
  ] },
  { title: 'Walden; or, Life in the Woods', type: 'book', citekey: 'thoreau1854walden', authors: ['Thoreau, Henry David'], year: '1854', publisher: 'Ticknor and Fields', notes: [
    '"I went to the woods because I wished to live deliberately, to front only the essential facts of life."',
    'The ledger of costs in "Economy" is the book\'s method in small: count everything, then ask what it was for.',
  ] },
  { title: 'A Vindication of the Rights of Woman', type: 'book', citekey: 'wollstonecraft1792vindication', authors: ['Wollstonecraft, Mary'], year: '1792', publisher: 'J. Johnson', notes: [
    '"I do not wish them to have power over men; but over themselves."',
    'Education as the hinge of the whole argument: read with Mill on liberty of thought.',
  ] },
];

// Builds the sample in a fresh world; returns { w, room, sources, notes }.
export function sampleWorld(lib, now = 1_795_400_000_000) {
  let clock = now;
  const tick = () => (clock += 1000);
  const w = lib.model.emptyWorld(tick());
  return { w, ...sampleInto(lib, w, tick) };
}

// Builds the sample in a world there is (a test's host); tick() gives each moment its time.
export function sampleInto(lib, w, tick) {
  const { model } = lib;
  const room = model.addRoom(w, LIBRARY, tick(), {}, 'reading-library');
  const sources = [], notes = [];
  for (const s of SOURCES) {
    const { notes: words, ...fields } = s;
    const g = model.create(w, room.id, { kind: 'group', of: 'reading-source', family: true, x: 0, y: 0, ...fields }, tick());
    sources.push(g.id);
    for (const text of words) {
      const th = model.create(w, room.id, { kind: 'line', text }, tick());
      model.join(w, g.id, th.id);
      notes.push(th.id);
    }
  }
  return { room: room.id, sources, notes };
}
