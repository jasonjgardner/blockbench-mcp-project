---
name: blockbench-texturing
description: Create and paint textures in Blockbench using MCP tools. Use when creating textures, painting on models, using brush tools, filling colors, drawing shapes, applying gradients, managing texture layers, or working with UV mapping. Covers pixel art texturing, procedural painting, and UV manipulation.
---

# Blockbench Texturing

Create and paint textures for 3D models using Blockbench MCP tools.

## Available Tools

### Texture Management
| Tool | Purpose |
|------|---------|
| `create_texture` | Create new texture with size and fill color |
| `list_textures` | List all project textures |
| `get_texture` | Get texture image data |
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
  fill_mode="color_connected", tolerance=10
```

### Fill Entire Face

```
paint_fill_tool: texture_id="skin", x=0, y=0, color="#228B22",
  fill_mode="face"
```

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
  layer_name="details", opacity=75
```

### Merge Down

```
texture_layer_management: texture_id="skin", action="merge_down",
  layer_name="details"
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

### Auto UV for Mesh

```
select_mesh_elements: mesh_id="ball", mode="face"  # Select the intended faces
auto_uv_mesh: mesh_id="ball", mode="project"  # project, unwrap, cylinder, sphere
```

`project` uses the active preview camera; `unwrap` creates an independent planar mapping per face and does not pack UV islands. Pass explicit returned face keys in `faces` to target only part of a mesh.

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

### Skin Texture

```
# Create texture
create_texture: name="player_skin", width=64, height=64, fill_color="#C4A484", layer_name="base"

# Base colors
paint_fill_tool: x=8, y=8, color="#C4A484", fill_mode="face"  # Face
paint_fill_tool: x=20, y=20, color="#3366CC", fill_mode="face"  # Body

# Details with brush
paint_with_brush: coordinates=[{x: 10, y: 10}, {x: 12, y: 10}],
  brush_settings={color: "#000000", size: 1}  # Eyes

# Apply
apply_texture: id="head", texture="player_skin"
```

### Procedural Pattern

```
# Create base
create_texture: name="pattern", width=32, height=32, fill_color="#FFFFFF", layer_name="base"

# Draw grid
draw_shape_tool: shape="rectangle_h", start={x: 0, y: 0}, end={x: 32, y: 32},
  color="#CCCCCC", line_width=1
draw_shape_tool: shape="rectangle_h", start={x: 8, y: 8}, end={x: 24, y: 24},
  color="#999999", line_width=1
```

## Tips

- Use `pixel_perfect=true` in paint_settings for clean pixel art
- Enable `mirror_painting` for symmetrical textures
- Use layers for non-destructive editing
- `lock_alpha` prevents painting outside existing pixels
- Use `fill_mode="color_connected"` to fill only touching same-color pixels
- Create brush presets for frequently used settings
