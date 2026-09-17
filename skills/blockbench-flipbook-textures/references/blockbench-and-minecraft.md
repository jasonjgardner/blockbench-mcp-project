# Blockbench and Minecraft Delivery

Read for preview/import and target-specific metadata. The examples use sixteen square 32×32 frames, stored in a 32×512 PNG, at 2 ticks/frame (10 FPS, 1.6 seconds per cycle).

## Blockbench

Discover the running format and tools with `get_capabilities: include_tools=true`. The format must support `animated_textures` for native flipbook preview. A capability value of `null` is unknown. Preserve the user's project; if it cannot preview flipbooks, deliver the PNG/preview and explain that limitation without silently converting the project.

Inspect the existing one-frame UV size before importing. For a new tile, 32×32 logical units may be suitable; an existing Java block may already use 16×16 logical units for a 32×32 pixel texture. Both are square and can represent the same frame, but changing established UV units can alter mappings. In general `U/V` must match `W/H`.

For a compatible format with `per_texture_uv_size=true`, import using the measured values:

```text
create_texture: name="portal", data="<absolute path to portal.png>", uv_width=16, uv_height=16
activate_texture: texture="<new texture UUID>"
apply_texture: id="<intended element/group UUID>", texture="<new texture UUID>", applyTo="all"
list_textures
```

Discover the live schemas for exact argument names. For formats without per-texture UV sizing, omit `uv_width`/`uv_height` and inspect the project's one-frame UV dimensions. Changes to project UV size can affect other textures. Imported PNG dimensions come from the file; passing bitmap width/height does not define the animation timing.

Blockbench calculates frame count from the bitmap aspect ratio and logical one-frame UV ratio. Verify `bitmap_size=[32,512]`, `frame_size=[32,32]`, and the original `uv_size`. Do not rely on automatic tall-image detection, especially for a two-frame texture or rectangular frames. A stretched preview often means the logical UV height was set to the entire strip.

Use the selected texture's native Properties dialog for timing. Formats with `texture_mcmeta` expose `frame_time` (ticks), `frame_interpolate`, `frame_order_type`, and `frame_order`; other animated formats expose `fps`. Current Blockbench includes the `animated_texture_editor` action and `animated_textures` playback action. Discover/inspect availability before calling `trigger_action`; open editors with `confirmDialog=false` and inspect the actual dialog before filling it. Do not assume `animated_texture_editor` exists for an unsupported format or blindly confirm its defaults. A native UI step is appropriate when no dedicated tool exposes a setting; follow the orchestrator's existing rules for `risky_eval`.

Check several frames on the intended surface and play the loop. An APNG preview validates the image sequence; it does not verify the model UVs, editor speed, or Minecraft resource-pack wiring.

Implementation references: [texture frame count and metadata](https://github.com/JannisX11/blockbench/blob/master/js/texturing/textures.js), [native flipbook editor and playback](https://github.com/JannisX11/blockbench/blob/master/js/texturing/texture_flipbook.js). Names/behavior were checked against local Blockbench source on 2026-09-16; the connected host remains authoritative.

## Minecraft Java Resource Pack

Put the static PNG at its referenced texture path, such as `assets/example/textures/block/portal.png`. Place **`portal.png.mcmeta`** beside it:

```json
{
  "animation": {
    "width": 32,
    "height": 32,
    "frametime": 2,
    "interpolate": false,
    "frames": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  }
}
```

Metadata width/height are **frame pixels**, not logical UV units or total strip dimensions. Explicit dimensions also disambiguate rectangular frames. Java can describe other sheet layouts, but this workflow uses a vertical strip for Blockbench compatibility. `frames` can be omitted for sequential playback. Keep it explicit for nonsequential schedules; a per-frame duration uses an object such as `{"index": 3, "time": 4}`. All indices must address the final strip, and times must be positive integer ticks. Preserve unrelated keys if updating existing `.mcmeta`.

Interpolation blends frames; leave it off for crisp pixel art unless requested. Metadata alone does not animate every Java entity renderer: verify support for the actual texture consumer. Standard animation metadata repeats continuously and does not provide a one-shot flag.

Blockbench's [metadata serializer](https://github.com/JannisX11/blockbench/blob/master/js/texturing/textures.js) is a useful reference for its exported fields. Verify the saved sidecar after native export; its presence and dimensions must match the delivered PNG.

## Minecraft Bedrock Block Resource Pack

Use square frames for ordinary block flipbooks. Save `textures/blocks/portal.png`. Merge this entry into the resource pack's **`textures/flipbook_textures.json`** array:

```json
[
  {
    "flipbook_texture": "textures/blocks/portal",
    "atlas_tile": "portal",
    "ticks_per_frame": 2,
    "frames": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    "blend_frames": false
  }
]
```

`flipbook_texture` is relative to the resource-pack root, uses forward slashes, and omits `.png`. `atlas_tile` identifies the appropriate `texture_data` key in `textures/terrain_texture.json`. For a new custom block tile, merge a binding shaped like:

```json
{
  "resource_pack_name": "example",
  "texture_name": "atlas.terrain",
  "texture_data": {
    "portal": {"textures": "textures/blocks/portal"}
  }
}
```

Preserve existing pack identifiers, array entries, and texture bindings. Match the block's material-instance texture alias to `portal` through [Bedrock material bindings](../../blockbench-use/references/bedrock-material-instances.md). Avoid duplicate/conflicting entries for the same tile. Keep `frames` aligned with the **converted** strip; omit it for sequential playback if appropriate. A PNG alone does not establish animated resource-pack behavior.

The [official animation tutorial](https://learn.microsoft.com/en-us/minecraft/creator/documents/createanimatedblocktexture?view=minecraft-bedrock-stable) explains the frame/tick behavior. For the actual plural filename and current examples, use [Mojang's sample flipbook file](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/flipbook_textures.json) and [terrain atlas](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/terrain_texture.json); the tutorial contains inconsistent singular filenames.

## Bedrock Entities and Other Targets

Bedrock block `flipbook_textures.json` does not replace entity render-controller wiring. Entity UV animation needs a supporting material/render controller and frame-dependent UV scaling/offset; Blockbench's native editor provides a target-specific code suggestion. Follow the intended entity setup instead of adding block atlas metadata. Other engines have their own animation consumers; preserve their timing/UV requirements and explicitly identify any remaining integration work.

For a PBR flipbook, keep the same dimensions, frame order, and timing across color/normal/height/MER channels. Derive maps frame by frame, preserve temporal consistency, and verify that the destination actually animates those channels before claiming support.
