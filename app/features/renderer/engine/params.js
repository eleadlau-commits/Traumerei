// Every parameter, with its default and the range its slider covers. Most are sliders; kind 'colour'
// is a colour picker ('#rrggbb') and kind 'choice' a row of buttons, one per option. A key may be
// listed in more than one group (the tint τ is in Colour and in Hue): they show the same value.
// Lengths and areas are in canvas units: the image's short side is 1.

import { DEFAULT_TINT } from './colour.js';

export const PARAMS = [
  { group: 'Monochrome', key: 'k', label: 'Contrast k', min: 0.5, max: 12, step: 0.1, value: 4 },
  { group: 'Monochrome', key: 'gamma', label: 'Gamma γ', min: 0.3, max: 3, step: 0.01, value: 1 },
  { group: 'Monochrome', key: 'dMin', label: 'Darkest d_min', min: 0, max: 1, step: 0.01, value: 0.65 },
  { group: 'Monochrome', key: 'dMax', label: 'Lightest d_max', min: 0, max: 1, step: 0.01, value: 0.97 },

  { group: 'Colour', key: 'tint', kind: 'colour', label: 'Tint τ', value: DEFAULT_TINT },
  { group: 'Colour', key: 'baseL', label: 'Brightness ΔL', min: -0.2, max: 0.2, step: 0.005, value: 0 },
  { group: 'Colour', key: 'baseW', label: 'Warmth Δw', min: -0.06, max: 0.06, step: 0.001, value: 0 },

  { group: 'Patches', key: 'kappa', label: 'Coverage κ', min: 0.02, max: 0.95, step: 0.01, value: 0.35 },
  { group: 'Patches', key: 'theta', label: 'Concentration θ', min: 0.1, max: 6, step: 0.05, value: 1.5 },
  { group: 'Patches', key: 'Amin', label: 'Smallest area A_min', min: 0.0005, max: 0.05, step: 0.0005, value: 0.005 },
  { group: 'Patches', key: 'sigma', label: 'Spread from anchor σ', min: 0, max: 0.5, step: 0.005, value: 0.08 },
  { group: 'Patches', key: 'epsilon', label: 'Chance to wander ε', min: 0, max: 1, step: 0.01, value: 0 },
  { group: 'Patches', key: 's', label: 'Elongation s', min: 0, max: 1.5, step: 0.01, value: 0.3 },

  { group: 'Edges', key: 'Awarp', label: 'Warp amount A_warp', min: 0, max: 0.3, step: 0.005, value: 0.06 },
  { group: 'Edges', key: 'lambdaWarp', label: 'Warp scale λ_warp', min: 0.02, max: 1, step: 0.01, value: 0.25 },
  { group: 'Edges', key: 'eta', label: 'Roughness η', min: 0, max: 1.5, step: 0.01, value: 0.35 },
  { group: 'Edges', key: 'H', label: 'Roughness memory H', min: 0, max: 1.5, step: 0.05, value: 0.6 },
  { group: 'Edges', key: 'octaves', label: 'Octaves', min: 1, max: 8, step: 1, value: 5 },
  { group: 'Edges', key: 'lambdaRough', label: 'Roughness scale λ_rough', min: 0.01, max: 0.5, step: 0.005, value: 0.12 },
  { group: 'Edges', key: 'delta', label: 'Edge softness δ', min: 0, max: 0.1, step: 0.001, value: 0.01 },
  { group: 'Edges', key: 'feather', label: 'Feather (blur of the mask)', min: 0, max: 0.15, step: 0.005, value: 0.03 },

  { group: 'Fibres', key: 'lambdaF', label: 'Fibre density λ', min: 0, max: 400, step: 1, value: 150 },
  { group: 'Fibres', key: 'muL', label: 'Median length μ_L', min: 0.005, max: 0.2, step: 0.001, value: 0.06 },
  { group: 'Fibres', key: 'sL', label: 'Length spread s_L', min: 0, max: 1.5, step: 0.01, value: 0.5 },
  { group: 'Fibres', key: 'lp', label: 'Persistence length ℓ_p', min: 0.005, max: 0.5, step: 0.001, value: 0.05 },
  { group: 'Fibres', key: 'muW', label: 'Median width μ_w', min: 0.0002, max: 0.005, step: 0.0001, value: 0.0009 },
  { group: 'Fibres', key: 'muB', label: 'Median blur μ_b', min: 0, max: 0.004, step: 0.0001, value: 0.0006 },
  { group: 'Fibres', key: 'muA', label: 'Median darkness μ_a', min: 0, max: 0.6, step: 0.01, value: 0.2 },
  { group: 'Fibres', key: 'sA', label: 'Darkness spread s_a', min: 0, max: 1.5, step: 0.01, value: 0.8 },
  { group: 'Fibres', key: 'sigmaW', label: 'Width wander σ_w', min: 0, max: 1, step: 0.01, value: 0.35 },
  { group: 'Fibres', key: 'sigmaB', label: 'Blur wander σ_b', min: 0, max: 1.5, step: 0.01, value: 0.6 },
  { group: 'Fibres', key: 'sigmaA', label: 'Darkness wander σ_a', min: 0, max: 1.5, step: 0.01, value: 0.25 },
  { group: 'Fibres', key: 'ellG', label: 'Wander scale ℓ_g', min: 0.002, max: 0.05, step: 0.001, value: 0.015 },

  { group: 'Web', key: 'lambdaWeb', label: 'Web density λ_web', min: 0, max: 6000, step: 50, value: 2500 },
  { group: 'Web', key: 'muLWeb', label: 'Web strand length μ_L,web', min: 0.005, max: 0.06, step: 0.001, value: 0.035 },
  { group: 'Web', key: 'muAWeb', label: 'Web darkness μ_a,web', min: 0, max: 0.2, step: 0.005, value: 0.18 },

  { group: 'Specks', key: 'lambdaS', label: 'Speck density λ_s', min: 0, max: 60, step: 1, value: 10 },
  { group: 'Specks', key: 'muLs', label: 'Speck length μ_L,s', min: 0.002, max: 0.04, step: 0.001, value: 0.01 },
  { group: 'Specks', key: 'muWs', label: 'Speck width μ_w,s', min: 0.0005, max: 0.008, step: 0.0001, value: 0.0025 },
  { group: 'Specks', key: 'muAs', label: 'Speck darkness μ_a,s', min: 0, max: 3, step: 0.05, value: 1.2 },

  { group: 'Flakes', key: 'lambdaK', label: 'Flake density λ_k', min: 0, max: 80, step: 1, value: 18 },
  { group: 'Flakes', key: 'muK', label: 'Median flake length μ_k', min: 0.004, max: 0.08, step: 0.001, value: 0.02 },
  { group: 'Flakes', key: 'sK', label: 'Flake length spread s_k', min: 0, max: 1.5, step: 0.01, value: 0.8 },
  { group: 'Flakes', key: 'cK', label: 'Raggedness c', min: 0, max: 0.4, step: 0.01, value: 0.2 },
  { group: 'Flakes', key: 'pK', label: 'Harmonic falloff p', min: 0.3, max: 2.5, step: 0.05, value: 1 },
  { group: 'Flakes', key: 'epsK', label: 'Edge softness ε_k', min: 0.01, max: 0.3, step: 0.01, value: 0.08 },
  { group: 'Flakes', key: 'kRim', label: 'Rim strength κ_rim', min: 0, max: 2, step: 0.05, value: 0.8 },
  { group: 'Flakes', key: 'sigmaV', label: 'Vein strength σ_v', min: 0, max: 1.5, step: 0.05, value: 0.5 },
  { group: 'Flakes', key: 'lambdaV', label: 'Vein scale λ_v', min: 0.001, max: 0.02, step: 0.0005, value: 0.004 },

  { group: 'Grain', key: 'lambdaG', label: 'Cell size λ_g', min: 0.002, max: 0.03, step: 0.0005, value: 0.008 },
  { group: 'Grain', key: 'omega', label: 'Crease width ω', min: 0.05, max: 1, step: 0.01, value: 0.3 },
  { group: 'Grain', key: 'Ag', label: 'Crumple amount A_g', min: 0, max: 0.02, step: 0.0005, value: 0.006 },
  { group: 'Grain', key: 'lambdaGw', label: 'Crumple scale λ_gw', min: 0.005, max: 0.1, step: 0.001, value: 0.02 },
  { group: 'Grain', key: 'etaG', label: 'Mottle η_g', min: 0, max: 1, step: 0.01, value: 0.15 },
  { group: 'Grain', key: 'lambdaN', label: 'Mottle scale λ_n', min: 0.01, max: 0.3, step: 0.005, value: 0.05 },
  { group: 'Grain', key: 'aG', label: 'Relief depth a_g', min: 0, max: 0.15, step: 0.005, value: 0.012 },
  { group: 'Grain', key: 'psi', label: 'Light direction ψ (°)', min: 0, max: 360, step: 1, value: 225 },
  { group: 'Grain', key: 'aCl', label: 'Cloudiness a_cl', min: 0, max: 0.15, step: 0.005, value: 0.05 },
  { group: 'Grain', key: 'lambdaCl', label: 'Cloud scale λ_cl', min: 0.05, max: 1, step: 0.01, value: 0.08 },

  { group: 'Composite', key: 'alpha', label: 'Pattern strength α', min: 0, max: 1, step: 0.01, value: 1 },
  { group: 'Composite', key: 'warmth', label: 'Inclusion warmth κ', min: 0, max: 1, step: 0.01, value: 1 },

  { group: 'Timing', key: 'mu', label: 'Background rate μ (per s)', min: 0, max: 3, step: 0.01, value: 0.3 },
  { group: 'Timing', key: 'nH', label: 'Branching ratio n', min: 0, max: 0.95, step: 0.01, value: 0.6 },
  { group: 'Timing', key: 'tauH', label: 'Memory τ_h (s)', min: 0.1, max: 10, step: 0.1, value: 1.2 },

  { group: 'Placement', key: 'sigmaC', label: 'Cluster spread σ_c', min: 0.002, max: 0.3, step: 0.001, value: 0.04 },
  { group: 'Placement', key: 'sigmaTheta', label: 'Heading spread σ_θ (°)', min: 0, max: 180, step: 1, value: 20 },
  { group: 'Placement', key: 'chi', label: 'Kinship χ', min: 0, max: 1, step: 0.01, value: 0.7 },

  { group: 'Marks', key: 'piDot', label: 'Dot share π_dot', min: 0, max: 1, step: 0.01, value: 0.5 },
  { group: 'Marks', key: 'piDash', label: 'Dash share π_dash', min: 0, max: 1, step: 0.01, value: 0.3 },
  { group: 'Marks', key: 'muR', label: 'Dot radius μ_r', min: 0.0005, max: 0.02, step: 0.0001, value: 0.004 },
  { group: 'Marks', key: 'muLen', label: 'Stroke length μ_ℓ', min: 0.005, max: 0.15, step: 0.001, value: 0.03 },
  { group: 'Marks', key: 'sLen', label: 'Length spread s_ℓ', min: 0, max: 1.5, step: 0.01, value: 0.4 },
  { group: 'Marks', key: 'muWm', label: 'Stroke width μ_w,m', min: 0.0003, max: 0.008, step: 0.0001, value: 0.002 },
  { group: 'Marks', key: 'sigmaH', label: 'Bend σ_h', min: 0, max: 0.6, step: 0.01, value: 0.2 },
  { group: 'Marks', key: 'muBm', label: 'Mark blur μ_b,m', min: 0, max: 0.004, step: 0.0001, value: 0.0004 },
  { group: 'Marks', key: 'muAm', label: 'Mark darkness μ_a,m', min: 0, max: 3, step: 0.05, value: 1.2 },
  { group: 'Marks', key: 'sAm', label: 'Darkness spread s_a,m', min: 0, max: 1.5, step: 0.01, value: 0.3 },

  { group: 'Life', key: 'Td', label: 'Draw-in time T_d (s)', min: 0.05, max: 3, step: 0.05, value: 0.6 },
  { group: 'Life', key: 'muT', label: 'Median hold μ_T (s)', min: 0.5, max: 60, step: 0.5, value: 5 },
  { group: 'Life', key: 'sT', label: 'Hold spread s_T', min: 0, max: 1.5, step: 0.01, value: 0.5 },
  { group: 'Life', key: 'tauF', label: 'Median fade time μ_f (s)', min: 0.2, max: 20, step: 0.1, value: 2.5 },
  { group: 'Life', key: 'sF', label: 'Fade spread s_f', min: 0, max: 1.5, step: 0.01, value: 0.6 },
  { group: 'Life', key: 'alphaS', label: 'Spontaneity strength α_s', min: 0, max: 2, step: 0.01, value: 1 },

  // The Plain theme (engine/plain.js)
  { group: 'Hue', key: 'tint', kind: 'colour', label: 'Tint τ, for a picture with no colour', aria: 'Tint τ for a picture with no colour', value: DEFAULT_TINT },
  { group: 'Hue', key: 'plainDL', label: 'Lightness shift ΔL', min: -0.4, max: 0.4, step: 0.01, value: 0 },
  { group: 'Hue', key: 'plainCS', label: 'Chroma × c', min: 0, max: 1.6, step: 0.01, value: 1 },

  { group: 'Flow', key: 'plainAlpha', label: 'Lightness lift α', min: 0, max: 0.4, step: 0.005, value: 0.07 },
  { group: 'Flow', key: 'plainBeta', label: 'Chroma fade β', min: 0, max: 1, step: 0.01, value: 0.3 },
  { group: 'Flow', key: 'lambdaPsi', label: 'Flow scale λ_ψ', min: 0.08, max: 2, step: 0.01, value: 1.1 },
  { group: 'Flow', key: 'flowD', label: 'Flow distance D', min: 0, max: 2, step: 0.01, value: 0.3 },
  { group: 'Flow', key: 'nu', label: 'Unsteadiness ν', min: 0, max: 2, step: 0.01, value: 0.3 },
  { group: 'Flow', key: 'eddy', label: 'Second eddy w', min: 0, max: 1, step: 0.01, value: 0 },

  { group: 'Dye', key: 'plainDye', kind: 'choice', label: 'Dye shape φ₀', aria: 'Dye shape', value: 'bands',
    options: [['bands', 'Bands'], ['combed', 'Combed'], ['drops', 'Drops']] },
  { group: 'Dye', key: 'lambdaB', label: 'Dye scale λ_b', min: 0.02, max: 2, step: 0.01, value: 0.9 },
  { group: 'Dye', key: 'dyeSoft', label: 'Dye softness', min: 0, max: 1, step: 0.01, value: 1 },
  { group: 'Dye', key: 'blurP', label: 'Blur σ', min: 0, max: 0.4, step: 0.005, value: 0.12 },

  { group: 'Glow', key: 'glowN', label: 'Lights N', min: 0, max: 9, step: 1, value: 3 },
  { group: 'Glow', key: 'glowR', label: 'Size r', min: 0.08, max: 1.2, step: 0.01, value: 0.6 },
  { group: 'Glow', key: 'glowA', label: 'Brightness a₀', min: 0, max: 0.8, step: 0.01, value: 0.16 },
  { group: 'Glow', key: 'glowSigma', label: 'Wander σ', min: 0, max: 0.4, step: 0.005, value: 0.04 },
  { group: 'Glow', key: 'glowTheta', label: 'Pull back θ', min: 0, max: 1, step: 0.01, value: 0.08 },
  { group: 'Glow', key: 'glowBeta', label: 'Breathing β', min: 0, max: 1, step: 0.01, value: 0.35 },
  { group: 'Glow', key: 'glowT', label: 'Breath period T (s)', min: 2, max: 40, step: 0.5, value: 18 },
  { group: 'Glow', key: 'glowDh', label: 'Hue offset Δh (°)', min: -90, max: 90, step: 1, value: 14 },
  { group: 'Glow', key: 'glowL', label: 'Glow lightness L_g', min: 0.5, max: 1, step: 0.01, value: 0.88 },

  // The Planar mode (engine/planar.js)
  { group: 'Fog', key: 'tint', kind: 'colour', label: 'Tint τ, for a picture with no colour', aria: 'Tint τ for a picture with no colour', value: DEFAULT_TINT },
  { group: 'Fog', key: 'fogSigma', label: 'Coarseness σ', min: 0.05, max: 0.6, step: 0.005, value: 0.25 },
  { group: 'Fog', key: 'fogA', label: 'Unevenness A', min: 0, max: 0.3, step: 0.005, value: 0.08 },
  { group: 'Fog', key: 'fogLo', label: 'Darkest L_lo', min: 0, max: 1, step: 0.01, value: 0.45 },
  { group: 'Fog', key: 'fogHi', label: 'Lightest L_hi', min: 0, max: 1, step: 0.01, value: 0.9 },
  { group: 'Fog', key: 'fogC', label: 'Colour strength c', min: 0, max: 1.5, step: 0.01, value: 0.6 },
  { group: 'Network', key: 'netRho', label: 'Grid density ρ (lines per unit)', min: 1, max: 16, step: 0.5, value: 6 },
  { group: 'Network', key: 'netMu', label: 'Merging μ', min: 0, max: 0.9, step: 0.01, value: 0.45 },

  { group: 'Flashes', key: 'flashMu', label: 'Background rate μ (per s)', min: 0, max: 2, step: 0.01, value: 0.2 },
  { group: 'Flashes', key: 'flashN', label: 'Branching ratio n', min: 0, max: 0.95, step: 0.01, value: 0.85 },
  { group: 'Flashes', key: 'flashPiG', label: 'Glint share π_g', min: 0, max: 1, step: 0.01, value: 0.5 },
  { group: 'Flashes', key: 'flashR', label: 'Black reach r', min: 0.005, max: 0.3, step: 0.005, value: 0.05 },
  { group: 'Flashes', key: 'flashFB', label: 'Black lasts F_b (s)', min: 0.1, max: 6, step: 0.1, value: 0.8 },
  { group: 'Flashes', key: 'glintL', label: 'Glint lightness L_g', min: 0.6, max: 1, step: 0.01, value: 0.97 },
];

const keysOf = (groups) => [...new Set(PARAMS.filter((p) => groups.includes(p.group)).map((p) => p.key))];

// The pattern's sliders (P1–P5), which change the paper but not the mask; α and κ only change the composite.
export const PATTERN_KEYS = keysOf(['Fibres', 'Web', 'Specks', 'Flakes', 'Grain']);

// The spontaneity's sliders (S1–S5), which change only the living layer.
export const SPONT_KEYS = keysOf(['Timing', 'Placement', 'Marks', 'Life']);

// The Plain theme's sliders: the field's (P1–P5, remade when they change) and all of them.
export const PLAIN_FIELD_KEYS = ['lambdaPsi', 'flowD', 'nu', 'eddy', 'lambdaB', 'dyeSoft', 'blurP', 'plainDye'];
export const PLAIN_KEYS = keysOf(['Hue', 'Flow', 'Dye', 'Glow']);

// The Planar mode's sliders, by stage.
export const FOG_KEYS = keysOf(['Fog']);
export const NETWORK_KEYS = keysOf(['Network']);
export const FLASH_KEYS = keysOf(['Flashes']);

// keysOf(groups) → the keys in those groups, each once.
export { keysOf };

export const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.key, p.value]));
