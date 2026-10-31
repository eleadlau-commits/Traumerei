// The Planar mode: a still fog of the picture's colours (F1–F6, base). The latent network (pattern)
// and its flashes (spontaneity) come next. The maths is in engine/planar.js.

import { fog, fogRGB } from '../planar.js';
import { FOG_KEYS } from '../params.js';
import { describeFog } from '../../report.js';

// F1–F6 on its grid, cached while the fog's sliders (and the tint) stay the same.
export function fogOf(e, P) {
  return e.stage(planarMode, 'fog', P);
}

const planarMode = {
  id: 'planar',
  label: 'Planar',
  viewKey: 'planarView',
  startView: 'base',
  views: [['base', 'Base']],
  folds: [['Base layer', ['Fog']]],
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
  },
  view(e, name, P) {
    const { W, H } = e.image;
    return { rgba: fogRGB(fogOf(e, P), W, H), width: W, height: H };
  },
  report: (e, P) => ({ lines: describeFog(fogOf(e, P), P) }),
};

export default planarMode;
