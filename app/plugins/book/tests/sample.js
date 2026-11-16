// A sample book, as the world's own tables: a room seen as Book, a book of three chapters (one with
// two sections), headings as thoughts that head their chapters, paragraphs in order, a gap still
// open, and two thoughts not yet in the book. The tests read it, and the sample .traum handed out
// with each stage is written from it. lib: the world's lib (world/lib.js).

export const TEXT = {
  title: 'The Lighthouse Keeper\'s Year',
  chapters: [
    { head: 'Winter', paras: [
      'The lamp is lit at four. In December the dark comes so early that the keeper eats breakfast by its light and supper by the same, and the day between is a grey interval that hardly counts.',
      'He keeps a log, as every keeper has, but his has grown longer than the rules ask. Beside the wind and the barometer he writes down what he saw: a seal on the north ledge, a trawler running late, the colour of the water when the sun came through for a minute at noon.',
      'Nobody reads the log. That, he says, is what makes it honest.',
    ], sections: [] },
    { head: 'Spring', paras: [
      'The supply boat comes back in March with flour, paraffin, letters and a crate of seedlings his sister sends every year, as if a rock in the sea could be persuaded to be a garden.',
    ], sections: [
      { head: 'The garden', paras: [
        'He plants them in the lee of the oil store, in soil carried out a bucket at a time over eleven summers. Most die. The ones that live are small and stubborn and he is fonder of them than of anything that grows easily.',
        'By May there are peas. He eats the first one standing up, in the wind, and writes it in the log.',
      ] },
      { head: 'Visitors', paras: [
        'Birdwatchers come in April, three of them, with telescopes and thermos flasks and a list of species they intend to see. They stay two nights and talk about almost nothing else.',
        'He likes them more than he expected to. They look at the island the way he did the first year, before he stopped seeing it.',
      ] },
    ] },
    { head: 'Summer', paras: [
      'In June it never quite gets dark. The lamp turns all night against a sky the colour of milk, and the keeper sleeps in the afternoons, when the light is strongest and the sea is flat.',
      'This is the season he would describe, if anyone asked him to describe the job: the long evenings, the gannets diving, the smell of hot stone and salt.',
      'Nobody does ask. He writes it down anyway.',
    ], sections: [] },
  ],
  open: 'Autumn: the storms, the last boat, the decision about whether to stay another year.',
  loose: ['A line for later: the lamp as the only clock that matters.', 'Check: when were lighthouses on this coast automated?'],
};

// Builds the sample in a fresh world; returns { w, room, book, chapters, paras, heads }.
export function sampleWorld(lib, now = 1_763_200_000_000) {
  let clock = now;
  const tick = () => (clock += 1000);
  const w = lib.model.emptyWorld(tick());
  return { w, ...sampleInto(lib, w, tick) };
}

// Builds the sample in a world there is (a test's host); tick() gives each moment its time.
export function sampleInto(lib, w, tick) {
  const { model, links: L, gaps: G } = lib;
  const room = model.addRoom(w, TEXT.title, tick(), {}, 'book-page');
  const group = (title, of) => model.create(w, room.id, { kind: 'group', of, title, family: true, x: 0, y: 0 }, tick());
  const line = (text) => model.create(w, room.id, { kind: 'line', text }, tick());
  const part = (g, id) => model.join(w, g.id, id);
  const book = group(TEXT.title, 'book');
  const chapters = [], paras = [], heads = [];
  const chapter = (holder, c) => {
    const ch = group(c.head, 'book-chapter');
    part(holder, ch.id);
    const h = line(c.head);
    part(ch, h.id);
    L.set(w, L.kindId('heads', h.id, ch.id), { from: h.id, to: ch.id, kind: 'heads' });
    chapters.push(ch.id); heads.push(h.id);
    for (const p of c.paras) { const th = line(p); part(ch, th.id); paras.push(th.id); }
    for (const s of c.sections || []) chapter(ch, s);
    return ch;
  };
  const made = TEXT.chapters.map((c) => chapter(book, c));
  const open = line(TEXT.open);
  part(made[made.length - 1], open.id);
  G.open(w, open.id, 'from world', tick());
  paras.push(open.id);
  for (const l of TEXT.loose) line(l);
  return { room: room.id, book: book.id, chapters, paras, heads };
}
