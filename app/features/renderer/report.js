// The M8 report as plain lines of text, one block per attempt, the pattern's line and the living one.
// No screen code, so it's testable.

import { expected } from './engine/spontaneity.js';
import { counts } from './engine/network.js';

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

// The pattern's line: what Engine.pattern() returned → one sentence.
// The Living view's line: what the Hawkes process gives on average.
export function describeLiving(P) {
  const { rate, visible, cluster } = expected(P);
  return `Spontaneity: about ${rate.toFixed(2)} marks a second (μ / (1 − n)), in clusters of ` +
    `${cluster.toFixed(1)} on average (1 / (1 − n)), so about ${visible.toFixed(1)} on the page at once ` +
    '(rate × mean life). Streams :spont:time :spont:place :spont:marks.';
}

export function describePattern({ counts, ms }) {
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  return `Pattern: ${n(counts.fibres, 'fibre', 'fibres')}, ${n(counts.web, 'web strand', 'web strands')}, ` +
    `${n(counts.specks, 'speck', 'specks')} and ${n(counts.flakes, 'flake', 'flakes')} ` +
    '(streams :pattern:fibres :pattern:web :pattern:specks :pattern:flakes :pattern:grain :pattern:cloud), ' +
    `made in ${Math.round(ms)} ms.`;
}

// The Plain theme's report: the hue it found (B), the field (P) and the lights (G), as lines of text.
// hue: Engine.hue(), base: Engine.plainBase(), field: Engine.plainField(), P: the sliders.
export function describePlain(hue, base, field, P) {
  const lines = [];
  lines.push(hue.grey
    ? `The picture has almost no colour, so the base takes the tint τ: hue ${hue.h.toFixed(0)}°.`
    : `Dominant hue ${hue.h.toFixed(1)}° (peak bin ${hue.peak * 5}–${hue.peak * 5 + 5}°), L ${f3(hue.L)}, C ${f3(hue.C)}.`);
  lines.push(`Base b = OKLCh(${f3(base.L)}, ${f3(base.C)}, ${base.h.toFixed(1)}°).`);
  lines.push(`Field ${field.pw} × ${field.ph} cells, ${P.plainDye} dye, made in ${Math.round(field.ms)} ms.`);
  lines.push(`${P.glowN} light${P.glowN === 1 ? '' : 's'}, size ${P.glowR}, brightness ${P.glowA}.`);
  return lines;
}

// The Planar fog's report: its palette (F2), its grids and how long it took.
export function describeFog(fog, P) {
  const lines = [];
  if (fog.grey) lines.push('The picture has almost no colour, so the fog takes the tint τ\'s hue.');
  lines.push(`Palette (stream :planar:palette): ${fog.palette.map((p) => `OKLab(${p.lab.map((v) => v.toFixed(2)).join(', ')}) ${Math.round(100 * p.share)}%`).join(', ')}.`);
  lines.push(`Sampled on ${fog.sw} × ${fog.sh} cells, fog on ${fog.fw} × ${fog.fh}, coarseness σ ${P.fogSigma}, ` +
    `unevenness A ${P.fogA} (stream :planar:fog), made in ${Math.round(fog.ms)} ms.`);
  return lines;
}

// The Planar network's report: its counts (N1–N4).
export function describeNetwork(net, P) {
  const c = counts(net);
  return `Network (streams :planar:net:grid :planar:net:merge): ${c.rectangles} rectangles, ` +
    `${c.tees + c.crosses} junctions (${c.tees} T, ${c.crosses} crosses), ${c.frame} ends on the frame, ` +
    `${c.segments} segments on ${c.lines} straight lines, total length ${c.length.toFixed(2)}, ` +
    `grid density ρ ${P.netRho}, merging μ ${P.netMu}, made in ${Math.round(net.ms)} ms.`;
}
