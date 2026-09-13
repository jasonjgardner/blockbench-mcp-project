---
name: blockbench-use
description: "Load before Blockbench MCP calls that create, modify, or export content. Discover the active format and tools, route to modeling, UV/texturing, animation, PBR, or Hytale guidance, and verify the requested result."
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
| UVs, pixel density, painting, layers | [Texturing](../blockbench-texturing/SKILL.md) |
| Pivots, keyframes, timing, animation export | [Animation](../blockbench-animation/SKILL.md) |
| Normal/height/MER materials | [PBR materials](../blockbench-pbr-materials/SKILL.md) |
| Hytale formats, attachments, stretch, visibility | [Hytale](../blockbench-hytale/SKILL.md), then applicable shared domains |
| Armature deformation, display slots, Bedrock material instances | [MCP overview](../blockbench-mcp-overview/SKILL.md) and live schemas |

## Work at the Scale of the Request

For a new asset, establish proportions and silhouette before detailed geometry, UVs, texture detail, and final animation. For an existing asset, inspect and change the requested area without rebuilding successful work. Use reference images to identify shape, palette, material and intended viewing distance. Treat Minecraft and Hytale art direction as target-specific guidance, not universal restrictions on every Blockbench format.

Choose verification that observes the changed behavior: inspect UV values and a mapped checker for UV edits; inspect a texture image and the rendered model after painting; preview several times and the loop seam for animation. A screenshot of the rest pose alone cannot verify a walk cycle. See the delivery reference for format-specific checks.

## Recovery and Delivery

- Use `save_checkpoint` before exploratory or substantial edits when a history marker helps recovery. It is an undo-history marker, not a saved `.bbmodel` or a snapshot of unrecorded changes. It can clear a redo branch because it adds a history entry. Inspect `get_undo_stack` before recovery; count actual history entries rather than assuming one entry per tool call. Preserve intervening user edits.
- Use dedicated `undo` / `redo` tools instead of triggering generic undo actions. Direct scripts must create their own correct native undo transaction. A marker cannot make an unrecorded edit reversible.
- Prefer dedicated tools. If the task requires a feature absent from the live tools, use a supported native UI workflow or explain the specific limitation. Follow existing authorization and repository instructions for `risky_eval`; do not invent an unavailable wrapper or silently substitute a lossy format.
- For a requested file, discover `list_export_formats`, choose an available codec with compile support, and use `export_model`. Save an editable `.bbmodel` alongside a runtime export when the requested handoff calls for an editable source. A compiled model does not establish that textures, animations, materials, controllers, or engine configuration have also been delivered.
- Inspect returned export metadata and verify the actual destination/content. Truncated response text is a preview, not a complete file. When target-app access is unavailable, report the validation completed and the remaining integration check accurately.
