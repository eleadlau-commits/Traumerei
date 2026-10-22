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
];

export const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.key, p.value]));
