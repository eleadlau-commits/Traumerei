// The Planar mode: a still fog of the picture's colours (F1–F6, base, engine/planar.js) and a latent
// network of lines tiling the frame (N1–N4, pattern, engine/network.js), which only the Pattern view
// draws. Its flashes (spontaneity) come next.

import { fog, fogRGB } from '../planar.js';
import { tiles, network, drawNetwork } from '../network.js';
import { FOG_KEYS, NETWORK_KEYS } from '../params.js';
import { describeFog, describeNetwork } from '../../report.js';

const LINE_WIDTH = 0.003; // the Pattern view's lines, in canvas units
const LINE_INK = [30, 30, 38];

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
  startView: 'base',
  views: [['base', 'Base'], ['pattern', 'Pattern']],
  folds: [['Base layer', ['Fog']], ['Pattern layer', ['Network']]],
  usesAnchor: false,
  liveKeys: [],
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
  // 'base': the fog. 'pattern': the fog with the latent network drawn over it.
  view(e, name, P) {
    const { W, H } = e.image;
    const fog = fogRGB(fogOf(e, P), W, H);
    const rgba = name === 'pattern' ? drawNetwork(networkOf(e, P), fog, W, H, LINE_WIDTH, LINE_INK) : fog;
    return { rgba, width: W, height: H };
  },
  report: (e, P) => ({ lines: [...describeFog(fogOf(e, P), P), describeNetwork(networkOf(e, P), P)] }),
};

export default planarMode;
