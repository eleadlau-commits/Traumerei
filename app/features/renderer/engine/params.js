// Every parameter, with its default and the range its slider covers.
// Lengths and areas are in canvas units: the image's short side is 1.

export const PARAMS = [
  { group: 'Monochrome', key: 'k', label: 'Contrast k', min: 0.5, max: 12, step: 0.1, value: 4 },
  { group: 'Monochrome', key: 'gamma', label: 'Gamma γ', min: 0.3, max: 3, step: 0.01, value: 1 },
  { group: 'Monochrome', key: 'dMin', label: 'Darkest d_min', min: 0, max: 1, step: 0.01, value: 0.65 },
  { group: 'Monochrome', key: 'dMax', label: 'Lightest d_max', min: 0, max: 1, step: 0.01, value: 0.97 },

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
  { group: 'Life', key: 'tauF', label: 'Fade time τ_f (s)', min: 0.2, max: 20, step: 0.1, value: 2.5 },
  { group: 'Life', key: 'alphaS', label: 'Spontaneity strength α_s', min: 0, max: 2, step: 0.01, value: 1 },
];

// The pattern's sliders (P1–P5), which change the paper but not the mask; α and κ only change the composite.
const PATTERN_GROUPS = ['Fibres', 'Web', 'Specks', 'Flakes', 'Grain'];
export const PATTERN_KEYS = PARAMS.filter((p) => PATTERN_GROUPS.includes(p.group)).map((p) => p.key);

// The spontaneity's sliders (S1–S5), which change only the living layer.
const SPONT_GROUPS = ['Timing', 'Placement', 'Marks', 'Life'];
export const SPONT_KEYS = PARAMS.filter((p) => SPONT_GROUPS.includes(p.group)).map((p) => p.key);

export const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.key, p.value]));
