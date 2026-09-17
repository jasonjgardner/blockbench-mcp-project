---
name: blockbench-pbr-materials
description: Create and manage PBR materials in Blockbench using MCP tools. Use for Bedrock texture_set.json import/export, normal or height maps, packed MER textures, material channel replacement, and uniform material properties.
---

# Blockbench PBR Materials

Use `get_capabilities` to inspect the active project and registered format features, including `pbr`. Check `list_textures` and `list_materials` before assigning existing assets. Texture and material references accept names or UUIDs; prefer returned UUIDs when names overlap.

Preserve the target's material convention. Bedrock MER is not glTF metallic/roughness or an arbitrary ORM packing. A successful Blockbench preview does not prove that a chosen exporter or game supports the material. Align channel maps to the color texture's UV layout and inspect their dimensions before painting. Shared UV and delivery checks are in [format and delivery guidance](../blockbench-use/references/formats-and-delivery.md).

## Use PBR for Surface Detail

Follow the selected [appearance/performance preference](../blockbench-use/references/appearance-and-performance.md). Use aligned normal or height detail for small fasteners, rivets, welds, grooves, and shallow seat ribs instead of multiplying tiny cubes. Add regional metalness and roughness variation in MER; a shared atlas can represent aluminum, rubber, and painted markings without a separate material for each visible surface. Author valid channel data rather than treating an albedo image as a normal/MER map. To derive normal, height or MER maps from an existing color texture, use [albedo to normal](../blockbench-albedo-to-normal/SKILL.md) and import the results with `create_texture` before assigning them here.

Normal/height shading does not create silhouette thickness, open railing holes, or collision. Preserve geometry where these matter. Confirm the destination's rendering mode actually uses PBR, retain a readable color-only fallback, and account for the memory cost of extra maps. Bedrock's Classic pipeline uses the color layer; normal and heightmap are mutually exclusive texture-set layers. See the [official texture-set specification](https://mojang.github.io/bedrock-samples/Texture%20Sets.html).

Use [UV scale and distortion guidance](../blockbench-texturing/references/uv-scale-and-distortion.md) to keep surface relief and material grain at a consistent scale across parts. Align corresponding regions across every channel even when image resolutions differ. UV or atlas edits must preserve those correspondences; verify tangent-space normal orientation after rotation/mirroring. A solid color does not justify stretching a detailed normal or roughness map.

PBR texture groups and `.texture_set.json` describe surface channels. They do not assign Bedrock block faces to render materials. Use [Bedrock material instances](../blockbench-use/references/bedrock-material-instances.md) for those bindings and accompanying pack files.

## Tools and Parameter Names

| Tool | Parameters used in this workflow |
|------|---------------------------------|
| `create_pbr_material` | `name`, `color_texture`, `normal_texture` or `height_texture`, `mer_texture`, `color_value`, `mer_value`, `subsurface_value` |
| `configure_material` | `material` plus the same channel/value fields; a texture field set to `"none"` clears that channel |
| `assign_texture_channel` | `material`, `texture`, `channel` |
| `list_materials` | No parameters |
| `get_material_info` | `material` |
| `import_texture_set` | `path` ending in `.texture_set.json` |
| `save_material_config` | `material`; output path is derived from the saved color texture |

These are flat tool arguments. Do not wrap channels in `textures` or settings in `config`, and do not use `material_id`, `texture_id`, or `output_path` for these PBR tools.

## Channel and Value Rules

| Channel | Texture data | Uniform alternative |
|---------|--------------|---------------------|
| `color` | Base color/albedo RGBA | `color_value: [R, G, B, A]`, each 0–255 |
| `normal` | Tangent-space RGB; neutral normal is `#8080FF` | None |
| `height` | Grayscale height, dark low to light high | None |
| `mer` | R=metalness, G=emissive, B=roughness | `mer_value: [M, E, R]`, each 0–255 |

- Use normal **or** height in one material. To change between them, remove the old channel in the same `configure_material` call.
- Use a separate texture for each assigned channel. Replacing a channel detaches its old texture from the material; it does not delete the image.
- Uniform values require no texture assigned to that channel; supplying them while a map remains assigned returns an error. Remove a MER map with `mer_texture="none"` when switching to `mer_value`.
- A MER texture requires a color texture in the current Blockbench preview. For uniform color, use uniform MER too.
- Moving a texture to another material changes its group. When moving a color texture away, clear or move its source material's MER texture first so the source remains valid.
- `subsurface_value` is one number from 0–255; it is not an RGB object. Game/export support depends on the target.

## Create a Material

```
create_texture: name="stone_color", width=16, height=16,
  fill_color="#808080", layer_name="base"
create_texture: name="stone_normal", width=16, height=16,
  fill_color="#8080FF", layer_name="base"

create_pbr_material: name="stone", color_texture="stone_color",
  normal_texture="stone_normal", mer_value=[0, 0, 230]
# → {success, material: {name, uuid, is_material, channels}}

get_material_info: material="stone"
```

`layer_name` is required whenever `create_texture` supplies `fill_color`. Retain `material.uuid` from the create response and use its value in subsequent `material` arguments. The names above work when unique. This example uses a matte nonmetal MER value; 230/255 is approximately 90% roughness.

## Edit and Replace Channels

Replace a normal map with another already-created normal texture:

```
assign_texture_channel: material="stone", texture="stone_normal_v2", channel="normal"
```

Switch from normal to an already-created height map in one call:

```
configure_material: material="stone", normal_texture="none", height_texture="stone_height"
```

The referenced replacement texture must exist; discover its UUID with `list_textures`. Use `get_material_info` afterward to verify the new assignment. These project edits are recorded for the dedicated `undo` / `redo` tools; undoing a channel replacement restores both the replaced and incoming texture's assignments.

## Uniform Properties

With an existing material named `stone`, clear any MER map before setting uniform values:

```
configure_material: material="stone", mer_texture="none", mer_value=[0, 0, 204]
```

| Appearance | `mer_value` example |
|------------|---------------------|
| Matte stone | `[0, 0, 230]` |
| Smooth metal | `[255, 0, 64]` |
| Smooth dielectric | `[0, 0, 13]` |
| Emissive nonmetal | `[0, 255, 204]` |

To use uniform color, clear both the color and MER textures in the same call:

```
configure_material: material="stone", color_texture="none", mer_texture="none",
  color_value=[128, 128, 128, 255], mer_value=[0, 0, 204]
```

## Paint and Assign a MER Map

Create a MER texture and assign it together with the material's color texture:

```
create_texture: name="stone_mer", width=16, height=16,
  fill_color=[0, 0, 204, 255], layer_name="base"

# Metallic spot, retaining roughness at 204 and emission at zero
paint_with_brush: texture_id="stone_mer", coordinates=[{x: 8, y: 8}],
  brush_settings={color: "#FF00CC", size: 4}

# Emissive spot, retaining roughness at 204 and metalness at zero
paint_with_brush: texture_id="stone_mer", coordinates=[{x: 4, y: 4}],
  brush_settings={color: "#00FFCC", size: 2}

configure_material: material="stone", color_texture="stone_color", mer_texture="stone_mer"
get_material_info: material="stone"
```

A brush color writes all RGB channels. Encode the properties you intend to preserve in that color instead of assuming a red or green brush isolates one channel.

## Inspect, Import, and Export

```
list_materials
# → [{name, uuid, channels: {color, normal, height, mer}, config}]

get_material_info: material="stone"
# → {name, uuid, is_material, textures, config, texture_set_json}

import_texture_set: path="C:/packs/textures/stone.texture_set.json"
```

Import needs a readable file and its referenced images on the Blockbench desktop host. Inspect the imported material before editing it.

For export, first save the color image through Blockbench so it has a valid file path. `get_material_info` exposes `config.file_path` and a `texture_set_json` preview. The save tool derives the `.texture_set.json` destination from the color image; it does not take an arbitrary output path:

```
save_material_config: material="stone"
```

New textures created only in memory do not have a save path. When the user only needs the JSON content, use the `get_material_info` preview. Saving a material config writes a disk file and is separate from undoable project edits. Verify the appearance in the intended game/rendering environment when that is part of the requested deliverable.
