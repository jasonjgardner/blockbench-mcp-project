---
name: blockbench-mcp-overview
description: Discover and use Blockbench MCP tools, resources, and prompts, on the desktop server or the headless bbmodel_* server. Use for capability questions, new-project planning, mode navigation, export, display transforms, Bedrock face materials, or native armature workflows.
license: Apache-2.0
---

# Blockbench MCP Overview

For content changes, load [blockbench-use](../blockbench-use/SKILL.md) first. Tool names below are semantic short names: discover and call the actual Blockbench MCP tools exposed by the current client, whose server or plugin prefixes may differ. The running server's tool list and schemas determine available operations; this source skill can describe tools newer than an installed bundle. Tool status and success text are not a substitute for result inspection.

## Two servers

| Server | Registered as | Works on | Tools |
|---|---|---|---|
| Desktop | `blockbench` (`http://localhost:3000/bb-mcp`) | The project open in the Blockbench app | Everything in this skill |
| Headless | `blockbench-headless` (stdio, `npx`) | `.bbmodel` files in a `--root` folder, no app needed | `bbmodel_*` and `blockbench_launch`; see [Blockbench headless](../blockbench-headless/SKILL.md) |

Use desktop for the user's live model and interactive work; use headless for file-based, parallel, or app-less work such as validation, rendering, and export. Either server may be missing in a session: check which tools the client exposes before planning. The rest of this skill describes the desktop server.

## Discover the Host and Workflow

```
get_capabilities: include_tools=true
# → blockbench, plugin, project, format, formats, tools, notes
list_modes
# → current_mode, modes[{id, available, selected, ...}]
```

`project` may be `null`. Use exact registered format IDs: Generic Model is normally `free`. Inspect a prospective format with `get_capabilities: format_id="free"` without switching projects. Detailed feature flags can be `null` (unknown); compact listings distinguish true flags and unknown flags. Installed plugin formats are supported through discovery rather than a fixed whitelist in these skills.

When a tool depends on editor state, use `list_modes` and `set_mode: mode_id="<returned ID>"`, then refresh availability. Animate uses `animate`, not `animation`. Changing mode does not change project format.

| Workflow | Tools or guidance |
|---|---|
| Cubes, meshes and groups | [Modeling](../blockbench-modeling/SKILL.md) |
| Cube/mesh UVs, texture images, painting and layers | [Texturing](../blockbench-texturing/SKILL.md) |
| Group rigs, keyframes, curves and timelines | [Animation](../blockbench-animation/SKILL.md) |
| Particle effects, locators and particle keyframes (`create_particle_effect`, `add_locator`, `manage_particle_keyframes`, `export_particle_pack`) | [Particles](../blockbench-particles/SKILL.md) |
| Normal/height/MER channel materials | [PBR materials](../blockbench-pbr-materials/SKILL.md) |
| Generating normal/height/MER maps from a color texture (PyPBR or vgpu, Depth Anything) | [Albedo to PBR](../blockbench-albedo-to-pbr/SKILL.md) |
| Hytale-specific formats, attachments and visibility | [Hytale](../blockbench-hytale/SKILL.md) |
| Native armatures and vertex weights | Armature section below |
| Java item/block display transforms | Display section below |
| Bedrock block face material names | Material-instance section below |
| Undo history and file delivery | Recovery/export sections below |

## Inspection and IDs

Prefer `find_elements_by_criteria` and `filter_by_material` for targeted questions; use `list_outline` to understand a hierarchy. Read `list_textures` and `list_materials` before referring to existing assets. Names can collide, especially a group and its cube, so retain UUIDs.

`place_mesh` returns `{meshes: [{name, uuid, vertex_keys, face_keys}]}`. Component arrays follow input order. Other mesh creators and existing meshes can be inspected with `get_mesh_info`; its vertices and faces have independent `next_offset` values. Read to `null` before mutating. Positions and normals are mesh-local. Reinspect after topology changes or undo/redo. See the modeling skill for executable client-orchestration examples.

`get_cube_uv: id="<cube UUID>"` reads box/per-face mode, face UVs and effective texture dimensions. `set_cube_uv` edits those values with format checks. `list_textures` reports `uv_size`, `bitmap_size`, and `frame_size`; `create_texture` can set an explicit `uv_width`/`uv_height` pair in formats with per-texture UV sizing. Schemas and examples are in the texturing skill.

Resources include `projects://{id}`, `nodes://{id}`, `textures://{id}`, and Hytale-specific resources. Discover resource templates and concrete URIs from the live server instead of inventing IDs. Project exports can also return a live `.bbmodel` resource link.

## A Small Model and Animation

This is tool-call pseudocode for a newly intended Bedrock entity. Confirm the format is registered and the project supports animation first.

```
create_project: name="robot", format="bedrock"
add_group: name="body", origin=[0, 12, 0]
place_cube: elements=[{name: "torso_geo", from: [-4, 12, -2], to: [4, 24, 2]}], group="body"

create_texture: name="skin", width=64, height=64, fill_color="#808080", layer_name="base"
apply_texture: id="torso_geo", texture="skin", applyTo="all"

idle = create_animation: name="idle", animation_length=2, loop=true, bones={}
manage_keyframes: animation_id=idle.uuid, action="create", bone_name="body",
  channel="rotation", keyframes=[
    {time: 0, values: [0, 0, 0]},
    {time: 1, values: [0, 5, 0]},
    {time: 2, values: [0, 0, 0]}
  ]
animation_timeline: animation_id=idle.uuid, action="set_time", time=1
capture_screenshot
```

Bind `idle.uuid` to the returned value; it is not a literal tool argument. Inspect UVs before adding detailed texture art. A rest-pose screenshot alone does not verify motion.

## Native Armatures

When the running format supports `armature_rig`, discover the native armature tools: `list_armatures`, `get_armature`, `add_armature`, `list_armature_bones`, `get_armature_bone`, `add_armature_bone`, and the update/remove operations. ArmatureBones and group-based BoneAnimators are different APIs; the general animation tools resolve groups.

For an existing mesh and armature, inspect `get_mesh_info` for runtime vertex keys and `get_vertex_weights: mesh_id="<UUID>"` for current weights. `set_vertex_weights_batch` takes `bone_id`, `mesh_id`, and `weights: { "<vertex key>": 0.5 }`; weights are 0–1. Inspect all contributing weights and deformation at joints after changes; setting one bone's values does not establish a correctly bound or normalized whole rig. Check exporter support for the native rig before promising a skinned runtime asset.

## Java Display Transforms

For formats supporting `display_mode`:

```
get_display_transform: slot="gui"
set_display_transform: slot="gui", rotation=[30, 225, 0], scale=[0.75, 0.75, 0.75]
enter_display_mode: slot="gui"
capture_screenshot
```

Display transforms change exported data. Confirm the requested hand, inventory, ground or frame views with their corresponding slots; do not use a camera adjustment to imply those transforms were authored.

## Bedrock Block Material Instances

In `bedrock_block`, `get_face_material_instances` reads and `set_face_material_instance` writes names mapped by the target's `minecraft:material_instances` component.

```
get_face_material_instances: cube_id="block_geo"
set_face_material_instance: cube_id="block_geo", faces=["up"], material_name="top"
```

The tools assign face names; they do not create the behavior-pack block components or resource-pack texture definitions. These material instances are separate from PBR texture groups and GPU instancing. Follow [material-instance and texture delivery](../blockbench-use/references/bedrock-material-instances.md) for multiple materials or cutout panels, and the [appearance/performance plan](../blockbench-use/references/appearance-and-performance.md) before using textures to replace repeated geometry. Entities use client-entity/render-controller bindings rather than this block component. Inspect the geometry export and accompanying target configuration.

## Recovery

`save_checkpoint` inserts a history marker. It does not save a file, preserve an existing redo branch, or make unrecorded script mutations undoable. Use `get_undo_stack` to locate the marker and count actual entries before `undo: steps=N`; a paint tool may create multiple native strokes. Preserve intervening user edits.

Use dedicated `undo` / `redo` rather than `trigger_action` for those operations. Direct `risky_eval` scripts must manage native undo aspects and failure cleanup for mutations. Prefer available dedicated tools and follow the session's existing authorization.

## Export

```
list_export_formats
# Inspect available, has_compile, extension and belongs_to_current_format
export_model: codec_id="project", result_format="embedded"
export_model: codec_id="project", path="C:/models/robot.bbmodel", max_content_length=0
```

Use an authorized destination on the Blockbench host. Filesystem permission may be handled by the host. `only_current_format=true` filters the codec listing; use the full listing to discover other available compatible exports.

`export_model` invokes a codec's compile operation. It does not automatically run the codec's interactive export flow, write all external images, or export separate animation files. Inspect `byte_length`, output path, truncation and returned content/resource metadata. A truncated text/base64 preview is not a complete downloadable asset. Embedded results contain a complete file only when it fits the response limit.

Select format, dependencies and destination checks using [format and delivery guidance](../blockbench-use/references/formats-and-delivery.md). Reopen a copy or inspect the destination app when available; report verification limits accurately.
