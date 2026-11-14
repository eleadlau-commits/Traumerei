// The general exam for embed: 60 short thoughts in six topics, written for these tests (plain,
// personal notes like a maker's). A good embedder puts each thought's nearest neighbours in its
// own topic. Shared by the unit tests and exam.mjs, so the score means the same in both.

export const TOPICS = {
  sleep: ["I wake at four and the house is louder than the day.", "Dreams fade faster when I check my phone first thing.", "Napping after lunch ruins the evening's focus.", "The best ideas come in the minutes before falling asleep.", "My grandmother kept a notebook by her bed for dreams.", "Insomnia feels like a waiting room with no clerk.", "Night shifts changed how my father talked to us.", "A dark room and no screens: still the only cure that works.", "Counting sheep never worked; counting breaths sometimes does.", "Sleep is the one appointment I keep missing."],
  cooking: ["Bread needs patience more than skill.", "My soup tastes better on the second day.", "Salt at the end, never the start, my aunt said.", "Cooking for one feels like talking to myself.", "The smell of onions in butter means home.", "A recipe is a promise someone else kept.", "I burned the rice again while reading.", "Fermenting cabbage on the windowsill smells like a science fair.", "The market tomatoes in August are a different fruit.", "Knife skills are mostly about not being afraid."],
  memory: ["I remember the street but not the name of the friend who lived there.", "Photos replace the memory they were meant to keep.", "The smell of chalk brings back the whole classroom.", "Forgetting is how the mind tidies its desk.", "My first apartment survives only in one song.", "Old letters show who I pretended to be.", "We remember endings more than middles.", "Diaries lie less than recollection.", "Each time I tell the story it changes a little.", "Proust's madeleine is every cup of tea at my mother's."],
  money: ["Rent took half the paycheck again.", "Saving feels like paying a future stranger.", "I keep a spreadsheet I never open.", "Cheap shoes cost more by winter.", "Talking about salary is still taboo at work.", "Debt is borrowed time, not borrowed money.", "The budget app made me feel watched.", "Buying books I won't read is my only luxury.", "Inflation means my coffee budget shrinks each month.", "Freelance income comes in floods and droughts."],
  music: ["The piano in the hall was never in tune.", "I practise scales to stop thinking.", "A minor key can make any lyric sad.", "The concert ended and nobody wanted to clap first.", "Learning a song by ear feels like eavesdropping.", "Schumann wrote Träumerei for adults remembering childhood.", "My band broke up over a drummer's tempo.", "Silence between notes does half the work.", "Headphones make the bus a private cinema.", "Choir taught me to listen before singing."],
  logic: ["Every definition hides an assumption.", "A proof is a story where nothing is allowed to happen by luck.", "Russell's paradox broke the set of all sets.", "If the premise is false, anything follows.", "Counterexamples are cheaper than proofs.", "Induction is a ladder you build while climbing.", "Logic tells you what follows, not what is true.", "A good axiom feels obvious only afterwards.", "Contradictions are signposts, not dead ends.", "The halting problem shows some questions cannot be settled by machines."],
};

export const THOUGHTS = Object.entries(TOPICS).flatMap(([topic, list]) => list.map((text, i) => ({ id: `${topic}-${i}`, text, topic })));

// The share of each item's k nearest neighbours (by dot product of unit vectors) in its own topic.
export function sameTopic(items, vectors, k = 5) {
  const { dim, data } = vectors;
  const n = items.length;
  let hit = 0;
  for (let i = 0; i < n; i++) {
    const s = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      let d = 0;
      for (let x = 0; x < dim; x++) d += data[i * dim + x] * data[j * dim + x];
      s.push([d, j]);
    }
    s.sort((a, b) => b[0] - a[0]);
    for (const [, j] of s.slice(0, k)) if (items[j].topic === items[i].topic) hit++;
  }
  return n ? hit / (n * k) : 0;
}

// True when every row is unit length (within a little).
export const unitRows = ({ dim, data }) => {
  for (let i = 0; i < data.length / dim; i++) {
    let s = 0;
    for (let x = 0; x < dim; x++) s += data[i * dim + x] ** 2;
    if (Math.abs(Math.sqrt(s) - 1) > 1e-3) return false;
  }
  return dim > 0;
};

// A room of n thoughts, each two of the exam's sentences joined (about 25 words), all different;
// another `salt` gives other texts, so an engine that keeps vectors has none of them yet.
export const room = (n, salt = '') => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, text: `${THOUGHTS[i % 60].text} ${THOUGHTS[(i * 7 + Math.floor(i / 60)) % 60].text} (${salt}${i})` }));
