---
name: blockbench-use
description: "Load before Blockbench MCP calls that create, modify, or export content. Discover the active format and tools, route to modeling, UV/texturing, animation, particle, PBR, or Hytale guidance, and verify the requested result."
---

# Blockbench Use

Load this skill before creating, modifying, or exporting Blockbench content. For capability questions, use [MCP overview](../blockbench-mcp-overview/SKILL.md); plugin development uses [blockbench-plugins](../blockbench-development/SKILL.md).

## Discover and Route

1. Call `get_capabilities: include_tools=true`. It works without an open project and returns host/plugin identity, `project` (or `null`), registered formats, and current tool enabled states. Discover the running bundle rather than assuming every tool described in these source skills is installed.
2. Preserve the intended project. Use its `project.format_id`; for a new project, choose an exact returned format ID for the user's target. `get_capabilities: format_id="<ID>"` inspects a format without switching projects. Generic Model is normally `free`, not `generic`. Hytale requires its registered Hytale format, not Bedrock. Read [format and delivery guidance](references/formats-and-delivery.md) when choosing a target or preparing an export.
3. Load relevant domain skills using the available skill-reading mechanism. Load additional guidance when the workflow reaches that domain; a simple edit does not need every skill.
4. Inspect affected content with `list_outline`, `list_textures`, and targeted queries. Prefer UUIDs when names overlap. Inspect runtime mesh component keys with `get_mesh_info` before component edits.
5. Check mode/selection when required. `list_modes` and `set_mode` navigate supported editor modes. Enabled tools can still require a compatible format, target, or selection. A feature value of `null` means unknown; compact `supported_features` lists true flags and `unknown_features` lists unknown flags.

| Intent | Guidance |
|---|---|
| Cubes, meshes, groups, silhouette, topology | [Modeling](../blockbench-modeling/SKILL.md) |
| Bedrock poles, cylinders, tubes, rings, and faceted round shapes | [Modeling](../blockbench-modeling/SKILL.md), then [Bedrock primitives](../blockbench-modeling/references/bedrock-primitives.md) |
| UVs, pixel density, painting, layers | [Texturing](../blockbench-texturing/SKILL.md) |
| Vanilla/default Minecraft textures, or a named Minecraft block or material (bricks, oak logs, stone bricks) | [Vanilla textures](../blockbench-vanilla-textures/SKILL.md), then [Texturing](../blockbench-texturing/SKILL.md) for UVs |
| Animated textures, sprite sheets, vertical flipbooks | [Flipbook textures](../blockbench-flipbook-textures/SKILL.md), which requires [GPT Image textures](../blockbench-gpt-image-textures/SKILL.md) for generated artwork |
| Pivots, keyframes, timing, animation export | [Animation](../blockbench-animation/SKILL.md) |
| Particle effects, VFX, locators, particle keyframes, Snowstorm/Bedrock particle files | [Particles](../blockbench-particles/SKILL.md), with [Animation](../blockbench-animation/SKILL.md) for the clip |
| Normal/height/MER materials | [PBR materials](../blockbench-pbr-materials/SKILL.md) |
| Normal, height or MER maps derived from an existing color texture | [Albedo to normal](../blockbench-albedo-to-normal/SKILL.md), then [PBR materials](../blockbench-pbr-materials/SKILL.md) to assign them |
| Hytale formats, attachments, stretch, visibility | [Hytale](../blockbench-hytale/SKILL.md), then applicable shared domains |
| Armature deformation, display slots, Bedrock material instances | [MCP overview](../blockbench-mcp-overview/SKILL.md) and live schemas |

## Work at the Scale of the Request

Before creating a new model or substantially redesigning its geometry, ask where the user's preference lies: **appearance/accuracy**, **performance (fewer elements/faces)**, or **a balance**. Ask for the destination when unknown, including Minecraft edition and block versus entity. Reuse an explicit preference already given; "high quality" or "HD textures" alone does not choose a geometry budget. Continue discovery and inspection while awaiting the answer, but settle the preference before detailed geometry or texture generation. Routine edits that preserve an established design do not need this question again.

Use [appearance and performance planning](references/appearance-and-performance.md) to translate the answer into a working budget, choose geometry versus texture/PBR detail, and measure the result. Read it before multiplying repeated parts, optimizing a slow model, or adding hardware details such as screws, bolts, rivets, and other fasteners, which normally belong in albedo and supported PBR channels rather than in geometry. For Bedrock custom blocks using multiple materials or cutout panels, also read [material instances and texture delivery](references/bedrock-material-instances.md).

For a new model, also answer the real-time planning questions in [real-time asset planning](references/real-time-asset-planning.md) and record them in its plan template: target device, shading model, special materials, triangle budget, texel density and texture size, tiled versus atlas UVs, and animation type. Settle the shading model and texel density during blockout, because changing them later invalidates UVs and textures.

For a new asset, establish proportions and silhouette before detailed geometry, UVs, texture detail, and final animation. For an existing asset, inspect and change the requested area without rebuilding successful work. Use reference images to identify shape, palette, material and intended viewing distance. Treat Minecraft and Hytale art direction as target-specific guidance, not universal restrictions on every Blockbench format.

Before assigning detailed materials or repeating mapped geometry, follow [UV scale and distortion guidance](../blockbench-texturing/references/uv-scale-and-distortion.md). Preserve face proportions and consistent material feature scale across different face sizes; do not stretch the same full atlas swatch over every face by default. Allow deliberate exceptions for uniform materials or designed effects, considering all PBR channels.

Choose verification that observes the changed behavior: inspect UV values, effective pixels per model unit in both directions, and a mapped checker for UV edits; inspect a texture image and the rendered model after painting; preview several times and the loop seam for animation. A screenshot of the rest pose alone cannot verify a walk cycle. See the delivery reference for format-specific checks.

## Recovery and Delivery

- Use `save_checkpoint` before exploratory or substantial edits when a history marker helps recovery. It is an undo-history marker, not a saved `.bbmodel` or a snapshot of unrecorded changes. It can clear a redo branch because it adds a history entry. Inspect `get_undo_stack` before recovery; count actual history entries rather than assuming one entry per tool call. Preserve intervening user edits.
- Use dedicated `undo` / `redo` tools instead of triggering generic undo actions. Direct scripts must create their own correct native undo transaction. A marker cannot make an unrecorded edit reversible.
- Prefer dedicated tools. If the task requires a feature absent from the live tools, use a supported native UI workflow or explain the specific limitation. Follow existing authorization and repository instructions for `risky_eval`; do not invent an unavailable wrapper or silently substitute a lossy format.
- For a requested file, discover `list_export_formats`, choose an available codec with compile support, and use `export_model`. Save an editable `.bbmodel` alongside a runtime export when the requested handoff calls for an editable source. A compiled model does not establish that textures, animations, materials, controllers, or engine configuration have also been delivered.
- Inspect returned export metadata and verify the actual destination/content. Truncated response text is a preview, not a complete file. When target-app access is unavailable, report the validation completed and the remaining integration check accurately.
