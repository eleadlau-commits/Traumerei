// Returns's rules: plain functions of a moment ahead (the API's t.moments.ahead / returns / next
// rows) that don't need the screen, so tests can check them. A mark comes back to its maker for
// one reason: due (to be done by a time), to revisit (at a time), or with a return, a note left
// for the next time it or its room is opened.

const DAY = 864e5;

// A day, in words, for a time (ms): "today", "tomorrow", "yesterday", "Mon 9 Nov" within a week,
// "9 Nov" this year, "9 Nov 2027" another.
export function dayWords(ms, now = Date.now()) {
  const start = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((start(ms) - start(now)) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  const d = new Date(ms);
  if (Math.abs(days) < 7) return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' }) });
}

// Why a row is here, in words: "Due yesterday", "Revisit, asked 3 Nov", "Left for this visit".
export function why(r, now = Date.now()) {
  if (!r) return '';
  if (r.kind === 'due') return `Due ${dayWords(r.at, now)}`;
  if (r.kind === 'revisit') return r.state === 'waiting' ? `Revisit ${dayWords(r.at, now)}` : `Revisit, asked ${dayWords(r.set, now)}`;
  return r.state === 'waiting' ? 'Waits for the next visit' : 'Left for this visit';
}

// The Editor's line for a mark's row, or '' for none.
export function stateLine(r, now = Date.now()) {
  if (!r) return '';
  if (r.state === 'waiting') return why(r, now);
  if (r.state === 'back') return `Back since ${dayWords(r.back, now)}: in Returns`;
  return `${r.state === 'met' ? 'Met' : 'Refused'} ${dayWords(r.answered, now)} (${why({ ...r, state: 'back' }, now).toLowerCase()})`;
}

// The times a quick button asks for: the morning (9:00) of tomorrow, or of the same day next week.
export function morning(now, days) { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return d.getTime(); }
export const LATER = Object.freeze([
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
]);

// A date field's value ("2026-11-12") as the morning of that day, or null.
export function fromField(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3], 9, 0, 0, 0).getTime();
  return Number.isFinite(t) ? t : null;
}

// A mark's words cut to a line for the tray.
export const firstLine = (text, most = 80) => { const s = String(text || '').split('\n').find((l) => l.trim())?.trim() || 'Untitled'; return s.length > most ? `${s.slice(0, most - 1)}…` : s; };

// The tray's name on the dock's strip: "Returns · 2", or "Returns".
export const label = (n) => (n ? `Returns · ${n}` : 'Returns');
