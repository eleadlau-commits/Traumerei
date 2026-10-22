# Renderer

Turns a picture into a faint monochrome, cuts it with a seeded opacity mask, prints it on a seeded
washi paper, and shows how each layer was made.

## What it adds

- The **Renderer** view (the app's only tab): choose an image with the **+** button (or the
  empty box), tap the picture to move the anchor, and switch between **Monochrome**, **Mask**,
  **Field** (the heightmap with the threshold line), **Base** (the base layer), **Pattern** (the
  paper alone) and **Washi** (the base printed on the paper).
- Sliders for every parameter, grouped as Monochrome, Patches, Edges, Fibres, Specks, Flakes, Grain
  and Composite, and **Back to defaults**.
- The seed (next to the title and under the picture) and the report from step M8: one block per
  attempt, with its streams, patches, threshold, components and whether each rule passed, and a line
  with the pattern's fibre, speck and flake counts once it has been made.

## How it's built

`engine/` is the rendering engine. It has no screen code and doesn't use Folio, so it can be
mounted by any page: `new Engine()`, then `load(rgba, W, H)`, `mask(P, anchor)`, `pattern(P)` and
`view(name, P, result)`.

| File | What's in it |
|---|---|
| `engine/index.js` | `Engine`: caches the monochrome, runs M1–M8 with re-rolls, makes each view's pixels |
| `engine/params.js` | Every parameter with its default and slider range |
| `engine/random.js` | cyrb53, mulberry32 streams, Box–Muller |
| `engine/colour.js` | sRGB ↔ linear, OKLab L, OKLCh → sRGB, the ink–paper lookup table |
| `engine/monochrome.js` | Steps 1–5 and the image seed |
| `engine/skeleton.js` | M1–M4: stick-breaking, the main centre, ellipses, secondaries |
| `engine/noise.js` | Seeded simplex noise and fBm |
| `engine/field.js` | M5–M7: the warped field, roughness, threshold |
| `engine/components.js` | M8: connected components and the two rules |
| `engine/pattern.js` | P1–P5: fibres, specks, flakes (the density D) and the relief grain (the shading S) |
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

Choices the pattern spec (P1–P6) left open:
- The defaults of λ, μ_w, μ_a, σ_a, ℓ_g, c, p and a_g were tuned against the reference paper after
  the spec's first guesses: fibres 150 per unit area, 0.0012 wide, darkness 0.35, darkness wander 0.4
  over 0.015; raggedness 0.3 with falloff 0.8; relief depth 0.022.
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
- The pattern is cached part by part (fibres, specks, flakes, grain), so a slider only remakes its own
  part. α and the base sliders only redo the composite.

## What it needs

- **Requires:** nothing
- **Uses if present:** nothing

## What it saves on this device

- `params`: every slider's value.
- `anchor`: `{ x, y }` as fractions of the width and height.
- `view`: the last view shown.

The picture itself isn't saved.

## How to check it works

1. Run `python build.py serve` and open http://localhost:8000.
2. Choose a picture, tap it, move some sliders, and switch views.
3. Run `python build.py test`.
