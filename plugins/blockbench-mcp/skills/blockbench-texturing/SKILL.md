---
name: blockbench-texturing
description: Create and paint textures in Blockbench using MCP tools. Use when creating textures, painting on models, using brush tools, filling colors, drawing shapes, applying gradients, managing texture layers, or working with UV mapping. Covers pixel art texturing, procedural painting, and UV manipulation.
license: Apache-2.0
---

# Blockbench Texturing

Before creating, changing, or exporting project content, read [Blockbench use](../blockbench-use/SKILL.md). Tool names below are semantic short names: discover and call the actual Blockbench MCP tools exposed by the current client, whose server or plugin prefixes may differ.

Create and paint textures for 3D models using Blockbench MCP tools.

When the model should use Minecraft's own textures ("vanilla" or "default" textures, or a named block such as bricks or oak planks), use [vanilla textures](../blockbench-vanilla-textures/SKILL.md). It downloads Mojang's originals from the CDN before any painting or generation.

For animated texture sheets, use [flipbook textures](../blockbench-flipbook-textures/SKILL.md): generate artwork through the GPT Image 2.5 texture skill, convert measured sprite cells to a vertical strip, and configure one-frame UV dimensions and playback metadata.

## Plan UVs Before Texture Detail

Carry forward the user's [appearance/performance preference](../blockbench-use/references/appearance-and-performance.md). For performance or balanced designs, allocate shared UV tiles for repeated braces/infills, seat ribs, seams, and mounting details before adding geometry. Paint small fasteners onto existing supporting faces; add aligned [PBR maps](../blockbench-pbr-materials/SKILL.md) when the target supports them. Reusing UVs alone does not reduce the geometry already present.

Fix texel density before sizing textures. Choose between tiled faces and a unique atlas; for low-poly glTF, collapse face UVs onto a palette atlas. Confirm whether the target accepts non-square or non-power-of-two images: Minecraft does not, while Hytale and Babylon.js do. Minecraft face UVs do not wrap, so repeat a tile by splitting faces. See [real-time asset planning](../blockbench-use/references/real-time-asset-planning.md) sections 7–9.

Inspect the target's box/per-face UV mode and effective UV dimensions before painting. UV units can differ from image pixels; formats with `per_texture_uv_size` use each face's texture dimensions. Preserve deliberate mirrored/repeated UV overlaps, and allocate unique space for asymmetric detail. Preview a checker or directional mark for stretching, orientation and seams. Match pixel density to the user's style and viewing distance; Minecraft pixel-art rules do not apply to every format. See [format and delivery guidance](../blockbench-use/references/formats-and-delivery.md).

Blockbench's native texture-template workflow can lay out UVs, but `create_texture` creates/imports an image and does not generate that layout. `auto_uv_mesh` maps faces and does not pack islands. For packed layouts, use a tool actually advertised by the running bundle or the native template/UV workflow; preserve an existing painted atlas before rearranging it.

### Preserve UV Proportions and Material Scale

Read [UV scale and distortion guidance](references/uv-scale-and-distortion.md) before applying detailed materials, sharing swatches across different face sizes, or correcting stretched textures. Compute sampled image pixels per model unit along both face directions using the effective texture's frame and logical UV sizes. A shared material normally needs proportionate UV footprints, not the same full rectangle on every face.

Check both local stretching and scale differences between parts with a reversible checker, then inspect the actual grain/pattern. Prefer proportionate subregions, appropriate trim strips, or verified target-supported tiling. A bounded UV rectangle or larger image does not prove correct scale. Keep deliberate stretching for uniform materials or designed effects; a plain albedo with detailed PBR channels still needs the scale check.

### Replace Repeated Geometry with a UV Tile

Use a small number of format-supported panels for repeated rail infills or X braces when the chosen viewing distance tolerates flat detail. Map the pattern onto those panels and keep the holes transparent. Reserve opaque regions for solid surfaces and pad atlas islands without filling intentional holes. Check edge-on views, both sides, filtering/mipmaps, and distant views for disappearing bars, halos, or texture bleed before removing the replaced geometry. Test transparent layers for overdraw; one cutout panel per bar defeats the reduction.

Choose the target's alpha-test/culling behavior explicitly; double-sided rendering and translucent blending have costs. Multiple textures are permitted when the format supports them, but importing images does not complete runtime material wiring. For Bedrock custom blocks, follow [material-instance and texture delivery](../blockbench-use/references/bedrock-material-instances.md); entity bindings use a different workflow.

### Generate a Native Texture Template

For a new atlas, enter a supported Edit mode and establish the intended outliner selection, then open the native action without accepting its defaults:

```
trigger_action: action="create_texture", confirmDialog=false
```

Inspect the returned app screenshot/dialog before using `fill_dialog`. The current native dialog commonly has `name`, `type="template"`, `resolution` (pixel density), `rearrange_uv`, `double_use` (reuse matching faces), `power`, and `padding`. Send only fields present in that host's dialog. Example after inspecting its defaults:

```
fill_dialog: values="{\"name\":\"atlas\",\"type\":\"template\",\"rearrange_uv\":true}", confirm=true
```

Choose density, overlap reuse and padding for the target; the template's `resolution` is not a requested final atlas width. An empty outliner selection may select the whole model, and single-texture formats can process all eligible visible elements even with a partial selection. Check the operation's scope before confirming, especially on painted content. Generation may continue asynchronously: verify `list_textures`, actual UVs and `get_texture` after completion before painting. `fill_dialog: confirm=false` cancels the dialog; it is not a way to fill fields and leave it open. See the [native texture generator](https://github.com/JannisX11/blockbench/blob/master/js/texturing/texture_generator.js) and [official template workflow](https://blockbench.net/wiki/guides/bedrock-modeling/).

Paint coordinates are image pixels. Pass an explicit `texture_id` to each paint tool when more than one texture exists. Layers and selections affect native painting; inspect the selected layer and existing selection before painting. `layer_name` names a new/renamed layer; for most layer actions the tool operates on the currently selected layer rather than resolving an arbitrary layer by name.

## Available Tools

### Texture Management
| Tool | Purpose |
|------|---------|
| `create_texture` | Create new texture with size and fill color |
| `list_textures` | List all project textures |
| `get_texture` | Get texture image data |
| `activate_texture` | Select an existing texture |
| `apply_texture` | Apply texture to element |

### Paint Tools
| Tool | Purpose |
|------|---------|
| `paint_with_brush` | Paint with customizable brush |
| `paint_fill_tool` | Bucket fill areas |
| `draw_shape_tool` | Draw rectangles/ellipses |
| `gradient_tool` | Apply gradients |
| `eraser_tool` | Erase with brush settings |
| `color_picker_tool` | Pick colors from texture |
| `copy_brush_tool` | Clone/copy texture areas |

### Brush Management
| Tool | Purpose |
|------|---------|
| `create_brush_preset` | Save brush settings |
| `load_brush_preset` | Load saved brush |
| `paint_settings` | Configure paint mode |

### Layers & Selection
| Tool | Purpose |
|------|---------|
| `texture_layer_management` | Manage texture layers |
| `texture_selection` | Create/modify selections |

### UV Tools
| Tool | Purpose |
|------|---------|
| `set_mesh_uv` | Set UV coordinates |
| `auto_uv_mesh` | Auto-generate UVs |
| `rotate_mesh_uv` | Rotate UV mapping |
| `get_mesh_info` | Read mesh face/vertex keys and existing UVs with `include_uv=true` |
| `get_cube_uv` | Inspect box/per-face UVs, effective face texture, UV dimensions and bitmap dimensions |
| `set_cube_uv` | Edit box offset/mirroring or per-face rectangles, rotations and texture references |

## Resources

| Resource | URI | Purpose |
|----------|-----|---------|
| textures | `textures://{id}` | List/read texture info |

## Creating Textures

### New Blank Texture

```
create_texture: name="skin", width=64, height=64, fill_color="#808080", layer_name="base"
```

### Texture with Transparency

```
create_texture: name="overlay", width=32, height=32, fill_color=[0, 0, 0, 0], layer_name="base"
```

### Separate UV Dimensions from Bitmap Resolution

In a format with `per_texture_uv_size=true`, `create_texture` accepts `uv_width` and `uv_height` together as positive numbers. Omit both to preserve the native defaults. The pair also works when importing image `data`; it sets logical UV dimensions after image decoding without resizing the bitmap.

```
# For an intended Generic Model with per_texture_uv_size=true
create_texture: name="paint_detail", width=128, height=64,
  uv_width=32, uv_height=16, fill_color="#808080", layer_name="base"
list_textures
# Inspect uv_size=[32,16], bitmap_size=[128,64], frame_size=[128,64]
```

This static image has four pixels per UV unit on each axis. Multiple textures can have different UV sizes in the same project, so use the face's effective texture dimensions for mapping. `list_textures` exposes `uv_size`, `bitmap_size`, and `frame_size` in the current bundle. Formats with project-wide UV dimensions reject per-texture overrides; inspect and edit the native project UV-size settings instead. Changing logical dimensions can change existing mapping, so preserve the intended pixel density and verify the result.

### Apply to Element

`create_texture` requires `layer_name` whenever `fill_color` is supplied. Texture lookups accept a name or UUID; use the UUID from `list_textures` when names are ambiguous.

```
apply_texture: id="body", texture="skin", applyTo="all"
```

## Painting

### Basic Brush Stroke

```
paint_with_brush: texture_id="skin", coordinates=[
  {x: 10, y: 10},
  {x: 15, y: 12},
  {x: 20, y: 10}
], brush_settings={color: "#FF0000", size: 3, shape: "circle"}
```

### Soft Brush

```
paint_with_brush: texture_id="skin", coordinates=[{x: 32, y: 32}],
  brush_settings={color: "#FFFFFF", size: 10, softness: 50, opacity: 128}
```

### Fill Area

```
paint_fill_tool: texture_id="skin", x=16, y=16, color="#3366FF",
  fill_mode="color_connected", tolerance=0
```

The native fill API supports exact color matching only; nonzero `tolerance` is rejected.

Face/element fill modes depend on native geometry/UV context. Texture-pixel coordinates alone do not identify a model face. Use explicit rectangular painting for a known UV rectangle, or establish and verify the native target context before face filling. Inspect the result; a success message alone does not prove that only the intended face changed.

## Shapes & Gradients

### Draw Rectangle

```
draw_shape_tool: texture_id="skin", shape="rectangle",
  start={x: 0, y: 0}, end={x: 16, y: 16}, color="#FFCC00"
```

### Draw Hollow Ellipse

```
draw_shape_tool: texture_id="skin", shape="ellipse_h",
  start={x: 8, y: 8}, end={x: 24, y: 24}, color="#000000", line_width=2
```

### Apply Gradient

```
gradient_tool: texture_id="skin",
  start={x: 0, y: 0}, end={x: 0, y: 32},
  start_color="#87CEEB", end_color="#1E90FF"
```

## Erasing

```
eraser_tool: texture_id="skin", coordinates=[{x: 10, y: 10}, {x: 12, y: 12}],
  brush_size=5, shape="circle", opacity=255
```

## Color Picking

```
color_picker_tool: texture_id="skin", x=16, y=16
# Returns picked color, sets as active
```

## Clone/Copy Brush

```
copy_brush_tool: texture_id="skin",
  source={x: 0, y: 0}, target={x: 32, y: 0},
  brush_size=8, mode="copy"
```

## Brush Presets

### Create Preset

```
create_brush_preset: name="soft_round", size=8, shape="circle",
  softness=30, opacity=200, color="#FFFFFF"
```

### Load Preset

```
load_brush_preset: preset_name="soft_round"
```

## Texture Layers

### Create Layer

```
texture_layer_management: texture_id="skin", action="create_layer",
  layer_name="details"
```

### Set Layer Opacity

```
texture_layer_management: texture_id="skin", action="set_opacity",
  opacity=75  # Operates on the selected layer; layer opacity is 0–100 percent
```

### Merge Down

```
texture_layer_management: texture_id="skin", action="merge_down"  # Selected layer
```

## Selections

### Rectangle Selection

```
texture_selection: texture_id="skin", action="select_rectangle",
  coordinates={x1: 0, y1: 0, x2: 16, y2: 16}
```

### Add to Selection

```
texture_selection: texture_id="skin", action="select_ellipse",
  coordinates={x1: 8, y1: 8, x2: 24, y2: 24}, mode="add"
```

### Invert Selection

```
texture_selection: texture_id="skin", action="invert_selection"
```

### Feather Edges

```
texture_selection: texture_id="skin", action="feather_selection", radius=2
```

## UV Mapping

### Cube UVs

Confirm `get_cube_uv` and `set_cube_uv` are advertised by `get_capabilities: include_tools=true`; older loaded bundles need reloading before these tools are available. Use a cube's actual UUID as `id` when a group has the same name.

```
get_cube_uv: id="body_geo"
# → {uuid, name, box_uv, autouv, uv_offset, mirror_uv, faces}
# Each face: uv, rotation, texture, texture_status, effective_texture, uv_size, bitmap_size, frame_size

# Move the atlas origin of an existing box-UV cube
set_cube_uv: id="body_geo", uv_offset=[16, 8], mirror_uv=false

# In an existing per-face-UV cube, edit one rectangle (UV units)
set_cube_uv: id="panel_geo", faces={north: {uv: [0, 0, 8, 4]}}
```

Choose the example matching the cube's inspected mode; box offsets and face rectangles are different workflows. Changing modes requires an explicit `box_uv` argument and a format that permits it; native conversion can reset rotations and enable disabled faces. The tool verifies that conversion succeeded and rolls back a refused conversion. Nonzero face rotations require the format's `uv_rotation` support. Explicit rectangles normally disable automatic remapping; Hytale preserves `autouv=1` and requires rectangle extents to match the absolute base face dimensions, swapping width/height for 90/270-degree UV rotation. Matching offsets and mirrors are allowed, while changed extents are rejected before Undo. Hytale quads cannot use box UV. See the [Hytale native UV behavior](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/element.ts).

Per-face `texture` accepts an existing texture name/UUID, `false` for unassigned, or `null` to disable the face. Single-texture and per-group-texture formats restrict per-face assignments; use their existing global/group workflow. Hytale resolves textures through an attachment collection or the project default even when `single_texture=false`; the tool rejects non-null per-face assignments there. Reinspect after edits, including `effective_texture`, `uv_size`, `bitmap_size`, and `frame_size`. Convert UVs to pixels within a frame using `frame_size / uv_size` on each axis; `bitmap_size` includes the entire animated atlas. For a frame 64 pixels across 16 UV units, a UV coordinate of 4 is frame X=16.

### Auto UV for Mesh

```
select_mesh_elements: mesh_id="ball", mode="face"  # Select the intended faces
auto_uv_mesh: mesh_id="ball", mode="project"  # project, unwrap, cylinder, sphere
```

`project` uses the active preview camera; `unwrap` creates an independent planar mapping per face and does not pack UV islands. `cylinder` and `sphere` use the mesh-local origin and each mapped face's effective UV dimensions, so inspect texture assignments first. Pass explicit returned face keys in `faces` to target only part of a mesh.

### Set Custom UV

Mesh face and vertex keys are generated at runtime; cube direction names are not mesh face IDs. Retain the `meshes[]` entry returned by `place_mesh` as shown in [the modeling skill](../blockbench-modeling/SKILL.md), or inspect an existing mesh using `get_mesh_info` with `include_uv=true`.

This client orchestration example continues with the quad `panel` created in the modeling skill. `call` invokes the named MCP tool, checks `isError`, and decodes JSON results; variable expressions must be bound to actual returned values before sending tool arguments.

```js
const uvCorners = [[0, 0], [16, 0], [16, 16], [0, 16]];
await call("set_mesh_uv", {
  mesh_id: panel.uuid,
  face_key: panel.face_keys[0],
  uv_mapping: Object.fromEntries(panel.vertex_keys.map((key, index) => [key, uvCorners[index]])),
});
```

UV values use Blockbench texture units, not normalized 0–1 coordinates. For existing faces, use `faces.items[].key` and that face's `vertices` perimeter order from inspection; key the UV map with those exact vertex IDs. Read each page using its independent `next_offset` until `null`, without geometry edits between pages. See the modeling skill's `readMeshPages` helper; add `include_uv: true` when reading existing UVs. Reinspect after topology changes.

### Rotate UV

```js
await call("rotate_mesh_uv", {mesh_id: panel.uuid, angle: "90", faces: [panel.face_keys[0]]});
```

## Paint Settings

```
paint_settings: pixel_perfect=true, mirror_painting={enabled: true, axis: ["x"]},
  lock_alpha=true
```

## Common Workflows

### Paint an Existing Skin Layout

Use the target skin's actual UV template. The following coordinates are only examples for regions already confirmed in that template; a blank image and these strokes do not construct a valid player skin automatically.

```
# Create texture
create_texture: name="player_skin", width=64, height=64, fill_color="#C4A484", layer_name="base"

# Base colors
draw_shape_tool: texture_id="player_skin", shape="rectangle",
  start={x: 20, y: 20}, end={x: 27, y: 31}, color="#3366CC"

# Details with brush
paint_with_brush: texture_id="player_skin", coordinates=[{x: 10, y: 10}, {x: 12, y: 10}],
  brush_settings={color: "#000000", size: 1}, connect_strokes=false  # Separate eye pixels

# Apply
apply_texture: id="head", texture="player_skin"
```

### Procedural Pattern

```
# Create base
create_texture: name="pattern", width=32, height=32, fill_color="#FFFFFF", layer_name="base"

# Draw grid
draw_shape_tool: texture_id="pattern", shape="rectangle_h", start={x: 0, y: 0}, end={x: 31, y: 31},
  color="#CCCCCC", line_width=1
draw_shape_tool: texture_id="pattern", shape="rectangle_h", start={x: 8, y: 8}, end={x: 24, y: 24},
  color="#999999", line_width=1
```

## Tips

- Use `pixel_perfect=true` in paint_settings for clean pixel art
- Enable `mirror_painting` only after confirming the intended symmetry and native target context; disable it for asymmetric detail
- Use layers for non-destructive editing
- `lock_alpha` prevents painting outside existing pixels
- Use `fill_mode="color_connected"` to fill only touching same-color pixels
- Create brush presets for frequently used settings
- `paint_with_brush` connects points by default; set `connect_strokes=false` for separate stamps such as eyes or spots
- Inspect both `get_texture` and the rendered model after meaningful paint changes. For tiling blocks, check a repeated arrangement early; for animated assets, inspect surfaces revealed by poses. These practices follow the [Minecraft style guide](https://blockbench.net/wiki/guides/minecraft-style-guide/) and [Bedrock texturing guide](https://blockbench.net/wiki/guides/bedrock-modeling/).
