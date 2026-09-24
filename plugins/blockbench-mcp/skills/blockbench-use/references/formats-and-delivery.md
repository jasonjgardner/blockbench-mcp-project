# Format Decisions and Delivery

Use this reference when creating a project, changing format, or preparing a handoff. Live `get_capabilities` and `list_export_formats` determine what the installed host supports. The official [format comparison](https://blockbench.net/wiki/blockbench/formats/) provides orientation; plugin versions and target versions can impose additional rules.

## Format Families

| Target | Planning and verification |
|---|---|
| Java block/item (`java_block`) | Check format/version rotation and size restrictions, face UV rotation, cullfaces, texture references, and display transforms. Organizational groups do not make the runtime model a skeletal animation rig. Verify hand, GUI, ground or other requested display slots. |
| Bedrock entity (`bedrock`, legacy variants) | Build named bones with joint pivots; confirm box versus per-face UV support. Model geometry, texture images, animation JSON and resource-pack wiring are separate assets. Controllers/effects need target-game checks. |
| Bedrock block (`bedrock_block`) | Verify geometry, face material-instance assignments, behavior-pack block components, and resource-pack texture definitions. Use [material-instance delivery guidance](bedrock-material-instances.md) for multiple materials or cutouts. Entity animation assumptions do not automatically apply to blocks. |
| Modded Java, OptiFine entity/part, GeckoLib and other installed Minecraft formats | Discover the exact registered format and exporter. Confirm its runtime/library version, accepted geometry, naming, texture assignment and animation rules. `modded_entity` and `optifine_entity` are not substitutes for freeform mesh formats. |
| Generic Model (`free`) and other mesh formats | Check `meshes`, UV sizing, rig type, and available codecs. Inspect face winding/normals, seams and texture references; add topology only when silhouette or deformation needs it. Test the intended glTF/OBJ/etc. importer. |
| Hytale character/attachment and prop | Use [Hytale guidance](../../blockbench-hytale/SKILL.md) for density, node limits, stretch, attachments and quaternion animation. |
| Image/skin formats | Preserve the template's dimensions, UV layout, layers and animation conventions. Mesh/bone operations may be unavailable even when painting is supported. |
| Other plugin formats | Apply shared modeling, UV and animation principles only to supported features. Read the format owner's current instructions before relying on special nodes, material channels or export options. |

Native features distinguish optional box UV, fractional box-UV sizing, UV rotation, per-texture UV dimensions, rig types and interpolation. Unknown flags require inspection; a format name is insufficient evidence. See [FormatFeatures](https://web.blockbench.net/docs/interfaces/generated_io_format.FormatFeatures.html).

## Geometry and UV Decisions

Resolve the user's appearance/accuracy, performance, or balanced preference before a new model or substantial redesign. Use [appearance and performance planning](appearance-and-performance.md) for a working budget, repeated geometry substitutions, and editor/runtime measurement. Texture resolution and a successful export do not establish acceptable runtime performance.

Establish silhouette, scale and joint positions before spending detail. Consistent parent-to-child naming and pivots at joints improve posing. Use texture detail for small surface features; reserve geometry for silhouette, depth and motion. Check overlapping coplanar faces for z-fighting. These workflow choices follow the [Blockbench overview](https://blockbench.net/wiki/guides/blockbench-overview-tips/).

For round primitives in Bedrock cube models, use [rotated-cuboid prism and tube construction](../../blockbench-modeling/references/bedrock-primitives.md). Select a facet count within the budget, calculate side widths and shared pivots, and inspect hollow openings, overlapping cap faces, and UV density. A mesh cylinder in Generic Model does not establish Bedrock export compatibility.

For a Minecraft-style asset, preserve the chosen pixel density and avoid accidental mixed scales. This is stylistic guidance for that target, not a ban on intentional varied density, smooth gradients, or fractional geometry elsewhere. Check texture tiling early for repeatable blocks and inspect faces revealed by motion. See the [Minecraft style guide](https://blockbench.net/wiki/guides/minecraft-style-guide/) and [Bedrock modeling guide](https://blockbench.net/wiki/guides/bedrock-modeling/).

Box UV derives each cube's face layout from its dimensions. Per-face UV gives independent rectangles. In box-UV formats that floor dimensions, fractional cube sizes can produce distorted or collapsed UV faces; use integer base sizes, supported inflate/stretch, or supported per-face UV according to the target. UV dimensions may differ from image pixel dimensions and may belong to each texture in formats enabling `per_texture_uv_size`. Do not rescale a whole project merely because one image has a different resolution. See [FormatFeatures](https://web.blockbench.net/docs/interfaces/generated_io_format.FormatFeatures.html) and the [project-format version notes](https://blockbench.net/wiki/docs/bbmodel/).

Plan overlaps deliberately: mirrored or repeated parts can share pixels, but unique detail needs separate UV space. A checker or directional test patch exposes stretching, mirrored labels and seam orientation. Reserve padding when filtering/mipmapping in the destination requires it; do not enforce a universal padding number on every pixel-art atlas. `auto_uv_mesh` generates coordinates but does not pack islands; a blank `create_texture` does not generate a texture template.

For detailed materials in any format, follow [UV scale and distortion guidance](../../blockbench-texturing/references/uv-scale-and-distortion.md). Check image pixels per model unit along both mapped surface directions and compare visible feature sizes across parts. Recheck after geometry resizing, format conversion, texture-size changes, and generated-atlas cleanup. Preserve deliberate stretching for uniform materials or intended effects, considering every PBR channel.

## Verification by Deliverable

| Changed area | Evidence to collect |
|---|---|
| Geometry | Relevant orthographic and perspective views; hierarchy/pivots; front-facing normals; intersections and motion clearance. |
| Performance | Selected preference and budget; element/face/triangle counts, materials and texture channels; comparable editor measurements and representative target-runtime measurements when available. Report estimates and untested runtime behavior explicitly. |
| UVs | `get_cube_uv` or `get_mesh_info: include_uv=true`; effective UV/image sizes, surface proportions, pixels per model unit in both directions, face texture references, overlaps and seams. Check a temporary checker and actual material feature scale across differently sized faces; record intentional exceptions. |
| Texture | `get_texture` and rendered preview; image dimensions, alpha, requested layers, palette readability and repeated tiling when applicable. |
| Bedrock materials | Correct block/entity binding system; named face assignments, block components or entity render controllers, texture-key resolution, and PBR channel files. Inspect cutouts from both sides and at intended viewing distances. |
| Animation | Correct animation UUID and rig; start, extrema and intermediate poses; contact/clearance, loop transition and final length. Preview interpolation between keys. |
| Particles | `list_particle_effects` shows no problems; Animate-mode screenshots at start, peak and loop seam; locators exported in geometry; effect files, custom textures and the client entity `particle_effects` map delivered. See [particle delivery](../../blockbench-particles/references/delivery.md). |
| Export | Codec availability and output metadata; complete bytes or written file; texture/material dependencies, animation files, and target-format naming. Reopen a copy or import into the destination when available. |

The editable `.bbmodel` format stores editor data; it is versioned and is not a substitute for a runtime asset contract. OBJ cannot carry a skeletal animation. General 3D formats cannot preserve arbitrary Molang expressions: expression-driven behavior must be baked where appropriate or recreated in the runtime. Discover the exporter's actual options, because model compilation alone does not invoke every interactive export workflow. See [3D export guidance](https://blockbench.net/wiki/guides/export-formats/), [animation expressions](https://blockbench.net/wiki/guides/animation-expressions/), and [.bbmodel documentation](https://blockbench.net/wiki/docs/bbmodel/).

Technical guidance checked against the linked primary sources on 2026-09-13. Pinterest and community galleries can inform visual references; confirm technical constraints against the current host, format owner, or official documentation.
