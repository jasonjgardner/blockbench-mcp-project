# Bedrock Material Instances and Texture Delivery

Read when a Bedrock custom block uses named face materials, several textures, or alpha-cutout geometry. Start with the selected [appearance/performance preference](appearance-and-performance.md); material count and transparency belong in that budget.

## Choose the Correct Binding System

For **custom blocks**, geometry face `material_instance` names resolve through the behavior-pack block's `minecraft:material_instances` component. Multiple Blockbench textures or PBR groups alone do not establish those bindings. The component supports a `*` fallback and named instances, with a documented limit of 64; this is a format ceiling, not a performance target. From 1.21.80 onward, using either `minecraft:geometry` or `minecraft:material_instances` requires both. Verify the requested format version against the [current component reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_material_instances?view=minecraft-bedrock-stable).

For **entities**, use the client-entity material/texture references and render controllers that bind materials to bones. Do not add a block component to an entity or silently convert it into a block to obtain material-instance tools. See Microsoft's [render-controller documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationrendercontroller?view=minecraft-bedrock-stable).

## Assign and Deliver Custom-Block Materials

1. Confirm `bedrock_block` and discover the enabled tools with `get_capabilities: include_tools=true`. Inspect actual per-face UVs and texture references before assigning names.
2. Choose a small set of semantic bindings, such as `aluminum`, `pads`, or `rail_cutout`. Reuse texture tiles and channel maps where useful; a new visible surface does not automatically need a new material.
3. Assign explicit cube UUIDs/faces with `set_face_material_instance`; use `bulk_set_material_instances` only if the live bundle advertises it. Inspect with `get_face_material_instances` / `list_material_instances`. These tools name faces; they do not create pack definitions.
4. Supply matching entries under the behavior-pack block's `minecraft:material_instances`, the referenced geometry, and resource-pack `textures/terrain_texture.json` texture keys with their image files. For PBR, also deliver the referenced `.texture_set.json` and channel images through the [PBR skill](../../blockbench-pbr-materials/SKILL.md). Microsoft's [custom-block material tutorial](https://learn.microsoft.com/en-us/minecraft/creator/documents/customblockrenderlighting?view=minecraft-bedrock-stable) shows the division between pack files.

For example, assign a pad face after resolving its cube UUID:

```text
set_face_material_instance: cube_id="<resolved pad cube UUID>", faces=["north"], material_name="pads"
get_face_material_instances: cube_id="<resolved pad cube UUID>"
```

Example **block components fragment** for two opaque texture bindings (the enclosing block definition and pack files must also exist):

```json
{
  "minecraft:geometry": "geometry.bleachers",
  "minecraft:material_instances": {
    "*": { "texture": "bleachers_aluminum", "render_method": "opaque" },
    "pads": { "texture": "bleachers_rubber", "render_method": "opaque" }
  }
}
```

Here the two texture values are keys in `terrain_texture.json`, not arbitrary Blockbench texture UUIDs. The pad's exported per-face UV entry must contain `"material_instance": "pads"`. The [geometry schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/schemasreference/schemas/minecraftschema_geometry_1.16.0?view=minecraft-bedrock-stable) defines this field; omitted faces in per-face UV mode are not drawn. Check actual exported UV units and image dimensions when moving from a Generic Model to Bedrock.

## Cutout Panels and Render Cost

For railing infills or X braces painted into a tile, use alpha-tested holes rather than an opaque background or translucent blending. `alpha_test` includes both sides; `alpha_test_single_sided` retains backface culling. Select the behavior needed by actual viewing directions, and verify supported render methods/combinations for the target version. An opaque-only surface should use `opaque` when the target material setup permits it. See the [render-method definitions](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_material_instances?view=minecraft-bedrock-stable).

Do not make the whole model double-sided just to fix a panel viewed from behind. Use the smallest supported panel arrangement and avoid overlapping transparent layers. Inspect both sides and distant views in the game; fewer triangles can still cost more if alpha overdraw or extra material passes dominate.

Material instances choose texture/render bindings; PBR texture sets choose color, normal/height, and MER channels. Neither means GPU instancing or guarantees fewer draw calls. Validate face names, component entries, texture-key resolution, alpha behavior, and PBR support together. A successful `.bbmodel` preview or geometry-only export does not verify runtime material delivery.
