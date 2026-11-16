// Gaps's rules: plain functions of a gap row (the API's t.gaps.of) that don't need the screen, so
// tests can check them. A gap is what a mark was made to close: a direction (to world: check it,
// from world: do it, to maker: judge it) and a state (open or resolved); a mark whose parts carry
// gaps reads a derived one, with its progress.

export const DIRECTIONS = Object.freeze(['to world', 'from world', 'to maker']);
// Each direction as one word of what there is to do, and as a verb for the button that opens it.
export const WORDS = Object.freeze({ 'to world': 'to check', 'from world': 'to do', 'to maker': 'to judge' });
export const VERBS = Object.freeze({ 'to world': 'Check', 'from world': 'Do', 'to maker': 'Judge' });

// A day, in words, for a time (ms): "8 Nov" this year, "8 Nov 2025" another.
export function dayWords(ms, now = Date.now()) {
  const d = new Date(ms), n = new Date(now);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() === n.getFullYear() ? {} : { year: 'numeric' }) });
}

// The progress on a derived gap, in words: "3 of 12 parts open", "every part resolved".
export const progressLine = (p) => (!p || !p.of ? '' : p.open ? `${p.open} of ${p.of} part${p.of === 1 ? '' : 's'} open` : `every part resolved (${p.of})`);

// The line the Editor shows for a gap row, or '' for none.
export function stateLine(gap, now = Date.now()) {
  if (!gap) return '';
  if (gap.derived) return progressLine(gap);
  if (gap.state === 'open') return `Open, ${WORDS[gap.direction] || gap.direction}, since ${dayWords(gap.openedAt, now)}`;
  const by = gap.resolvedBy === 'judgement' ? 'by judgement' : 'by a link';
  return `Resolved ${dayWords(gap.resolvedAt ?? gap.openedAt, now)} ${by}`;
}

// What Ctrl+Alt+G does to a mark with this gap row: open one (none yet), resolve it (open), open
// it again (resolved), or nothing but say its progress (derived from its parts).
export function nextMove(gap) {
  if (!gap) return 'open';
  if (gap.derived) return 'parts';
  return gap.state === 'open' ? 'resolve' : 'reopen';
}

// The share of a derived gap resolved, 0 to 1.
export const share = (p) => (!p || !p.of ? 0 : p.resolved / p.of);
