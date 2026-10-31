// The modes, in the order Settings → Theme lists them. Each is a plain description with no screen code:
//
//   {
//     id, label,
//     viewKey,        // the saved key for its current view ('view' for Washi, 'plainView' for Plain)
//     startView,      // the view shown before one is chosen
//     views,          // [[id, label]] for its View tabs
//     folds,          // [[layer title, [slider groups]]] for Advanced
//     usesAnchor,     // whether the anchor row shows and tapping the picture moves it
//     liveKeys,       // sliders that only change the animation, not the still picture
//     stages: { name: { keys, make(e, P, input) } },
//                     // cached by the engine (e.stage) while its keys' values and input stay the same
//     view(e, name, P, ctx)          → { rgba, width, height, contour? }   (ctx = { anchor })
//     living(e, P, picture, ctx)     → an animation, a pure function of time t:
//         { kind: 'pixels', rgba, frame(t) → [[x, y, w, h]] }   patches of rgba to copy to the picture
//         { kind: 'layer', blend, scale, fill, at(t) → shapes } shapes in canvas units, drawn on their own
//                                                                canvas at `scale` of the screen
//     report(e, P, name, ctx)        → { summary?, attempts?, lines }
//   }

import washi from './washi.js';
import plain from './plain.js';
import planar from './planar.js';

export const MODES = [washi, plain, planar];
export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];
