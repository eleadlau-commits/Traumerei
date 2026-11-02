// Where your attention has been: a room's light on the rooms page follows how much you have
// been in it lately (going in, and writing there), fading with time. Pure maths, no screen
// (tested in tests/attention.test.js).
//
// Saved data: 'attention' → { [roomId]: [times you went in, ms] }, the latest MOST kept.

export const FADE = 2 * 24 * 3600e3; // a visit's light halves over about a day and a half
export const MOST = 40;
export const WRITE = 0.5;             // a thought written counts for half a visit

// Notes that you went into a room, now. Returns the log (changed in place).
export function visit(log, roomId, now = Date.now()) {
  const times = (log[roomId] ||= []);
  if (now - (times[times.length - 1] ?? -Infinity) < 60e3) return log; // the same visit
  times.push(now);
  if (times.length > MOST) times.splice(0, times.length - MOST);
  return log;
}

// How lit a room is, 0 (dark) to 1 (fully lit): visits and thoughts written, each fading with
// time, gathered and eased so a few recent visits light it well and many cannot overflow.
export function light(log, roomId, written = [], now = Date.now()) {
  let score = 0;
  for (const t of log?.[roomId] || []) score += Math.exp(-(now - t) / FADE);
  for (const t of written) score += WRITE * Math.exp(-(now - t) / FADE);
  return 1 - Math.exp(-score / 2.5);
}

// The log, checked: unknown shapes become empty.
export function loadLog(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const [id, times] of Object.entries(saved)) {
    if (Array.isArray(times)) out[id] = times.filter(Number.isFinite).slice(-MOST);
  }
  return out;
}
