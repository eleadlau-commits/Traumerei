// The Planar mode: a still fog of the picture's colours (F1–F6, base, engine/planar.js) and a latent
// network of lines tiling the frame (N1–N4, pattern, engine/network.js), which only the Pattern view
// draws, and flashes along that network (E1–E5, spontaneity, engine/flashes.js): glints of light and
// spreading black lines, which the Living view plays over the fog.

import { fog, fogRGB } from '../planar.js';
import { tiles, network, drawNetwork } from '../network.js';
import { Flashes } from '../flashes.js';
import { LINEAR_BYTE, linearToOklab, oklabToOklch, delinearise } from '../colour.js';
import { lchToLinear } from '../plain.js';
import { FOG_KEYS, NETWORK_KEYS, FLASH_KEYS } from '../params.js';
import { describeFog, describeNetwork, describeFlashes } from '../../report.js';

const LINE_WIDTH = 0.003; // the Pattern view's lines, in canvas units
const LINE_INK = [30, 30, 38];
const FLASH_WIDTH = 0.003; // the flashes' lines, in canvas units
const BLACK = [16, 16, 20];

// A glint's colour: the fog under (x, y) at lightness L_g, with half its chroma.
function glintColour(fog, X, Y, x, y, L) {
  const i = Math.min(fog.fw - 1, Math.max(0, Math.floor((x / X) * fog.fw)));
  const j = Math.min(fog.fh - 1, Math.max(0, Math.floor((y / Y) * fog.fh)));
  const q = 3 * (j * fog.fw + i);
  const lin = [0, 1, 2].map((c) => LINEAR_BYTE[Math.max(0, Math.min(255, Math.round(fog.rgb[q + c])))]);
  const [, C, h] = oklabToOklch(linearToOklab(lin));
  return lchToLinear(L, C / 2, h).map((v) => Math.round(255 * delinearise(v)));
}

// F1–F6 on its grid, cached while the fog's sliders (and the tint) stay the same.
export function fogOf(e, P) {
  return e.stage(planarMode, 'fog', P);
}

// N1–N4, cached while the network's sliders stay the same.
export function networkOf(e, P) {
  return e.stage(planarMode, 'network', P);
}

const planarMode = {
  id: 'planar',
  label: 'Planar',
  viewKey: 'planarView',
  startView: 'living',
  views: [['base', 'Base'], ['pattern', 'Pattern'], ['planar', 'Planar'], ['living', 'Living']],
  folds: [['Base layer', ['Fog']], ['Pattern layer', ['Network']], ['Spontaneity layer', ['Flashes']]],
  usesAnchor: false,
  // The flashes' sliders only change the animation, not the still picture.
  liveKeys: FLASH_KEYS,
  stages: {
    fog: {
      keys: FOG_KEYS,
      make(e, P) {
        const { W, H } = e.image;
        const t0 = performance.now();
        const f = fog(e.rgba, W, H, e.image.seed, P);
        return { ...f, ms: performance.now() - t0 };
      },
    },
    network: {
      keys: NETWORK_KEYS,
      make(e, P) {
        const { seed, X, Y } = e.image;
        const t0 = performance.now();
        const net = network(tiles(seed, X, Y, P), X, Y);
        return { ...net, ms: performance.now() - t0 };
      },
    },
  },
  // 'base', 'planar' and 'living': the fog (the network is latent). 'pattern': the fog with the
  // network drawn over it. 'living' then plays the flashes over it.
  view(e, name, P) {
    const { W, H } = e.image;
    const fog = fogRGB(fogOf(e, P), W, H);
    const rgba = name === 'pattern' ? drawNetwork(networkOf(e, P), fog, W, H, LINE_WIDTH, LINE_INK) : fog;
    return { rgba, width: W, height: H };
  },
  // E1–E5 as a 'layer' animation: crisp lines at the screen's resolution, on a clear canvas.
  living(e, P) {
    const { seed, X, Y } = e.image;
    const fog = fogOf(e, P);
    const flashes = new Flashes(seed, networkOf(e, P), P);
    return {
      kind: 'layer', blend: 'normal', scale: 1, fill: null,
      at: (t) => flashes.pieces(t).map((p) => ({
        type: 'line', ...p, w: FLASH_WIDTH, halo: p.kind === 'glint',
        colour: p.kind === 'glint' ? glintColour(fog, X, Y, (p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, P.glintL) : BLACK,
      })),
    };
  },
  report: (e, P, name) => ({ lines: [...describeFog(fogOf(e, P), P), describeNetwork(networkOf(e, P), P),
    ...(name === 'living' ? [describeFlashes(P)] : [])] }),
};

export default planarMode;
