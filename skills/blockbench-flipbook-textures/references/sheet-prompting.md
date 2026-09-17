# Sprite Sheet Prompting

Use this when preparing the GPT Image 2.5 prompt through [blockbench-gpt-image-textures](../../blockbench-gpt-image-textures/SKILL.md). The prompt describes a temporary source sheet; the final runtime strip is assembled separately.

## Coordinates

For a gapless grid, source cell size is `W*S × H*S` and canvas size is `C*W*S × R*H*S`. Frame `i` has column `i % C`, row `floor(i/C)`, and origin `(column*W*S, row*H*S)`. Rectangles use an upper-left origin; state whether numbers mean XYWH or left/top/right/bottom.

For an animated UV atlas, first map each one-frame UV island to final-frame pixels using the existing texture/UV inspection. Scale those coordinates by `S` and add the frame origin for each cell. Preserve all overlaps, rotations, and mirroring from the established UV map. The dependency's `uv_layout_prompt.mjs` can help derive one-frame regions, but its canvas calculation is not a multi-frame sheet planner.

For sixteen 32×32 final frames, choose `C=4`, `R=4`, `S=8`: the source is 1024×1024, each cell is 256×256, and the exported strip is 32×512. Phase 15 is 15/16 of a cycle, not a duplicate of phase 0. For ten frames in a 4×3 grid, identify cells 10 and 11 as unused and exclude them during conversion.

## Example Prompt

Adapt the subject, frame phases, style, alpha, and tiling behavior to the request. Serialize a JSON prompt to a file for the generation script. This example is a transparent portal sprite, not an opaque terrain tile.

```json
{
  "type": "flat animation sprite sheet for a game texture",
  "subject": "a cyan magical portal ring pulsing through one smooth cycle",
  "canvas": {"width": 1024, "height": 1024},
  "layout": {
    "columns": 4,
    "rows": 4,
    "cell_width": 256,
    "cell_height": 256,
    "frame_count": 16,
    "order": "row-major; left to right, then top to bottom",
    "origin": "upper left",
    "outer_padding": 0,
    "gutter": 0,
    "frame_rectangles_xywh": [
      [0,0,256,256], [256,0,256,256], [512,0,256,256], [768,0,256,256],
      [0,256,256,256], [256,256,256,256], [512,256,256,256], [768,256,256,256],
      [0,512,256,256], [256,512,256,256], [512,512,256,256], [768,512,256,256],
      [0,768,256,256], [256,768,256,256], [512,768,256,256], [768,768,256,256]
    ]
  },
  "style": "32x32 pixel-art frame enlarged 8x; each logical texel is a solid 8x8 block; limited cyan and blue palette; hard edges",
  "registration": "ring centered at local pixel 128,128 in every cell; fixed outer silhouette, scale, and orthographic camera; complete ring remains within each cell",
  "motion": {
    "phases": [0,0.0625,0.125,0.1875,0.25,0.3125,0.375,0.4375,0.5,0.5625,0.625,0.6875,0.75,0.8125,0.875,0.9375],
    "cycle": "one luminous highlight travels clockwise once around the ring, beginning at twelve o'clock; inner energy brightens and dims smoothly once; outer silhouette remains fixed",
    "loop": "frame 15 flows naturally into frame 0 without a duplicated endpoint or pause"
  },
  "background": "true alpha transparency outside and inside the ring; binary alpha, no soft bloom",
  "rules": [
    "exactly sixteen equally sized sequential animation frames",
    "same object, camera, palette, and anchor in every frame",
    "keep every frame inside its specified cell",
    "no text, frame numbers, grid lines, borders, checkerboard, shadows, perspective, or mockup"
  ]
}
```

For opaque lava, water, or machinery, change the background to opaque and describe complete edge-to-edge surface coverage. If tiling matters, require corresponding opposite edges to agree in each frame. Temporal looping and spatial tiling are separate constraints.

For high-resolution painted art, remove the block-texel style and use per-frame Lanczos resizing. For glow or smoke, preserve partial alpha and inspect it over both light and dark backgrounds.

## Diagnose Before Retrying

- Correct canvas but wrong grid: measure the real cells. Use explicit rectangles only when complete, equally sized frames can be recovered without moving anchors. Otherwise revise through the required image skill.
- Fixed grid but subject drifts: correct the frame registration in the artwork. Do not auto-trim each frame to a different opaque bounding box.
- Several independent designs instead of a sequence: strengthen the phase descriptions and shared identity constraints, optionally using an approved frame/reference via the dependency's edit workflow.
- Loop pops: inspect last/first and adjacent differences. Repair the transition rather than appending an identical first frame to hide the discontinuity.
- Multiple batches: specify global frame indices/phases and reuse the approved reference/anchor/palette. Inspect boundaries between batches as well as the final loop seam. Use an explicit assembly list; lexical filename order can place frame 10 before frame 2.
