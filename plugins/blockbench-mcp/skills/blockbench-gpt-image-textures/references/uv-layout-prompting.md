# Writing the UV layout into a GPT Image 2.5 prompt

Contents: coordinate conventions · material scale · prompt template · describing box-UV nets · per-face rectangles · mesh islands · shared and mirrored regions · style directives by target · worked examples (Bedrock entity, Java block tile, Generic Model atlas) · anti-patterns · iteration with the edit endpoint.

## Coordinate conventions

State these in the prompt once, under `canvas`:

- Origin is the top-left corner. `x` grows to the right, `y` grows downward.
- A region `px: [x1, y1, x2, y2]` covers columns `x1` to `x2 - 1` and rows `y1` to `y2 - 1` of the generated image.
- `texel_scale` is the size of one texture pixel in the generated image. For a 64×64 atlas at 1024×1024, one texel is a 16×16 px block.

Blockbench UV rectangles are in logical UV units. `scripts/uv_layout_prompt.mjs` converts them: `texel = uv × frame_size / uv_size`, then `px = texel × texel_scale`. Never hand-copy UV units into the prompt as pixels.

## Preserve material scale

Apply [UV scale and distortion guidance](../../blockbench-texturing/references/uv-scale-and-distortion.md) before generating the prompt. Confirm that the UV footprint is proportionate to the surface and that comparable faces sample a consistent number of final texture pixels per model unit. The script converts coordinates; it does not validate that relationship. Its generation `texel_scale` and a request for a "256x base" do not establish material density.

Keep computed rectangles unchanged, and add surface coverage, direction, and feature size to each relevant `paint` description. For example, at four final texture pixels per model unit, a face covering 32×4 model units needs 128×16 texture pixels. Describe a two-pixel grain feature as covering half a model unit; at a generation upscale of eight, that feature occupies 16 generated pixels. A 64×4 face at the same density needs 256×16 texture pixels and approximately twice as many grain repetitions along its length. Use the model's actual dimensions and chosen material scale, not these example values by default.

Match authored feature sizes across regions and PBR channels. Equal UV density can still look inconsistent if the generator paints coarse grain in one region and fine grain in another. Intentional uniform fills, directional effects, or resolution allocations may differ; describe the exception without stretching detailed channels accidentally.

## Prompt template

```json
{
  "type": "UV texture atlas for a low-poly 3D game model. Flat orthographic texture sheet, not a 3D render, not a mockup.",
  "subject": "<what the model is: species, character, block, material>",
  "style": "<art style, palette size, shading rule, texel rule>",
  "canvas": {
    "width": 1024, "height": 1024, "texel_scale": 16,
    "represents": "64x64 texel atlas; origin top-left, x right, y down"
  },
  "background": "fully transparent outside the listed regions",
  "regions": [
    { "name": "<cube>/<direction> (<what it is>)", "px": [x1, y1, x2, y2], "paint": "<content of this face>" }
  ],
  "shared": [ ["leg_left/north", "leg_left/south"] ],
  "rules": [
    "paint each region edge to edge, aligned to the 16 px texel grid",
    "leave every pixel outside the regions transparent",
    "no labels, numbers, grid lines, region outlines, drop shadows, or text",
    "faces of the same cube continue seamlessly across shared edges",
    "regions listed under shared receive identical pixels",
    "flat, unlit colors; no baked lighting, no specular highlights"
  ]
}
```

Send the JSON as the prompt string verbatim. Keep `regions` in the same order the script emitted; the model reads top to bottom and later regions get less attention, so put the most visible faces first (head, front, top).

## Describing box-UV nets

A box-UV cube of size W×H×D occupies a cross-shaped net whose origin is `uv_offset`:

```
        [ up  ][down ]          up/down:   W wide, D tall, at y = 0 .. D
[east][north][west][south]      side row:  D, W, D, W wide; H tall, at y = D .. D+H
```

`get_cube_uv` already returns the six generated face rectangles, so use them rather than recomputing. Describe the net as one group in the prompt so the model paints it as one object:

```json
{ "name": "head (box UV net, 6 faces)", "group_px": [0, 0, 512, 256],
  "faces": [
    { "name": "head/up",    "px": [128, 0, 256, 128],   "paint": "top of head, fur parting" },
    { "name": "head/down",  "px": [256, 0, 384, 128],   "paint": "underside of jaw, lighter fur" },
    { "name": "head/east",  "px": [0, 128, 128, 256],   "paint": "right side of head with one ear" },
    { "name": "head/north", "px": [128, 128, 256, 256], "paint": "face: two eyes, nose, mouth" },
    { "name": "head/west",  "px": [256, 128, 384, 256], "paint": "left side of head with one ear" },
    { "name": "head/south", "px": [384, 128, 512, 256], "paint": "back of head" }
  ] }
```

Mirrored box UV (`mirror_uv: true`) or `up`/`down` faces with reversed rectangle order are reported as `mirrored_x` / `mirrored_y` by the script. Tell the model: "paint this face as if viewed in a mirror (left and right swapped)".

## Per-face rectangles

Per-face UV cubes give six independent rectangles that may overlap, rotate or reuse space. List each face with its `px` box and its `rotation` when non-zero: "content rotated 90° clockwise inside the box". Skip faces whose `texture_status` is `disabled`; the script omits them.

## Mesh islands

`get_mesh_info: include_uv=true` returns polygons per face. The script emits each face's bounding box as a region with `polygon: true`. Describe islands by what they wrap: "cloth/f1: the front of the saddle blanket, weave pattern, edge fringe along the bottom". For large unwrapped meshes, group faces that belong to one island in the prompt by their combined bounding box rather than listing dozens of triangles.

## Shared and mirrored regions

Blockbench formats often map left/right limbs to the same pixels. The script lists these under `shared_regions`. Put one region in `regions` and reference the rest in `shared`; do not list the same rectangle twice with different content or the model will average them.

Sharing a material does not require sharing an identical UV rectangle. Use proportionate subregions or suitable trim strips for differently sized faces, and preserve those separate footprints in the prompt. Reuse a complete rectangle when mapped surface dimensions are compatible, accounting for rotation, or when its scale difference is intentional. Group descriptions for readability without collapsing distinct face layouts into one stretched swatch. Verify destination tiling support before planning repeats; an atlas subregion does not wrap independently.

## Style directives by target

| Target | Style phrasing |
|---|---|
| Minecraft Bedrock/Java entity or block | "crisp pixel art, each texel a solid 16x16 px block, no anti-aliasing, ≤ 16 colors, flat unlit shading, subtle 1-texel darker outline only where the reference does" |
| Hytale | "clean stylized pixel art, painterly hand-shaded blocks allowed, soft two-tone shading per face, consistent light from top-left" |
| Generic Model / glTF | "hand-painted 1024 px atlas, PBR albedo only: no baked lighting, no specular, medium-frequency detail" |
| Skin formats (64×64 player skin) | "Minecraft player skin sheet, second layer regions transparent unless clothing is described" |

Say "texel" and "block" explicitly for pixel-art targets. Without them the model draws smooth gradients that collapse to mud when downscaled.

## Worked examples

### Bedrock entity, 64×64 atlas, generated at 1024×1024

Inspection: `list_textures` reports `frame_size [64, 64]`, `uv_size [64, 64]`; `get_cube_uv` for `head`, `body`, `leg_*`. Script output picks `texel_scale 16`, `image_size 1024×1024`, 6 head faces, 6 body faces, 4 leg faces sharing one net.

Prompt (abridged):

```json
{ "type": "UV texture atlas for a low-poly 3D game model. Flat orthographic sheet, not a render.",
  "subject": "small brown alpaca, cartoon Minecraft mob",
  "style": "crisp pixel art, each texel a solid 16x16 px block, no anti-aliasing, 12-color palette, flat unlit colors",
  "canvas": { "width": 1024, "height": 1024, "texel_scale": 16, "represents": "64x64 texel atlas; origin top-left" },
  "background": "transparent outside regions",
  "regions": [
    { "name": "head/north (face)", "px": [128, 128, 256, 256], "paint": "front of head: two black 2-texel eyes at upper third, tan muzzle band along the bottom" },
    { "name": "head/up",   "px": [128, 0, 256, 128],   "paint": "top of head fur; darker tuft in the centre" },
    { "name": "head/east", "px": [0, 128, 128, 256],   "paint": "right side of head; fur; continues from head/north" },
    { "name": "head/west", "px": [256, 128, 384, 256], "paint": "left side of head; mirror of head/east" },
    { "name": "head/south","px": [384, 128, 512, 256], "paint": "back of head, plain fur" },
    { "name": "head/down", "px": [256, 0, 384, 128],   "paint": "chin, lighter fur" },
    { "name": "body/*",    "px": [0, 256, 640, 512],   "paint": "box-UV net of the torso: fluffy wool, saddle blanket with red and gold stripes on up and both sides" },
    { "name": "leg/*",     "px": [0, 512, 256, 768],   "paint": "box-UV net of one leg, reused by all four legs: brown fur with a dark hoof at the bottom 2 texels" }
  ],
  "shared": [["leg_front_left", "leg_front_right", "leg_back_left", "leg_back_right"]],
  "rules": [ "...standard rules..." ] }
```

Generate with `--background transparent --width 1024 --height 1024`, downscale with `--width 64 --height 64 --alpha-threshold 128`, import with `create_texture` `data`, apply to the root group, screenshot from front, side and top.

### Java block, 16×16 tile, generated at 1024×1024

A single-face tile has one region covering the whole canvas. Prompt for tiling explicitly: "seamless tile; the left edge continues into the right edge and the top into the bottom". Generate at `texel_scale 64`, downscale with center sampling, then check a 2×2 repeat in Blockbench by applying to four adjacent cubes.

### Generic Model, 1024×1024 hand-painted atlas

`texel_scale` is 1, so no downscale. Regions come from `get_mesh_info` islands; describe them by body part and give the model `"style": "hand-painted albedo, no baked lighting"`. Use Sunburst at `high` for the final; Flare at `medium` for layout tests. Import with `create_texture` `data` and, in `per_texture_uv_size` formats, the original `uv_width`/`uv_height`.

## Anti-patterns

- Describing the 3D scene ("an alpaca standing in a field") instead of the sheet. The model renders a picture.
- Omitting `canvas.texel_scale` and pixel-art phrasing for low-resolution targets.
- Listing the same rectangle twice with different content.
- Asking for "a UV map" or "UV template": the model draws colored placeholder squares with labels.
- Requesting outlines, labels or grid lines "to help alignment"; they end up in the texture.
- Copying UV units as pixels, or forgetting `frame_size / uv_size` in formats where they differ.
- Applying the same full swatch to every face regardless of dimensions, or fitting each face independently to generated material bounds without preserving proportions and density.
- Painting the same number of grain features into regions covering different surface sizes, making the material appear coarser on larger parts.
- Treating generation `texel_scale`, a higher image resolution, or UV bounds checks as proof of consistent material scale.
- Generating at the atlas's native size; fal rejects anything under 655,360 pixels.

## Iterating with the edit endpoint

1. Keep the accepted output URL (or upload the imported PNG).
2. Build a mask: white over the regions to redo, black elsewhere, same canvas size.
3. POST to `/edit` with `image_urls: [previous]`, `mask_url`, and a prompt that repeats the `canvas` block plus only the regions being changed, prefixed "Repaint only the masked regions; keep everything else pixel-identical".
4. Re-run the downscale and re-import under a new texture name, then `apply_texture` and compare screenshots before replacing the old texture.

Keep the planned UV footprints during cleanup. Repaint or extend drifting material boundaries into those footprints; any necessary UV resizing must retain the intended proportions and density and keep PBR channels aligned. Recheck both a temporary checker and the actual material after the edit.
