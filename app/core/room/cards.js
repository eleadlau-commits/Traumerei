// Part of the room feature. A card's line of counts: what a card (a plugin's book) holds, said
// in a few words, so the card on the canvas shows its title and counts, not every thought's words.

// held: everything inside the card, at any depth. nameOf(x): a group's family name ('Chapter'),
// or null for a thought. Groups come first, by family, in the order first met; thoughts last.
export function countsLine(held, nameOf) {
  const groups = new Map();
  let leaves = 0;
  for (const x of held) {
    const name = nameOf(x);
    if (!name) { leaves++; continue; }
    const key = String(name).toLowerCase();
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  const say = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [...[...groups].map(([name, n]) => say(n, name)), say(leaves, 'thought')].join(' · ');
}
