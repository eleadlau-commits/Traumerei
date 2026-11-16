// The spiral: the i-th thought on a loose Archimedean spiral outwards. A part of the rule kit
// (the plugin API's parts.layout): Pessoa lays a room out on it, Proust a new cluster.

import { hash } from './model.js';

// The i-th thought (in time order) sits on an Archimedean spiral r = bθ, spaced evenly along its
// length, nudged a little by its id so it doesn't look ruled.
export const SPIRAL = { step: 230, gap: 190 }; // px between neighbours along the spiral; between turns
export function spiralPoint(i, id = '') {
  const b = SPIRAL.gap / (2 * Math.PI);
  const theta = Math.sqrt((2 * SPIRAL.step * (i + 0.6)) / b);
  const r = b * theta;
  const h = hash(id);
  const jx = ((h & 0xff) / 255 - 0.5) * 36;
  const jy = (((h >> 8) & 0xff) / 255 - 0.5) * 28;
  return { x: r * Math.cos(theta) + jx, y: r * Math.sin(theta) + jy };
}
