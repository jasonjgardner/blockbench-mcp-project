---
name: blockbench-gpt-image-textures
description: Generate Blockbench texture atlases, skins and tiles with OpenAI GPT Image 2.5 (Flare or Sunburst) on fal.ai, writing the model's expected UV layout into the prompt so painted regions land on the right faces. Use when asked to AI-generate, concept, or repaint a texture for a Blockbench model, or to call openai/gpt-image-2.5/flare/text-to-image or openai/gpt-image-2.5/sunburst/text-to-image. Triggers on gpt image 2.5, gpt-image-2.5, flare, sunburst, fal.ai texture, generate texture with AI, UV-aware prompt, texture atlas prompt, AI skin, AI texture sheet.
---

# GPT Image 2.5 Textures for Blockbench

Generate a texture image with GPT Image 2.5 on fal.ai and land it on an existing Blockbench UV layout. The prompt must carry the UV layout: which pixel rectangle of the image belongs to which face. Without it the model paints a picture, not an atlas.

Load [blockbench-use](../blockbench-use/SKILL.md) first for discovery and verification rules, and [blockbench-texturing](../blockbench-texturing/SKILL.md) for UV inspection and cleanup painting.

## Pick a model

| Model | fal endpoint | Use for |
|---|---|---|
| Flare (default) | `openai/gpt-image-2.5/flare/text-to-image` | Fast drafts, most atlases, transparent backgrounds |
| Sunburst | `openai/gpt-image-2.5/sunburst/text-to-image` | Final high-resolution atlases with intricate detail; slower |

Both accept the same parameters and share `/edit` variants that take reference images. Details, pricing and recipes: [references/fal-api.md](references/fal-api.md).

## Workflow

### 0. Settle the geometry/detail tradeoff

For a new model or substantial redesign, resolve the appearance/accuracy, performance, or balanced preference through [blockbench-use](../blockbench-use/SKILL.md) before committing geometry or generating an atlas. Apply [appearance and performance planning](../blockbench-use/references/appearance-and-performance.md): establish the simplified target geometry and shared UV tiles first. An HD image request is not permission to multiply tiny detail cubes.

For braces or railing infills represented by panels, describe the repeated pattern and transparent holes inside each measured UV region, not just transparency outside the atlas islands. For fasteners represented on existing faces, include their albedo marks in those regions and use the [PBR workflow](../blockbench-pbr-materials/SKILL.md) for supported normal/height/MER detail. Verify channel data separately; a color atlas is not a PBR map. Confirm [Bedrock material bindings](../blockbench-use/references/bedrock-material-instances.md) when cutouts or multiple materials are intended for a custom block.

### 1. Establish the UV layout first

The atlas layout must exist in Blockbench before prompting. Run `get_capabilities: include_tools=true`, then `list_textures`. If no texture or UVs exist, generate a native texture template as described in the texturing skill, then continue. Do not invent a layout in the prompt that the model does not have.

Audit that layout using [UV scale and distortion guidance](../blockbench-texturing/references/uv-scale-and-distortion.md) before generation. Compare surface dimensions with sampled image pixels along both face directions, using the effective frame and logical UV sizes. Correct unintended stretching and inconsistent material scale first; an image generator cannot repair a distorted mapping just by painting inside its rectangles. Reusing the same complete swatch is appropriate only for compatible face dimensions or deliberate exceptions.

Collect the layout:

```
list_textures                              # frame_size and uv_size of the target atlas
get_cube_uv: id="<cube uuid>"              # one call per textured cube
get_mesh_info: mesh_id="<uuid>", include_uv=true   # meshes, if any
```

Save the raw results into one JSON file:

```json
{ "textures": [ ...list_textures... ], "cubes": [ ...get_cube_uv results... ],
  "meshes": [ { "name": "cloth", "faces": [ { "key": "f1", "uv": [[40,40],[56,40],[56,52],[40,52]] } ] } ] }
```

### 2. Compute the canvas and regions

fal rejects images under 655,360 pixels, so a 64x64 atlas cannot be generated at native size. Generate an integer upscale and downsample afterwards. The script picks the scale and converts every face rectangle into generated-image pixels:

```bash
node scripts/uv_layout_prompt.mjs inspection.json --texture <atlas name|uuid> > layout.json
node scripts/uv_layout_prompt.mjs inspection.json --format text   # human-readable check
```

Output includes `image_size` (pass to fal unchanged), `canvas.texel_scale`, one region per face with `px` and `texels` rectangles, and `shared_regions` for faces that reuse the same pixels. An exit code of 2 means the atlas aspect exceeds 3:1; generate a padded canvas and crop with `--crop` in step 5, or split the atlas.

`canvas.texel_scale` describes the generation upscale, not material density on the model. Collect surface dimensions separately from the geometry; the region list alone cannot establish pixels per model unit or detect local mesh distortion.

### 3. Write the prompt with the layout inside it

Structure the prompt as JSON. The `layout` block is mandatory and comes straight from step 2. Read [references/uv-layout-prompting.md](references/uv-layout-prompting.md) for the full template, region-description rules and worked examples. Minimum shape:

```json
{
  "type": "UV texture atlas for a low-poly 3D game model, flat orthographic texture sheet, not a 3D render",
  "subject": "brown alpaca, cartoon Minecraft style",
  "style": "crisp pixel art, each texel a solid 16x16 px block, no anti-aliasing, 12-color palette, flat unlit colors",
  "canvas": { "width": 1024, "height": 1024, "texel_scale": 16, "represents": "64x64 texel atlas" },
  "background": "fully transparent outside the listed regions",
  "regions": [
    { "name": "head/north (face)", "px": [128, 128, 256, 256], "paint": "front of the head: two dark eyes, muzzle, no outline" },
    { "name": "head/up",   "px": [128, 0, 256, 128], "paint": "top of head fur, seam-continuous with head/north" }
  ],
  "rules": [
    "paint every region edge to edge; leave everything else transparent",
    "no labels, grid lines, borders, drop shadows or text anywhere",
    "adjacent faces of one cube must continue seamlessly across their shared edge",
    "regions listed as shared receive identical content"
  ]
}
```

Describe what each face shows, not the 3D scene. Name regions by cube and direction, keep the pixel rectangles exactly as computed, and mention rotation or mirroring the script reported.

For detailed materials, describe each region's surface coverage in model units, grain direction, and consistent feature size across related regions. Larger surfaces normally show more repetitions of the same grain or pattern. Preserve individual UV footprints when grouping descriptions by material; do not map one full material rectangle onto every differently sized face. Coordinate these choices with all PBR channels.

### 4. Generate

```bash
FAL_KEY=... node scripts/fal_gpt_image.mjs --prompt-file prompt.json --model flare \
  --width 1024 --height 1024 --background transparent --quality medium --num 2 --out ./output --label alpaca
```

Use `--width/--height` from `layout.json` `image_size`. `--background transparent` yields real alpha on Flare; verify alpha on Sunburst output before relying on it. Start with `medium` quality and `--num 2` to pick a candidate; `high` or `xhigh` only for finals. `--dry-run` prints the request body for review. Download happens inside the script; fal URLs expire.

### 5. Downscale to the atlas

Skip this step when `texel_scale` is 1. Otherwise sample the centre of each texel block with nearest-neighbour and snap alpha for pixel art:

```bash
python scripts/resize_to_atlas.py output/alpaca_<ts>.png output/alpaca_64.png --width 64 --height 64 --alpha-threshold 128
```

Use `--sample average` for painterly high-resolution atlases, and `--crop X Y W H` to cut a padded canvas back to the atlas aspect first.

### 6. Import, apply and verify in Blockbench

```
create_texture: name="alpaca", data="<absolute path to alpaca_64.png>"
apply_texture: id="<group or element>", texture="alpaca", applyTo="all"
get_texture: texture="alpaca"
capture_screenshot
```

In formats with `per_texture_uv_size`, pass `uv_width`/`uv_height` to `create_texture` matching the original atlas `uv_size`. Check the rendered model for region drift, seam bleeding, mirrored content, and inconsistent grain or relief scale. Use a temporary checker to distinguish mapping distortion from inconsistent detail painted into the atlas; inspect long/short faces and sides/ends at close and intended viewing distances.

When generated boundaries drift, repaint or extend the material to fit the planned UV footprint. Avoid independently fitting each face's UV rectangle to the generated content bounds: that can alter both aspect ratio and density. If UV edits are necessary, preserve proportions and intended density, update corresponding PBR regions, and repeat the scale checks. Fix small image errors with the texturing skill's paint tools. For larger errors, iterate through the `/edit` endpoint with the previous output URL and a prompt naming only the regions to change.

Once the color atlas is final, derive its normal, height and MER maps with [albedo to normal](../blockbench-albedo-to-normal/SKILL.md) rather than generating PBR channels with the image model; run it on the downscaled atlas so the maps share the texel grid.

## What to expect

- The model treats pixel rectangles as guidance, not a contract. Expect 1 to 3 texel drift at region borders and occasional content spilling into transparent gutters; the downscale and cleanup pass absorb most of it.
- Fewer, larger regions work better than many tiny ones. For atlases with more than about 20 regions, group by body part in the prompt and describe shared regions once.
- Pixel-art phrasing ("each texel a solid 16x16 px block") keeps blocks aligned to the texel grid. Without it the model anti-aliases and the downscale muddies edges.
- A rendered UV template or checker fed through `/edit` as `image_urls` anchors the layout far more reliably than text alone. Use `capture_screenshot` or the native template texture, upload it, and prompt "paint this texture sheet" with the same `layout` block.
- Long text, logos and readable labels belong in a separate pass; they compete with the layout rules.
- Every output is a full RGB(A) image; nothing prevents the model from painting outside regions. Verify against `get_cube_uv` rectangles, not against the prompt.

## Resources

- [references/fal-api.md](references/fal-api.md): endpoints, parameters, sizes, pricing, transparency, curl/Node/Python recipes, edit endpoint.
- [references/uv-layout-prompting.md](references/uv-layout-prompting.md): prompt template, how to describe box-UV nets, per-face rectangles and mesh islands, worked examples for Bedrock entity, Java block and Generic Model targets.
- `scripts/uv_layout_prompt.mjs`: inspection JSON to canvas size and pixel regions.
- `scripts/fal_gpt_image.mjs`: call Flare or Sunburst (text-to-image or edit), save results.
- `scripts/resize_to_atlas.py`: nearest-neighbour or box downscale to atlas size, optional crop and alpha snap (needs Pillow).
