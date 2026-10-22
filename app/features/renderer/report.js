// The M8 report as plain lines of text, one block per attempt. No screen code, so it's testable.

const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '—');

// result: what Engine.mask() returned. → { summary, attempts: [{ title, kept, lines: [...] }] }
export function describe(result) {
  const { attempts, best } = result;
  const passed = best.verdict.pass;
  const summary = passed
    ? `Attempt ${best.n} passed both rules${best.n ? ` after ${best.n} re-roll${best.n > 1 ? 's' : ''}` : ''}.`
    : `No attempt passed both rules in ${attempts.length} tries, so the closest one (attempt ${best.n}) is shown.`;
  return { summary, attempts: attempts.map((a) => block(a, a === best)) };
}

function block(a, kept) {
  const tag = a.n ? `:${a.n}` : '';
  const v = a.verdict;
  const near = v.near.skipped
    ? 'Near the anchor: skipped, the main patch wandered (ε).'
    : `Near the anchor: ${f3(v.near.distance)} from it, limit ${f3(v.near.limit)} ${v.near.pass ? '✓' : '✗'}`;
  const sizes = v.pairs.length
    ? `Different sizes: ✗ ${v.pairs.map((p) => `#${p.i + 1}/#${p.j + 1} ratio ${p.ratio.toFixed(2)}`).join(', ')}`
    : 'Different sizes: every pair below 0.85 ✓';
  return {
    title: `Attempt ${a.n} · streams :skeleton${tag} :warp${tag} :noise${tag}`,
    kept,
    pass: v.pass,
    lines: [
      `${a.pieces} piece${a.pieces === 1 ? '' : 's'} from stick-breaking, ${a.patches.length} placed, ${a.dropped} dropped.`,
      `Main patch r = ${f3(a.patches[0].r)}, centre (${f3(a.main.x)}, ${f3(a.main.y)}) by ${a.main.how}.`,
      `Threshold T = ${f3(a.T)}.`,
      a.comps.length
        ? `${a.comps.length} component${a.comps.length === 1 ? '' : 's'}: ${a.comps.map((c, i) => `#${i + 1} area ${f3(c.area)}`).join(', ')}.`
        : 'No components above A_min.',
      near,
      sizes,
    ],
  };
}
