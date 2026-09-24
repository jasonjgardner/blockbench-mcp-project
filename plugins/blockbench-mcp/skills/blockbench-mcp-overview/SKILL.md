---
name: blockbench-mcp-overview
description: Overview of the Blockbench MCP server tools, resources, and prompts. Use to understand the full MCP capability set, learn how tools work together, or when starting a new Blockbench project. Covers all domains (modeling, animation, texturing, PBR, particles, UI, camera) and their MCP interfaces, for both the desktop server and the headless .bbmodel server.
license: Apache-2.0
---

# Blockbench MCP Overview

Before creating, changing, or exporting project content, read [Blockbench use](../blockbench-use/SKILL.md). Tool names below are semantic short names: discover and call the actual Blockbench MCP tools exposed by the current client, whose server or plugin prefixes may differ.

Complete guide to the Blockbench MCP server for AI-assisted 3D modeling.

## What is Blockbench MCP?

An MCP server that exposes Blockbench functionality to AI agents through:
- **Tools**: Actions that create, modify, or query the 3D model
- **Resources**: Read-only data endpoints for model information
- **Prompts**: Reusable guidance for specific workflows

## Two servers

| Server | Registered as | Works on | Tools |
|---|---|---|---|
| Desktop | `blockbench` (`http://localhost:3000/bb-mcp`) | The project open in the Blockbench app | Everything in the categories below |
| Headless | `blockbench-headless` (stdio, `npx`) | `.bbmodel` files in a `--root` folder, no app needed | `bbmodel_*` and `blockbench_launch`; see [Blockbench headless](../blockbench-headless/SKILL.md) |

Use desktop for the user's live model and interactive work; use headless for file-based, parallel, or app-less work such as validation, rendering, and export. Either server may be missing in a session: check which tools the client exposes before planning.

## Tool Categories

| Domain | Tools | Purpose |
|--------|-------|---------|
| Discovery | `get_capabilities` | Host/plugin versions, active project, registered formats/features, enabled tools |
| Inspection | `get_mesh_info` | Paginated runtime geometry keys, local positions/normals, selection, texture references, optional UVs |
| Animation | 7 | Keyframes, rigs, curves, timeline |
| Camera | 3 | Screenshots, camera control |
| Cubes | 2 | Cube creation and modification |
| Elements | 8 | Groups, outliner, duplication, selection/filtering |
| Export | 2 | Compile and save models via codecs |
| History | 4 | Undo, redo, checkpoint, inspect stack |
| Import | 1 | GeoJSON import |
| Mesh | 11 | Spheres, cylinders, extrusion, vertices |
| Paint | 12 | Brushes, fill, shapes, layers |
| Particles | 6 | Bedrock particle effects: `list_particle_presets`, `create_particle_effect`, `update_particle_effect`, `list_particle_effects`, `manage_particle_keyframes`, `export_particle_pack` |
| Texture | 13 | Textures, PBR materials |
| UI | 4 | Actions, evaluation, dialogs |
| UV | 3 | UV mapping |
| Hytale | 12 | Hytale-specific (requires plugin) |

## Resources

| Resource | URI Pattern | Data |
|----------|-------------|------|
| projects | `projects://{id}` | Project info, formats |
| textures | `textures://{id}` | Texture metadata |
| nodes | `nodes://{id}` | 3D node data |
| hytale-format | `hytale://format` | Hytale format info |
| hytale-attachments | `hytale://attachments/{id}` | Attachment collections |
| hytale-pieces | `hytale://pieces/{id}` | Attachment pieces |
| hytale-cubes | `hytale://cubes/{id}` | Hytale cube properties |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `blockbench_native_apis` | Blockbench v5.0 API security guide |
| `blockbench_code_eval_safety` | Safe code evaluation patterns |
| `model_creation_strategy` | Model creation guidance |
| `hytale_model_creation` | Hytale modeling guide |
| `hytale_animation_workflow` | Hytale animation guide |
| `hytale_attachments` | Hytale attachments guide |

## Quick Start Workflows

### Discover Formats and Tools

```
get_capabilities: include_tools=true
# → {blockbench, plugin, project, format, formats, tools, notes}
```

`project` is `null` when no project is open. Pick exact IDs from `formats`; `get_capabilities: format_id="free"` inspects Generic Model without switching projects. Mesh creation requires `format.features.meshes=true`. A display name is not a format ID: use `free`, not `generic`, for the built-in Generic Model. Cube-oriented `modded_entity` and `optifine_entity` do not imply mesh support. Detailed feature values can be `null` (unknown); an enabled tool can still need a compatible format, mode, and selection.

### Create a Simple Model

```
# 1. Discover first; use "bedrock" only if it is registered for the requested target
get_capabilities
create_project: name="my_model", format="bedrock"

# 2. Create texture
create_texture: name="skin", width=64, height=64

# 3. Add bone structure
add_group: name="root", origin=[0, 0, 0]
add_group: name="body", parent="root", origin=[0, 12, 0]

# 4. Add geometry
place_cube: elements=[{name: "torso", from: [-4, 12, -2], to: [4, 24, 2]}], group="body"

# 5. Apply texture
apply_texture: id="torso", texture="skin"

# 6. View result
capture_screenshot
```

### Create and Animate

```
# 1. Build model (see above)

# 2. Create animation
create_animation: name="idle", animation_length=2.0, loop=true

# 3. Add keyframes
manage_keyframes: bone_name="body", channel="rotation",
  keyframes=[
    {time: 0, values: [0, 0, 0]},
    {time: 1.0, values: [0, 5, 0]},
    {time: 2.0, values: [0, 0, 0]}
  ]

# 4. Play animation
animation_timeline: action="play"
```

### Paint a Texture

```
# 1. Create texture
create_texture: name="block", width=16, height=16, fill_color="#8B4513", layer_name="base"

# 2. Add details
draw_shape_tool: shape="rectangle", start={x: 2, y: 2}, end={x: 14, y: 14}, color="#A0522D"
paint_with_brush: coordinates=[{x: 8, y: 8}], brush_settings={color: "#654321", size: 2}

# 3. View texture
get_texture: texture="block"
```

## Tool Patterns

### Information Gathering

```
list_outline                   # View model hierarchy
get_capabilities               # Discover active project, format features, host, and tools
get_mesh_info: mesh_id="panel", include_uv=true  # Inspect a specific mesh without selecting it
list_textures                  # View textures
list_materials                 # View PBR materials
list_export_formats            # View available export codecs
get_undo_stack                 # Inspect undo history
find_elements_by_criteria      # Search model by name, type, size, parent
filter_by_material             # Find elements referencing a texture
hytale_get_format_info         # View Hytale format (if active)
```

### Modification Pattern

Most modification tools follow:
1. Identify target by ID or name
2. Specify changes
3. Changes are recorded for undo

`place_mesh` returns JSON `{meshes: [{name, uuid, vertex_keys, face_keys}]}`. Bind subsequent mesh IDs to the returned UUID and component IDs to these arrays, which follow input order. For primitives and existing meshes, read `get_mesh_info`: vertices appear in `vertices.items` as `{key, position, selected}`, faces in `faces.items` as `{key, vertices, normal, selected, texture, uv?}`. Each list is independently paginated by `next_offset` (default 100, maximum 500 items). Read to `null` before editing; reinspect after topology changes. Vertex coordinates and normals are mesh-local. See [modeling](../blockbench-modeling/SKILL.md) and [texturing](../blockbench-texturing/SKILL.md) for followable examples that bind returned keys.

### Screenshot Workflow

```
set_camera_angle: position=[0, 20, 50], rotation=[0, 0, 0], projection="perspective"
capture_screenshot      # 3D view only
capture_app_screenshot  # Entire Blockbench window
```

### Evaluation (Advanced)

```
risky_eval: code="Cube.all.length"  # Query Blockbench directly
undo: steps=1                      # Use dedicated history tools for undo/redo
```

`risky_eval` does not open an undo transaction automatically. A script that directly mutates the project must manage the appropriate host undo aspects and failure handling itself; prefer dedicated tools for supported edits. A checkpoint marks history but does not make unrecorded script changes undoable.

### Undo & Checkpoints

Use history tools to branch, recover, and mark progress in multi-step agent workflows. Prefer `undo`/`redo` over `trigger_action: action="undo"`.

```
# Mark a state before risky work
save_checkpoint: name="before_arm_rework"

# Make changes...
modify_cube: id="arm_left", rotation=[0, 45, 0]
duplicate_element: id="arm_left", newName="arm_right", offset=[-8, 0, 0]

# Didn't like the result - roll back 2 steps
undo: steps=2

# Inspect what's in the stack
get_undo_stack: limit=10
# → { index, total, can_undo, can_redo, entries: [...] }
```

The checkpoint appears in `get_undo_stack` as `[checkpoint] before_arm_rework`, so an agent can count entries between the current index and the checkpoint to know how many times to call `undo`.

### Export

Export the current project through any registered Blockbench codec. Content is returned in the response; optionally written to disk.

```
# Discover codecs (filter to current format's compatible codecs)
list_export_formats: only_current_format=true

# Compile and return content (default path: none, content returned)
export_model: codec_id="obj"

# Compile, write to disk (requires Blockbench v5.0+ fs permission prompt)
export_model: codec_id="gltf", path="C:/models/character.gltf"

# Large files: skip content in response, only write
export_model: codec_id="project", path="C:/models/save.bbmodel", max_content_length=0
```

Content is truncated at `max_content_length` characters (default 100,000) to protect the MCP context window. Use `byte_length` in the response to see the real size.

## Domain Integration

### Model + Texture

```
# Create model
place_cube: elements=[{name: "block", from: [0,0,0], to: [16,16,16]}]

# Create texture
create_texture: name="block_tex", width=16, height=16

# Paint texture
paint_fill_tool: texture_id="block_tex", x=0, y=0, color="#00FF00", fill_mode="element"

# Apply
apply_texture: id="block", texture="block_tex"
```

### Model + Animation

```
# Create bone hierarchy (important for animation)
add_group: name="root", origin=[0, 0, 0]
add_group: name="arm", parent="root", origin=[4, 12, 0]

# Add geometry to bones
place_cube: elements=[{name: "arm_geo", from: [0, 0, -1], to: [2, 10, 1]}], group="arm"

# Animate the bone
create_animation: name="wave", animation_length=1.0
manage_keyframes: bone_name="arm", channel="rotation",
  keyframes=[{time: 0, values: [0, 0, 0]}, {time: 0.5, values: [0, 0, 90]}]
```

### PBR Material Workflow

```
# Create textures for each channel
create_texture: name="stone_color", width=16, height=16
create_texture: name="stone_normal", width=16, height=16, fill_color="#8080FF", layer_name="base"

# Create material with uniform MER [metalness, emissive, roughness] in 0–255 units
create_pbr_material: name="stone", color_texture="stone_color",
  normal_texture="stone_normal", mer_value=[0, 0, 230]

# Inspect the returned material.uuid; use it for later material arguments
get_material_info: material="stone"
```

See [PBR materials](../blockbench-pbr-materials/SKILL.md) for channel replacement, uniform values, and the color-texture save-path requirement. Normal and height maps are alternatives, and a MER texture requires a color texture for the host preview.

## Error Handling

Tools throw descriptive errors with suggestions:

- **Element not found**: "Use list_outline tool to see available elements"
- **Texture not found**: "Use list_textures tool to see available textures"
- **Invalid format**: "Current project is not using a Hytale format"
- **Headless write refused**: a stale `expected_revision` (another agent changed the file) or a format rule violation; re-read the file and reapply, as [Blockbench headless](../blockbench-headless/SKILL.md) describes

## Best Practices

1. **Query first**: Use `list_*` tools to understand current state
2. **Build hierarchy**: Create bone structure before geometry
3. **Set origins**: Place group origins at pivot points for animation
4. **Name elements**: Use descriptive names for easy reference
5. **Validate**: Use `hytale_validate_model` for Hytale projects
6. **Screenshot**: Capture progress with `capture_screenshot`
7. **Checkpoint before risk**: Call `save_checkpoint` before experimental edits so `undo` can return cleanly
8. **Filter before iterate**: Prefer `find_elements_by_criteria` or `filter_by_material` over loading the full outline and filtering client-side

## Tool Status

- **stable**: Production-ready
- **experimental**: Working but may change

Most tools are experimental but functional. Check tool annotations for current status.
