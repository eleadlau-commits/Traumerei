// The template rooms, as .traum text (app/plugins/roomfile/FORMAT.md), and when the chooser shows.
// Plain functions of the time they are made at: nothing here touches the screen or the world.
//
// Each template is a room in a shape people already know, built only from what the app already
// has (marks, places, links, gaps, moments; the four shapes). None adds a primitive, a mode or a
// plugin. Each runs out within the first hour at the point the handbook names, where one of the
// primitives takes over: the To-do list at a dependency (Russell), the Essay at "how much is
// left" (the desk), Reading notes at the question on each card (gaps), the Weekly plan at Friday
// (returns rolled over).

const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString();
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Thursday 12 Nov", in local time.
export const dayName = (ms) => { const d = new Date(ms); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
// "28 Nov".
export const shortDate = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
// Nine in the morning, local time, `days` after the day of `ms`.
export const nineOn = (ms, days = 0) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 9).getTime(); };

// Words of a mark: a line starting with # or \ is written with a \ before it (FORMAT.md).
const body = (text) => text.split('\n').map((l) => (/^[#\\]/.test(l) ? `\\${l}` : l)).join('\n');

// Writes a room from plain rows. `marks`: { id, kind, name?, fields?, text? } (the room first);
// `places`, `links`, `gaps`, `moments`: lines as FORMAT.md writes them, without their section.
export function traum({ marks, places = [], links = [], gaps = [], moments = [] }) {
  const out = ['---', 'format: traum/3', 'guide: https://github.com/eleadlau-commits/Traumerei/blob/main/app/plugins/roomfile/FORMAT.md', `context: ^${marks[0].id}`, '---', '', '# Marks', ''];
  for (const m of marks) {
    out.push(`## ^${m.id} ${m.kind}${m.name ? `: ${m.name}` : ''}`);
    for (const [k, v] of Object.entries(m.fields || {})) out.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    if (m.text) { if (m.fields && Object.keys(m.fields).length) out.push(''); out.push(body(m.text)); }
    out.push('');
  }
  for (const [title, rows] of [['Places', places], ['Links', links], ['Gaps', gaps], ['Moments', moments]]) {
    if (rows.length) out.push(`# ${title}`, ...rows, '');
  }
  return out.join('\n');
}

// Thoughts made a second apart, in the order given, so a flow shows them in that order. Every
// time is in the past (a mark made after now is not there yet); only what is due lies ahead.
const START = 120000; // the room is made two minutes before it lands
const made = (now, i) => ({ made: iso(now - START + i * 1000) });
const open = (now, id, direction) => `^${id} open ${direction} | opened: ${iso(now - START / 2)}`;
const done = (now, id, direction) => `^${id} resolved ${direction} | opened: ${iso(now - START / 2)} | resolved: ${iso(now - START / 4)} | by: judgement`;

// To-do list: a plain list you tick. A Pessoa room laid out as one column, every item a gap to do;
// a tick (Ctrl+Alt+G) closes it. It runs out when one item waits on another: Russell shows that.
export function todo(now) {
  const items = [
    ['Write one thing to do per thought. Enter keeps it and starts the next, already a thing to do.', 'open'],
    ['Tick a thing off: choose it and press Ctrl+Alt+G. This one is ticked.', 'done'],
    ['Book the dentist', 'open'],
    ['Buy paint for the hall', 'open'],
    ['Paint the hall (needs the paint first)', 'open'],
    ['When one thing waits on another, a flat list has run out. Switch this room to Russell and put the waiting thing under what it waits for: now you see what blocks what.', null],
  ];
  const marks = [{ id: 'room', kind: 'room', name: 'To do: everything here ticked', fields: { mode: 'pessoa', ...made(now, 0) } }];
  const places = [], gaps = [];
  items.forEach(([text, state], i) => {
    const id = `t${i + 1}`;
    marks.push({ id, kind: 'line', fields: made(now, i + 1), text });
    places.push(`^${id} in ^room`, `^${id} in ^room | rule: pessoa | at: {x: 0, y: ${i * 120}}`);
    if (state === 'open') gaps.push(open(now, id, 'from world'));
    if (state === 'done') gaps.push(done(now, id, 'from world'));
  });
  return traum({ marks, places, gaps });
}

// Essay or report: headings with notes under them. A Joyce room named after the finished text,
// each heading a passage carrying the gap "not written" (to judge). It runs out when you want to
// know how much is left: the desk says, and Export gives the text when nothing is open.
export function essay(now) {
  const due = shortDate(now + 21 * DAY);
  const notWritten = 'Not written. Put notes for it as thoughts beside it; write the section here when you are ready, then close its gap (Ctrl+Alt+G).';
  const marks = [
    { id: 'room', kind: 'room', name: `Essay: its title, 3,000 words, due ${due}`, fields: { mode: 'joyce', ...made(now, 0) } },
    { id: 'name', kind: 'line', fields: made(now, 1), text: 'Name the room after the finished text: its title, its length, its date. The name is the finish line.' },
    { id: 's1', kind: 'passage', name: 'Introduction', fields: made(now, 2), text: notWritten },
    { id: 's2', kind: 'passage', name: 'First argument', fields: made(now, 3), text: notWritten },
    { id: 's3', kind: 'passage', name: 'Second argument', fields: made(now, 4), text: notWritten },
    { id: 's4', kind: 'passage', name: 'Conclusion', fields: made(now, 5), text: notWritten },
    { id: 'left', kind: 'line', fields: made(now, 6), text: 'How much is left? Open the desk (Ctrl+Alt+D): every section still open is there. When nothing is open, Export gives you the text.' },
  ];
  // Joyce holds every thought in a train: each heading is a train of its own, one under another.
  const items = marks.slice(1);
  items.forEach((m, i) => marks.push({ id: `r${i + 1}`, kind: 'group', name: '', fields: { of: 'joyce', made: m.fields.made } }));
  return traum({
    marks,
    places: [...items.map((m) => `^${m.id} in ^room`),
      ...items.flatMap((m, i) => [`^r${i + 1} in ^room`, `^r${i + 1} in ^room | rule: joyce | at: {x: 0, y: ${i * 200}}`])],
    links: items.map((m, i) => `^${m.id} part of ^r${i + 1} | order: 0`),
    gaps: [open(now, 'name', 'from world'), ...['s1', 's2', 's3', 's4'].map((id) => open(now, id, 'to maker'))],
  });
}

// Reading notes: one card per book or paper. A Proust room, each source a thought, relations
// drawn as you notice them. It runs out at the gap on every card, "what does this mean for my
// project": closing those is the real reading.
export function reading(now) {
  const ask = 'What does this mean for my project?';
  const marks = [
    { id: 'room', kind: 'room', name: 'Reading for my project', fields: { mode: 'proust', ...made(now, 0) } },
    { id: 'p', kind: 'line', fields: made(now, 1), text: 'My project: say here what you are reading for. Every card answers to this.' },
    { id: 'c1', kind: 'line', fields: made(now, 2), text: `A book: author, title, year. One line on what it says.\n${ask}` },
    { id: 'c2', kind: 'line', fields: made(now, 3), text: `A paper: author, title, year. One line on what it says.\n${ask}` },
    { id: 'c3', kind: 'line', fields: made(now, 4), text: `An article or a talk: who, where. One line on what it says.\n${ask}` },
    { id: 'how', kind: 'line', fields: made(now, 5), text: 'One card per source. When two cards speak to each other, draw a line between them. The question on each card stays open until you have answered it: closing those is the real reading.' },
  ];
  return traum({
    marks,
    places: marks.slice(1).map((m) => `^${m.id} in ^room`),
    gaps: [open(now, 'p', 'to maker'), ...['c1', 'c2', 'c3'].map((id) => open(now, id, 'to maker'))],
  });
}

// Weekly plan: seven days with things under each. A Joyce room of seven days from today, side by
// side, each a train headed by its day; each thing on a day is a thing to do, due on that day, so it comes back then (Returns,
// the desk). It runs out on Friday: what is not done rolls on (Tomorrow, in Returns) instead of
// being copied, and the same thing rolling three times is a question worth asking.
export function week(now) {
  const notes = {
    0: 'Put each thing under the day you mean to do it. It comes back on that day, in Returns and on the desk.',
    1: 'Not done on its day? Press Tomorrow in Returns: it rolls on by itself. Nothing is copied to next week.',
    4: 'A thing that has rolled on three times is a question: is it still wanted, or is it too big? Ask it on Sunday.',
    6: 'Sunday: the look. Half an hour with each room that still has open gaps, then set returns for the week.',
  };
  const marks = [{ id: 'room', kind: 'room', name: `The week from ${dayName(now)}`, fields: { mode: 'joyce', ...made(now, 0) } }];
  const places = [], links = [], gaps = [], moments = [];
  let n = 1;
  for (let d = 0; d < 7; d++) {
    const day = nineOn(now, d), g = `d${d + 1}`;
    marks.push({ id: g, kind: 'group', name: dayName(day), fields: { of: 'joyce', ...made(now, n++) } });
    places.push(`^${g} in ^room`, `^${g} in ^room | rule: joyce | at: {x: ${d * 420}, y: 0}`);
    const things = [dayName(day), `Something to do on ${dayName(day).split(' ')[0]}`, notes[d]].filter(Boolean);
    things.forEach((text, i) => {
      const id = `${g}t${i + 1}`;
      marks.push({ id, kind: 'line', fields: made(now, n++), text });
      places.push(`^${id} in ^room`);
      links.push(`^${id} part of ^${g} | order: ${i}`);
      if (text.startsWith('Something')) {
        gaps.push(open(now, id, 'from world'));
        moments.push(`${iso(day)} due ^${id} | state: waiting | set: ${iso(now - START / 2)}`);
      }
    });
  }
  return traum({ marks, places, links, gaps, moments });
}

// The chooser's rows: what each template looks like, and where it runs out.
export const TEMPLATES = [
  { id: 'todo', name: 'To-do list', note: 'A plain list you tick, until one thing waits on another', make: todo },
  { id: 'essay', name: 'Essay or report', note: 'Headings with notes under them, each one not written yet', make: essay },
  { id: 'reading', name: 'Reading notes', note: 'One card per book or paper, each asking what it means for you', make: reading },
  { id: 'week', name: 'Weekly plan', note: 'Seven days with things under each; what is not done rolls on', make: week },
];

// The chooser opens by itself once, on a fresh start: never chosen or put away before, and nothing
// written yet (only Messy thoughts, and nothing in it).
export const fresh = ({ seen, rooms, inMessy }) => !seen && rooms <= 1 && inMessy === 0;
