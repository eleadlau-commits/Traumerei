# Renderer

Turns a picture into a faint monochrome, cuts it with a seeded opacity mask, prints it on a seeded
washi paper, lets seeded ink marks come and go over it, and shows how each layer was made.

## What it adds

- The **Renderer** view (the app's only tab): just the picture, filling the screen edge to edge
  (cropped to fit, like a cover photo), shown as **Washi** at first. It starts as a plain white
  image the shape of the screen (1600 px on its long side). Everything else is in **Settings → Advanced**, folded into groups:
  - **Picture**: choose an image, or go back to white; the seed.
  - **View**: switch between **Monochrome**, **Mask**,
    **Field** (the heightmap with the threshold line), **Base** (the base layer), **Pattern**
    (the paper alone), **Washi** (the base printed on the paper) and **Living** (Washi with the
    spontaneity layer: dots, dashes and marks drawn in, held and faded, animated), and show the
    anchor (then tap the picture to move it).
  - **Base layer** (Monochrome, Colour, Patches, Edges), **Pattern layer** (Fibres, Web, Specks, Flakes,
    Grain, Composite) and **Spontaneity layer** (Timing, Placement, Marks, Life): the sliders.
  - **Report**, then **Back to defaults**.
- The seed (under Picture) and the report from step M8: one block per
  attempt, with its streams, patches, threshold, components and whether each rule passed, and a line
  with the pattern's fibre, web, speck and flake counts once it has been made.

## How it's built

`engine/` is the rendering engine. It has no screen code and doesn't use Folio, so it can be
mounted by any page: `new Engine()`, then `load(rgba, W, H)`, `mask(P, anchor)`, `pattern(P)` and
`view(name, P, result)`.

| File | What's in it |
|---|---|
| `engine/index.js` | `Engine`: caches the monochrome, runs M1–M8 with re-rolls, makes each view's pixels |
| `engine/params.js` | Every parameter with its default and slider range |
| `engine/random.js` | cyrb53, mulberry32 streams, Box–Muller |
| `engine/colour.js` | sRGB ↔ linear, OKLab L, OKLCh → sRGB, the ink–paper lookup table, the tan, absorbers |
| `engine/monochrome.js` | Steps 1–5 and the image seed |
| `engine/skeleton.js` | M1–M4: stick-breaking, the main centre, ellipses, secondaries |
| `engine/noise.js` | Seeded simplex noise and fBm |
| `engine/field.js` | M5–M7: the warped field, roughness, threshold |
| `engine/components.js` | M8: connected components and the two rules |
| `engine/pattern.js` | P1–P5: fibres, web and flakes (the warm density D_w), specks (D_k), cloudiness C and the relief grain (the shading S) |
| `engine/spontaneity.js` | S1–S5: the Hawkes timing, placement, the three kinds of mark, their life, and `Living`, which redraws only where marks are |
| `engine/render.js` | Upscaling the mask, the views, the P6 composite, the contour |
| `Renderer.js`, `controls.js`, `report.js` | The page, the sliders, the report text |

Choices the spec left open:
- Pictures larger than 2048 px on their long side are scaled down to that first; the seed is
  taken from that copy.
- The 32×32 thumbnail is an area average, greyscale by Rec. 709 luma of the sRGB values; each
  cell becomes one hex digit, and the 1024 digits are hashed.
- Each stream is mulberry32 seeded with `cyrb53(seed + name)`. Each Box–Muller draw uses two
  uniforms. Draw order: the M1 pieces, the ε draw, the main centre, every ellipse, then the
  secondaries.
- Areas and lengths are in canvas units (short side = 1). The first stick-breaking piece is
  always kept, so there's always a main patch.
- The warp uses two simplex noises from the `:warp` stream; fBm uses one from `:noise`, with
  lacunarity 2, normalised by the sum of its gains, and is evaluated at the unwarped point.
- The field is computed on about 320 cells on the short side, sampled bilinearly up to full
  size, and the smoothstep is applied at full size, so edges stay smooth.
- M8 uses 8-connected components of `F' ≥ T`. The anchor rule is skipped when the main centre
  was placed uniformly (the ε case). When no attempt passes, the one with the lowest penalty
  (how far over each rule it went) is shown.
- **Feather** (added after the spec, default 0.03): a Gaussian blur of the mask with that standard
  deviation in canvas units, applied on the field grid after the smoothstep and then sampled up.
  0 gives the spec's crisp edge. It doesn't change M8, which uses the unblurred threshold.
- Mixes happen in OKLab: the mask view is `mix(paper, ink, mask)` and the base is
  `mix(paper, monochrome, mask)`.
- **Brightness ΔL and warmth Δw** (Colour, added after the spec, both 0 by default): the monochrome
  is moved by Δ = (ΔL, Δw cos 75°, Δw sin 75°) in OKLab before the mask mixes it over paper, so the
  base is `mix(paper, monochrome + Δ, mask)` = the plain base + mask · Δ. 75° is the tan's hue:
  Δw > 0 is warmer, Δw < 0 cooler. Bare paper (mask 0) doesn't change. It shows in the Monochrome,
  Base, Washi and Living views, not in Mask or Field. At 0 the old lookup path is used, so the
  picture is exactly as before.

Choices the pattern spec (P1–P6) left open:
- The defaults were tuned against the reference paper, so they differ from the spec's first guesses.
- **Revision after the first look** (E's reference paper vs the first render):
  - Fibres and flakes are tinted. Each inclusion is an absorber: per channel in linear light,
    a_c = −ln(colour_c / paper_c), scaled so its luminance-weighted sum is 1. Fibres, the web and
    flakes absorb toward the tan OKLCh(0.80, 0.05, 75°); specks absorb toward the ink. **Inclusion
    warmth κ** mixes the warm absorber back toward the ink's, so κ = 0 is the first version's grey.
  - The composite is now out_c = ramp_c(t) · exp(−α(D_w a_w,c + D_k a_k,c + C)) · (1 + αS), per
    channel in linear light, with ramp the ink–paper line in linear RGB. Relief highlights are just
    > 1 multipliers, so the extended lookup past paper is gone.
  - A fine **web** of faint strands (stream `:pattern:web`): the fibre machinery with
    ℓ_p = 0.06, μ_w = 0.0006, μ_b = 0.0004, s_L = 0.5 and s_a = 0.5 fixed.
  - **Cloudiness** C = a_cl · fBm(x / λ_cl), 4 octaves, H = 0.5 (stream `:pattern:cloud`), signed.
  - Fibre darkness spread s_a is a slider (default 0.8: mostly faint, a few dark). Flake length
    spread s_k is a slider (default 0.8), and the aspect is U(0.1, 0.6), so long strips appear.
- Each part's stream starts with what its noise needs (a 255-number simplex permutation, and for the
  grain the warp offsets and the mottle's permutation), then the draws in the spec's order. The
  grain's jitters come last, row by row, for the λ_g grid and then the λ_g / 2 grid.
- Poisson counts with a mean over 30 use a rounded Gaussian; smaller ones use Knuth's method.
- The 1D noises along a stroke are the simplex noise at (s / ℓ_g, o), divided by 0.47, its measured
  standard deviation along a line. Specks use a length spread of 0.4.
- Each stroke is a polyline; each pixel within reach takes w, b′ and a from its nearest point on it, so
  a stroke never doubles up at its own joints. Strokes still add up where they cross.
- Worley's F₁ and F₂ look at the 3 × 3 cells around the point. ∇h uses central differences, one-sided at
  the edges.
- The vein noise is n(x / λ_v + o, y / λ_v).
- The pattern is cached part by part (fibres, web, specks, flakes, grain, cloud), so a slider only
  remakes its own part. α, κ and the base sliders only redo the composite.

## What it needs

- **Requires:** nothing
- **Uses if present:** nothing

## What it saves on this device

- `params`: every slider's value.
- `anchor`: `{ x, y }` as fractions of the width and height.
- `view`: the last view shown.
- `marks`: whether the anchor is shown on the picture.

The picture itself isn't saved.

## How to check it works

1. Run `python build.py serve` and open http://localhost:8000.
2. Open Settings from the menu. Under Advanced, choose a picture, show the anchor and tap the
   picture, move some sliders, and switch views.
3. Run `python build.py test`.

The spontaneity layer (S1–S5), the living one:
- **S1 timing.** A Hawkes process with an exponential kernel,
  λ(t) = μ + Σ_{tᵢ < t} (n / τ_h) e^(−(t − tᵢ)/τ_h), simulated exactly by Ogata's thinning
  (stream `:spont:time`). n is the branching ratio: each mark has on average n offspring, so
  clusters hold 1 / (1 − n) marks and the mean rate is μ / (1 − n). n = 0 is a Poisson process.
  A candidate time that is drawn but not yet reached is kept, so the marks at time t don't depend
  on how the frames fell.
- **S2 placement** (stream `:spont:place`). Each event is a background mark with probability
  μ / λ(t), or else the offspring of an earlier mark j with probability ∝ (n / τ_h) e^(−(t − t_j)/τ_h).
  A background mark lands uniformly on the canvas: the layer is independent of the anchor and the
  mask, so moving the anchor never moves a mark.
  An offspring lands at x_parent + σ_c ξ (reflected into the canvas), heading θ_parent + σ_θ ξ,
  and keeps its parent's kind with probability χ.
- **S3 marks** (stream `:spont:marks`). Kinds in shares π_dot, π_dash and the rest marks.
  A dot is a soft ellipse of radius r ~ LogNormal(μ_r, 0.4), aspect q ~ U(0.6, 1). A dash is a
  straight stroke of length ℓ ~ LogNormal(μ_ℓ, s_ℓ); a mark is the same stroke bent into a
  quadratic Bézier, bend h ~ N(0, σ_h²) of its length. Strokes have width w ~ LogNormal(μ_w,m, 0.3),
  blur b ~ LogNormal(μ_b,m, 0.5) and the fibres' lopsided taper with α, β ~ U(0.15, 0.6), and the
  fibres' erf cross-section. Darkness a ~ LogNormal(μ_a,m, s_a,m).
- **S4 life.** Drawn in over T_d with g = smoothstep(0, T_d, s): a stroke is shown up to u = g of its
  length, like a pen; a dot's radius is r√g, so the drop's area grows evenly. Held for
  T ~ LogNormal(μ_T, s_T), then o = e^(−(s − T_d − T)/τ_f), retired after 5 τ_f. Each mark has its
  own fade time τ_f ~ LogNormal(μ_f, s_f), so some vanish quickly and some linger.
  About rate × (T_d + μ_T e^(s_T²/2) + μ_f e^(s_f²/2)) marks are on the page at once.
- **S5 composite.** Per channel in linear light over the Washi pixels,
  out_c = in_c · exp(−α_s D a_ink,c), with D the summed marks' density and a_ink the ink absorber.
  Only the boxes of marks shown last frame or this frame are recomputed and redrawn.
- The clock runs only while Living is showing, and a frame advances it by at most 0.1 s, so it
  pauses while the page is hidden. Moving a slider replays the process from 0 to the same moment.
