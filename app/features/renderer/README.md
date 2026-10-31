# Renderer

Turns a picture into a faint monochrome, cuts it with a seeded opacity mask, prints it on a seeded
washi paper, lets seeded ink marks come and go over it, and shows how each layer was made.

## What it adds

- The **Renderer** view (the app's only tab): just the picture, filling the screen edge to edge
  (cropped to fit, like a cover photo), shown as **Washi** at first. It starts as a plain white
  image the shape of the screen. Everything else is in **Settings → Advanced**, folded into groups:
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

## The Plain theme

**Settings → Theme** switches between **Washi** (everything above) and **Plain**, which is saved. Plain
turns the picture into one flat colour from its dominant hue, lifts its lightness with a heavily
blurred fluid field, and lets a few soft lights drift over it. The picture itself never shows.
In Plain, Advanced shows Plain's own views (**Base**, **Pattern**, **Plain**, **Living**) and sliders
(**Hue**, **Flow**, **Dye**, **Glow**); the anchor and the mask aren't used, so M1–M8 only run when
Washi is shown. The maths is in `engine/plain.js`:

- **B (base):** the picture sampled to 256 px, each pixel to OKLCh; pixels with C ≥ 0.02 add their
  chroma to a 72-bin hue histogram, smoothed with a von Mises kernel (κ = 20). The hue is the
  chroma-weighted circular mean within 15° of the peak, and L, C are the medians there. An almost grey
  picture (mean C < 0.012, or under 2% of pixels with a hue) takes the tint τ instead, so plain white
  shows the beige.
- **P (pattern):** a curl velocity u = ∇⊥ψ from 3D simplex noise (time is the third axis), the dye φ₀
  (bands, combed or drops) traced back along it for a distance D in 36 RK2 steps, then a Gaussian
  blur (three box passes). It's made on a grid of 160 cells on the short side and filled in bilinearly.
- **Composite:** L = L_b + α η φ, C = C_b (1 − β φ), same hue, with η = min(1, (1 − L_b)/0.35) so a
  pale base isn't washed out; 8-bit output dithered by ±½.
- **G (glow):** N Gaussian lights on Ornstein–Uhlenbeck paths (fixed 1/30 s steps from the stream
  `:plain:glow`, so the same moment always looks the same), breathing on slow sines, in the colour
  OKLCh(L_g, min(0.14, 1.4 C_b + 0.03), h_b + Δh). They're drawn on a canvas a quarter of the screen's
  size and screen-blended over the picture by the browser.

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
| `engine/noise.js` | Seeded simplex noise (2D, and 3D for the Plain flow) and fBm |
| `engine/field.js` | M5–M7: the warped field, roughness, threshold |
| `engine/components.js` | M8: connected components and the two rules |
| `engine/pattern.js` | P1–P5: fibres, web and flakes (the warm density D_w), specks (D_k), cloudiness C and the relief grain (the shading S) |
| `engine/plain.js` | The Plain theme: the dominant hue (B), the blurred fluid field (P), its colours, and the glow's lights (G) |
| `engine/spontaneity.js` | S1–S5: the Hawkes timing, placement, the three kinds of mark, their life, and `Living`, which redraws only where marks are |
| `engine/render.js` | Upscaling the mask, the views, the P6 composite, the contour |
| `Renderer.js`, `controls.js`, `report.js` | The page, the sliders, the report text |

Choices the spec left open:
- The seed is taken from the picture scaled down to at most 2048 px on its long side, so it
  doesn't depend on the screen.
- **Sharpness:** every view is rendered at the screen's own pixel size (device pixels), just big
  enough to cover it, so one picture pixel is one screen pixel and the paper and the marks stay
  sharp. Renders are capped at 6 million pixels (past that the screen scales the picture up a
  little). After a resize settles (0.4 s), the picture is rendered again if the size it needs
  changed by more than 10%. All lengths are in canvas units, so a bigger render is the same sheet.
- The smooth noises (the grain's warp and mottle, and the cloudiness) are evaluated on a coarser
  grid, every 1–8 pixels depending on their finest scale, and filled in bilinearly; the creases,
  fibres, flakes and marks are evaluated at every pixel.
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
- **Tint τ** (Colour, added after the spec, default beige `#f2ebd9`, the old paper): a colour picker.
  Everything takes its colours from τ (`palette()` in `colour.js`):
  - paper = τ, and ink = OKLCh(min(0.27, 0.6 L_τ), C_τ / 2, h_τ). So the whole ink–paper line is
    toned in τ's hue, with chroma C_τ (1 + t) / 2 along it, like a sepia print. The Mask and Field views
    use the same line.
  - The tan of the washi's fibres, web and flakes keeps its place relative to the paper:
    tan = OKLCh(L_τ − 0.14, 2 C_τ, h_τ − 13°), which is the old tan at the default. Its absorber is taken
    against the new paper. Specks and the spontaneity marks absorb toward the new ink. Cloudiness and
    relief were grey multipliers already, so they follow on their own.
  - Warmth Δw moves toward the tan's hue, h_τ − 13° (75° at the default).
  - The defaults match the old look to within a byte, except the ink: it's now a dark beige
    (#292620) where it was a violet grey (#29252b).
- **Brightness ΔL and warmth Δw** (Colour, added after the spec, both 0 by default): the monochrome
  is moved by Δ = (ΔL, Δw cos 75°, Δw sin 75°) in OKLab before the mask mixes it over paper, so the
  base is `mix(paper, monochrome + Δ, mask)` = the plain base + mask · Δ. 75° (at the default tint) is the tan's hue:
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
