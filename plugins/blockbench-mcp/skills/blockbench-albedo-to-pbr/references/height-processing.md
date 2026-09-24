# Height processing and normal derivation

Contents: [Pipeline](#pipeline) · [Height sources](#height-sources) · [Depth shaping](#depth-shaping) · [Common shaping](#common-shaping) · [Normal derivation](#normal-derivation) · [Conventions](#conventions) · [Validation report](#validation-report) · [Runtime parity](#runtime-parity)

Both scripts run the same chain. Values are floats in 0..1 until the height is quantised to 8 bits; the normal is derived from that quantised height so the written `_height.png` is exactly what produced `_normal.png`.

## Pipeline

```
albedo RGBA
  └─ height source ──► luminance | Depth Anything V2 | height file
        └─ depth shaping (flatten, high-pass, invert, normalize)   [defaults on for depth]
              └─ seam heal (offset)  [optional]
                    └─ soften (density-scaled gaussian)  [optional]
                          └─ levels (black, white, gamma)  [optional]
                                └─ quantise to 8 bit ──► <name>_height.png
                                      └─ 3x3 edge kernel ──► <name>_normal.png + report
                                            └─ MER inference (albedo + height + normal curvature) ──► <name>_mer.png + merReport
```

MER inference is documented in [mer-inference.md](mer-inference.md); this file covers the height and normal stages.

## Height sources

**Luminance** (`--height-source luminance`, default). BT.601 luma (`0.299 R + 0.587 G + 0.114 B`) or the channel average (`--luma average`) of the albedo *as stored*, without sRGB linearisation: on painted and pixel-art textures the luminance steps are the relief the artist drew, and linearising crushes the darks. Light reads as high. Use `--invert-height` when the painting convention is the opposite (dark grout that should be recessed already reads low; dark paint meant to be raised needs the flag). Luminance mistakes painted shadows for pits and highlights for bumps; that is acceptable for stylised art and wrong for photographic textures.

**Depth Anything V2** (`--height-source depth`). A monocular depth model; output is relative inverse depth, 1 = nearest. Use it on textures with real structure the model can read as a photo: bricks, planks, cobble, foliage, machinery. It has nothing to say about a flat two-tone checker (it returns a radial vignette). Small textures are lifted first with a nearest-neighbour integer upscale so the model's ~518 px bicubic resize does not smear pixel edges:

```
factor = clamp(ceil(1024 / min(w, h)), 1, floor(4096 / max(w, h)))
```

The prediction (at the upscaled size) is block-averaged back by the same factor (an exact inverse of nearest-neighbour) and lightly unsharpened (`x + 0.5 · (x − box3(x))`, edge-clamped). Every source texel maps to an exact k×k block, so the round trip is alignment-perfect.

**File** (`--height-source file --height-file h.png`). Any grayscale PNG at the albedo's size (red channel is read). Use it for a height painted in Blockbench, produced by another tool, or a previously generated `_height.png` you want to re-shape. Depth shaping is off by default for this source; `--invert-height` flips it.

## Depth shaping

Applied after the source, in this order. Defaults: `--flatten 1`, `--high-pass 0`, no invert, normalize on for the depth source; all off for luminance and file unless requested.

1. **Flatten** (`--flatten 0..1`): least-squares plane fit over centred pixel coordinates, subtracted (mean preserving). Monocular depth almost always carries a foreground-to-background ramp across the frame; on a tile that puts one border high and the opposite one low. The plane removes the linear part.
2. **High-pass** (`--high-pass R` texels): subtract a wrap-around box blur ×3 (≈ Gaussian) of radius R, recentred on 0.5. Keeps relief smaller than R and kills the non-linear leftovers the plane cannot express. Because the blur wraps, the subtraction cannot introduce a seam. Start around a quarter of the texture width for tiles; smaller values keep only fine grain.
3. **Invert** (`--invert-height`): far reads as high, for sources where the receding surface is the raised one.
4. **Normalize**: min–max stretch back to 0..1, because the edits shrink the range. `--no-normalize` keeps absolute values (useful when several textures must share a relief scale).

## Common shaping

**Seam heal** (`--seam offset --seam-amount 0..0.5`). Wrap-and-heal for tiling textures: shift the field by half a tile (the borders become interior, hence wrapping), then blend the unshifted field back over the seam cross in the centre with a smoothstep ramp. The blend weight is height-steered (the taller surface wins the middle of the transition, windowed by `4t(1−t)` so the borders stay exactly pure), which keeps a raised feature on top instead of ghosting it into the surface behind. Amount is the healed margin as a fraction of each axis.

**Soften** (`--soften MULT`). Gaussian blur with `sigma = min(shortSide / 16 / 4 · MULT, 8)` texels, wrapped when `--wrap` is set, clamped otherwise. The sigma scales with texel density so the blur is a constant fraction of a block face: HD relief (128×, 256×) loses the one-texel stair-steps that make lit relief look faceted, while 16× art (sigma 0.25) is effectively untouched. Leave at 0 for pixel art.

**Levels** (`--levels BLACK,WHITE,GAMMA`). Input black/white points then gamma (`((v − black) / (white − black)) ^ (1 / gamma)`). Use it to clip the flat body of a texture to one plateau (raise black), compress relief (lower white), or bias the midtones before the normal kernel.

## Normal derivation

3×3 edge kernel over the quantised height, per texel:

| Operator | corner | edge | Character |
|---|---|---|---|
| sobel (default) | 1 | 2 | balanced; standard for pixel art |
| prewitt | 1 | 1 | softer, less directional emphasis |
| scharr | 3 | 10 | best rotational symmetry; smooth HD height |

```
dx = -c·s00 + c·s02 - e·s10 + e·s12 - c·s20 + c·s22     (rises to the right → positive)
dy =  c·s00 + e·s01 + c·s02 - c·s20 - e·s21 - c·s22     (rises upward → positive)
n  = normalize(-dx · strength,  ±dy · strength,  1)
rgb = n · 0.5 + 0.5
```

Strength multiplies the gradients with z fixed at 1, so the dial reads as labelled (higher = stronger relief). The kernels are unnormalised, so a one-texel step of Δh gives `dx = 4Δh` under Sobel. Typical values: 0.25 subtle, 0.5 default, 1–2 pronounced pixel-art relief; halve it for every doubling of texture density if the relief should look the same in block space.

Sampling: `--wrap` samples across the borders (seamless tiles), otherwise taps are clamped to the edge (atlases, non-tiling art). A neighbour whose albedo alpha is below `--alpha-threshold` (0–255, default 8) is off-island and replaced by the centre height, so relief never bleeds across transparent UV gutters; off-island texels themselves emit the flat normal `(128, 128, 255)`. The normal PNG is written with opaque alpha.

## Conventions

- **DirectX (green-down)**, `--convention directx`, default. Green > 128 means the surface faces down (+V). This is what the Bedrock RTX pipeline and the reference material tooling assume; the Mojang texture-set spec and the NVIDIA texturing guide only specify the neutral colour `(128, 128, 255)`, so verify in the target renderer and regenerate with `--convention opengl` if lit relief looks inverted top-to-bottom.
- **OpenGL (green-up)**, `--convention opengl`. Used by Blender, Unity, Godot, glTF, labPBR (Java shader packs). Converting between the two is a green-channel inversion; X and Z are shared.
- Height: light = high, 8-bit grayscale. Bedrock texture sets accept `heightmap` **or** `normal`, never both; the heightmap layer is meant for 16× pixel-art sets, the normal layer for everything else.

## Validation report

Printed as JSON by both scripts (`report`), decoding every texel to `(x, y, z)` in −1..1:

| Field | Meaning | Healthy |
|---|---|---|
| `classification` | `standard` (unit-length XYZ), `z-zero` (blue holds 0..1 z), `xy-only`, `heightfield` (≥95 % grayscale) | `standard` |
| `normalizedPct` | share of texels with length within ±0.1 of 1 | ≥ 0.98 |
| `flatPct` | share of texels at the neutral colour | informational; high on flat art or big gutters |
| `negativeZCount` | blue < 128 | 0 |
| `xyTooLongCount` | `hypot(x, y) > 1` | 0 |
| `meanXYBias` | mean x and y | within ±0.1 of 0 |
| `verdict` | `ok` / `warn` / `fail` | `ok` |

`heightfield` or `xy-only` means the wrong image was fed in (a height or albedo passed as a normal, or a normal passed as albedo). Large `meanXYBias` on a tile indicates an unflattened ramp in the height.

## Runtime parity

The WGSL kernels and the torch implementation share the maths above. On the same 8-bit height the outputs match to within 2 levels (GPU `normalize` precision); on identical luminance inputs the height PNGs are byte-identical except where a value sits exactly on a rounding boundary. Depth results differ slightly between runtimes because the PyTorch and ONNX conversions of Depth Anything are not bit-identical.
