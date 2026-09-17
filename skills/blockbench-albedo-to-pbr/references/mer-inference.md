# MER inference: metalness, emissive, roughness

Contents: [What MER is](#what-mer-is) · [Inputs](#inputs) · [Metalness](#metalness) · [Emissive](#emissive) · [Roughness](#roughness) · [Overrides](#overrides) · [Report and checks](#report-and-checks) · [Parity](#parity)

Both scripts write `<name>_mer.png` unless `--no-mer` is passed. Blockbench and Bedrock read the three channels from one packed RGB image, and Blockbench requires a MER texture next to the color texture for a material's PBR channels to take effect (a color-only material previews flat).

## What MER is

| Channel | Meaning | 0 | 255 |
|---|---|---|---|
| R | metalness | dielectric | metal (albedo becomes the specular tint) |
| G | emissive | no glow | full-strength glow of the albedo colour |
| B | roughness | mirror | fully matte |

Alpha is written as 255. Bedrock's MERS variant carries subsurface thickness in alpha; the scripts do not produce it. Uniform values exist for Blockbench materials (`mer_value=[M, E, R]`), but a texture is needed the moment any channel varies across the surface.

## Inputs

The MER pass reads the albedo, the shaped 8-bit height (with the albedo alpha as island mask) and the derived normal. Sampling is the same as the normal pass: `--wrap` wraps, otherwise taps clamp; off-island neighbours are replaced by the centre value; off-island texels emit `(0, 0, 255)`: no metal, no glow, matte.

## Metalness

HSV heuristic, binary output:

- **Achromatic metals** (steel, iron, silver, chrome): value ≥ `--metal-brightness` (0.6) and saturation ≤ `--metal-saturation` (0.15), each with a short smoothstep ramp.
- **Gold**: hue within `--gold-hue` (0.11–0.17), saturation ≥ 0.3, value ≥ 0.5.
- **Copper**: hue within `--copper-hue` (0.03–0.10), saturation ≥ 0.3, value ≥ 0.4.

A 3×3 majority vote then removes single-texel speckle from the mask (`--no-metal-clean` keeps the raw threshold, for 16× art where one texel is a deliberate rivet).

The heuristic cannot tell polished steel from white wool, bone, snow, quartz or a pale blue backboard: anything bright and desaturated becomes metal. On stylised content that is the common failure, so treat `metalPct` in the report as a question to answer, not a result to accept. `--metal 0` for materials with no metal, `--metal auto` plus palette overrides when some palette colours are metal, `--metal 1` for a fully metallic part.

## Emissive

Bright **and** saturated texels glow: value ≥ `--emissive-brightness` (0.8) and saturation ≥ `--emissive-saturation` (0.5), multiplied smoothsteps, so a pale highlight does not trigger it. `--emissive-overbright T` adds the physically motivated rule that luminance above `T` cannot be a lit dielectric and must glow; it is off by default (`1`) because pure white is ordinary in pixel art. `--emissive-softness 0..1` blends toward the 3×3 neighbourhood mean, which anti-aliases the glow outline without blurring its interior.

False positives are saturated bright colours that are merely bright: a yellow beak, a red flower, neon signage that is painted, not lit. Check `emissivePct`; fix with `--emissive 0` or palette overrides for the glowing colours only.

## Roughness

Weighted composite, clamped to 0..1, then `--rough-scale` and `--rough-bias`:

| Term | Source | Reads as | Weight |
|---|---|---|---|
| variance | 5×5 luminance variance × 10 | grain, noise, dirt | `--rough-weights` V (0.4) |
| edge | Sobel magnitude of albedo luminance × 2 | painted detail and outlines | `--rough-weights` E (0.3) |
| saturation | `1 − 0.5·S` | pure hues glossier, greys rougher | `--rough-weights` S (0.3) |
| curvature | `−divergence(normal XY) × 2`, clamped −1..1 | crevices rougher, convex ridges smoother | `--rough-curvature` (0.25) |
| height | mix toward `1 − height` (or `height` when negative) | recesses collect dirt (positive) or shine (negative) | `--rough-height` (0, range −1..1) |

The curvature term is what the normal map contributes: divergence of the decoded XY (`0.5·(∂Nx/∂x ± ∂Ny/∂y)`, sign following the green convention) is positive on convex ridges and negative in grooves, so a bevelled edge wears glossier and a mortar line roughens without any colour cue. It is signed and can lower roughness; hold it small on 16× art where every texel boundary is a "ridge". Height influence is the coarse version of the same idea and is off by default; set it around 0.3–0.5 for masonry, bark and soil, negative for worn metal where the raised surface is polished.

Typical outcomes: matte painted pixel art lands around 0.5–0.8; flat pale surfaces fall toward the low end because there is neither variance nor edges, which is often too glossy for cloth or paint. Raise them with `--rough-bias 0.2` or set a uniform `--roughness 0.8` when the material is uniformly matte.

## Overrides

Applied on the CPU after inference, in this order:

1. **Uniform channels**: `--metal`, `--emissive`, `--roughness` each accept `auto` or a 0..1 value that replaces the inferred channel on every island texel.
2. **Palette**: `--palette "#RRGGBB=m,e,r;#RRGGBB=-,-,0.9"` sets channels for texels whose albedo colour matches exactly; `-` leaves that channel as inferred (or as the uniform). This is the precise tool for pixel art, where a material is a handful of palette entries: mark the iron greys metal, the lava oranges emissive, the wool whites matte, and leave the rest inferred. The report counts matched texels (`paletteTexels`); zero means the colour was not exact, so read it from the atlas rather than guessing.

The Python script also stores the three channels on the PyPBR material (`metallic`, `emissive`, `roughness`), so `--material-folder` writes them as separate grayscale PNGs alongside the packed file.

## Report and checks

`merReport` in the JSON:

| Field | Meaning |
|---|---|
| `islandTexels` | texels with alpha ≥ threshold (the denominator) |
| `metalPct`, `emissivePct` | share of island texels at or above 128 in R / G |
| `roughnessMean`, `roughnessRange` | B channel statistics, 0..1 |
| `paletteEntries`, `paletteTexels` | override entries parsed and texels they hit |
| `uniform` | the uniform values in force, `null` = inferred |

Compare the percentages with what the material is: a wooden crate should report `metalPct` 0; a lantern should report a small `emissivePct` on the flame only. Then view the channels (split the PNG or inspect the PyPBR folder) before assigning. In Blockbench, `create_pbr_material` or `configure_material` with `mer_texture` plus the color texture; `get_material_info` confirms the channel, and a lit screenshot shows whether metal regions turned dark and reflective and glow regions light up.

## Parity

The WGSL and torch implementations share the maths. On a 16× tile the packed MER bytes are identical; on a 1024² atlas metal is identical, emissive is within one level and roughness within three (it consumes the normal, which itself differs by up to two levels between runtimes, and float summation order differs in the variance term). The report percentages agree to four decimals.
