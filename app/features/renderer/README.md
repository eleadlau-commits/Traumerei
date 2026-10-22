# Renderer

Turns a picture into a faint monochrome, cuts it with a seeded opacity mask, and shows how the
mask was made.

## What it adds

- The **Renderer** view (the app's only tab): choose an image with the **+** button (or the
  empty box), tap the picture to move the anchor, and switch between **Monochrome**, **Mask**,
  **Field** (the heightmap with the threshold line) and **Base** (the final picture).
- Sliders for every parameter, grouped as Monochrome, Patches and Edges, and **Back to defaults**.
- The seed (next to the title and under the picture) and the report from step M8: one block per
  attempt, with its streams, patches, threshold, components and whether each rule passed.

## How it's built

`engine/` is the rendering engine. It has no screen code and doesn't use Folio, so it can be
mounted by any page: `new Engine()`, then `load(rgba, W, H)`, `mask(P, anchor)` and
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
| `engine/render.js` | Upscaling the mask, the views, the contour |
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
- Mixes happen in OKLab: the mask view is `mix(paper, ink, mask)` and the base is
  `mix(paper, monochrome, mask)`.

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
