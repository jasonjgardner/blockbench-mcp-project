---
name: blockbench-hytale
description: Create Hytale models and animations through Blockbench MCP. Use for character/attachment or prop formats, UV density, stretch, quads, shading, attachment pieces, and visibility keyframes. Requires the Hytale Models plugin.
license: Apache-2.0
---

# Blockbench Hytale

Before creating, changing, or exporting project content, read [Blockbench use](../blockbench-use/SKILL.md). Tool names below are semantic short names: discover and call the actual Blockbench MCP tools exposed by the current client, whose server or plugin prefixes may differ.

Use the shared [modeling](../blockbench-modeling/SKILL.md), [texturing](../blockbench-texturing/SKILL.md), and [animation](../blockbench-animation/SKILL.md) workflows where applicable.

## Select the Actual Hytale Format

Call `get_capabilities: include_tools=true` and choose a returned Hytale format ID. Creating a Bedrock project does not activate Hytale.

| Format | Units per world block | Use |
|---|---|---|
| `hytale_character` | 64 | Characters and attachments, including tools, weapons and cosmetics |
| `hytale_prop` | 32 | World props, furniture and blocks |

These numbers describe geometry/texel density, not maximum atlas resolution. Texture width and height may differ and must each be multiples of 32. Match effective UV dimensions to the actual image, and preserve the format's dimension-linked face UVs. The official [Hytale art guide](https://hytale.com/news/2025/12/an-introduction-to-making-models-for-hytale) explains density and atlas sizing.

```
get_capabilities: format_id="hytale_character"
create_project: name="goblin", format="hytale_character"
hytale_get_format_info
# → formatType, blockSize, animationFPS, nodeCount, maxNodes, nodeCountValid, features
```

Use `create_project` only when a new project is intended. Inspect existing projects before replacing content.

For a new static 128×96 Hytale atlas, explicitly match UV and bitmap dimensions (both Hytale formats support per-texture UV sizing):

```
create_texture: name="goblin_atlas", width=128, height=96,
  uv_width=128, uv_height=96, fill_color="#808080", layer_name="base"
list_textures
# Confirm uv_size, bitmap_size and frame_size are [128,96]
```

The `uv_width`/`uv_height` pair is available in the current source plugin; confirm the loaded tool schema supports it. Creating this image does not pack the model's UVs; follow the texturing skill's native template workflow when a new layout is needed.

## Geometry and UVs

The format supports cubes/quads, joint-based groups, stretch, optional box UV and per-texture UV dimensions. Use integer base dimensions when following the plugin's default size setting; stretch allows finer visible dimensions while retaining the UV layout. Fractional base dimensions are not categorically impossible, but make UV consistency harder. Exported models have a 255-node limit; exporter folding of a group's main cube affects the actual count. These are format behaviors documented in the [Hytale format source](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/formats.ts).

```
add_group: name="rig_root", origin=[0, 0, 0]
add_group: name="body", parent="rig_root", origin=[0, 24, 0]
place_cube: elements=[{name: "torso_geo", from: [-8, 24, -4], to: [8, 48, 4]}], group="body"
hytale_set_cube_stretch: cube_id="torso_geo", stretch=[1.1, 1, 1]
hytale_get_cube_stretch: cube_id="torso_geo"

hytale_create_quad: name="leaf", position=[0, 16, 0],
  normal="+Y", size=[8, 8], double_sided=true
```

Normals may be `+X`, `-X`, `+Y`, `-Y`, `+Z`, or `-Z`. Use double-sided rendering when both sides should appear. Small stretch changes can fix intersections; the art guide recommends roughly 0.7–1.3 per axis for its style, which is a visual recommendation rather than the MCP schema's validity range. Block in colors before painted volume and fine detail, and avoid unintended noisy grain. Soft brushes are appropriate to Hytale's painted style; pixel-perfect drawing is not mandatory. See the [art guide](https://hytale.com/news/2025/12/an-introduction-to-making-models-for-hytale).

`set_cube_uv` preserves Hytale's `autouv=1` and dimension-linked rectangle sizes. Move or mirror a face's UVs while retaining its absolute base geometry width/height (swapped for 90/270-degree UV rotation); changing those extents is rejected before Undo. Stretch changes the visible shape, not that base UV size. For the per-face `torso_geo` above, its unrotated north face is 16×24:

```
get_cube_uv: id="torso_geo"
set_cube_uv: id="torso_geo", faces={north: {uv: [8, 8, 24, 32], rotation: 0}}
```

Hytale quads cannot convert to box UV. Texture selection follows an attachment collection or the project default, even when the format reports `single_texture=false`; non-null per-face texture assignments are rejected. Inspect `effective_texture` and use the native collection/default texture workflow. See [native element behavior](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/element.ts) and [attachment texture resolution](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/attachment_texture.ts).

## Shading

`hytale_set_cube_properties` sets `shading_mode` and `double_sided`; `hytale_get_cube_properties` reads them. Accepted shading names are `standard`, `flat`, `fullbright`, and `reflective`. The exported property is not proof of matching viewport appearance; verify materials in Hytale.

```
hytale_set_cube_properties: cube_id="torso_geo", shading_mode="standard"
hytale_get_cube_properties: cube_id="torso_geo"
```

## Attachments

`hytale_list_attachments` lists existing attachment collections. `hytale_set_attachment_piece` marks an existing group; `hytale_list_attachment_pieces` reads those markers. A piece attaches to a matching base-model bone name, so inspect both assets and preserve the required names.

```
# Existing attachment group whose name matches the intended base bone
hytale_set_attachment_piece: group_name="hand_right", is_piece=true
hytale_list_attachment_pieces
hytale_list_attachments
```

Marking a group does not create a collection, configure the game's item, or export a separate attachment. The current tool family lists collections but does not create them. Use the installed plugin's native collection/attachment workflow when needed. The model compiler expects a live Collection for attachment-specific export; a JSON string in generic `export_model.options` is not that object. Verify the attachment with the base model and inspect the actual exported nodes. See [Hytale plugin features](https://github.com/JannisX11/blockbench-plugins/blob/master/plugins/hytale_plugin/about.md) and [model codec source](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/blockymodel.ts).

## Animation

Hytale animation files use 60 frame units per second. MCP keyframe times are seconds; `time=0.5` represents frame 30 at export. Use the animation UUID returned by `create_animation` and existing group names:

```
draw = create_animation: name="draw", animation_length=1, bones={}
hytale_create_visibility_keyframe: animation_id=draw.uuid,
  bone_name="weapon_sheathed", time=0, visible=true
hytale_create_visibility_keyframe: animation_id=draw.uuid,
  bone_name="weapon_sheathed", time=0.5, visible=false
hytale_set_animation_loop: animation_id=draw.uuid, loop_mode="hold"
```

The examples use tool-call pseudocode; bind `draw.uuid` to the returned UUID. Visibility changes need initial states as well as transition keys. For swapping two representations, key both at the same time.

Hytale uses quaternion interpolation and wraps looping clips. For full turns use intermediate orientations with less than 180 degrees between keys, and preview the direction and loop seam. Native UV-offset channels exist, but the current MCP family has no dedicated UV-offset-keyframe tool.

The upstream `.blockyanim` exporter writes `holdLastKeyframe`, and maps Catmull-Rom to smooth and other interpolation to linear. The editor's `once`, step or Bezier state therefore does not establish equivalent runtime playback. Verify the actual export and target behavior. These details come from the [animation codec source](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/blockyanim.ts).

## Validation and Export

1. Inspect UV/bitmap dimensions, texture assignments, stretch and geometry in relevant poses.
2. Run `hytale_validate_model`, then inspect its issues and `scope`. The current implementation counts nodes in the installed `blockymodel` compiler's main-model output and checks that both texture dimensions are positive multiples of 32. It reports `main_model_node_count_and_texture_dimensions`; attachments and full engine compatibility need separate checks. Older bundles used heuristic node counts and incorrect density-based texture checks, so discover/reload the current build before relying on this result.
3. Discover `list_export_formats`; use the registered `blockymodel` codec for an intended model export. The texture image is a separate deliverable.
4. Export animations through the installed plugin's native animation workflow. Upstream provides the `export_blockyanim` action; do not invent a `blockyanim` model codec when discovery does not return one. Complete any resulting native save dialog through the authorized UI workflow.
5. Reopen a copy or inspect the runtime asset when available. Report whether texture, attachment, shading, interpolation and loop behavior were actually checked in Hytale.

Resources include `hytale://format`, `hytale://attachments/{id}`, `hytale://pieces/{id}`, and `hytale://cubes/{id}`. Technical references checked 2026-09-13; the running Hytale plugin version remains authoritative for available behavior.
