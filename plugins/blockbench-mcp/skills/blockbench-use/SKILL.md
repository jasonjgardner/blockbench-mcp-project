---
name: blockbench-use
description: "MANDATORY prerequisite — invoke BEFORE any Blockbench MCP tool call that creates, modifies, or exports Blockbench content. Orchestrates the other blockbench-* skills (modeling, texturing, animation, PBR, Hytale, headless, MCP overview). Trigger on: 3D model/texture/animation creation or edits in Blockbench; calls to Blockbench MCP tools (desktop or headless bbmodel_* tools); phrases like 'build a Minecraft model', 'paint a texture', 'animate this rig', 'export the model'. Dispatches to the right sub-skill(s), enforces pre-flight checks (project open, format, outline), wraps risky work in checkpoints, and ensures exports close the loop."
license: Apache-2.0
---

# Blockbench Use

Orchestrator for Blockbench MCP work. Load this **before** touching the 3D scene so the right sub-skills load and the right pre-flight checks run.

Two Blockbench MCP servers can be connected: the **desktop** server (`blockbench`, drives the open Blockbench app) and the **headless** server (`blockbench-headless`, edits `.bbmodel` files on disk with `bbmodel_*` tools). Pick one per task in step 1 below.

Tool names such as `get_capabilities` are semantic short names. Discover the Blockbench MCP tools exposed by the current client and use their actual registered names; server and plugin prefixes can differ between Codex and Claude Code.

## Rule

Any request that will call a Blockbench MCP tool to create, modify, or export content **must** go through this skill first.

Steps, in order:

1. **Classify the request** → pick the server (desktop or headless, see "Choosing a server") and one or more sub-skills (table below).
2. **Pre-flight** → desktop: confirm a project is open and the format is correct (see "Pre-flight checks"). Headless: confirm the server answers and the file path is inside its `--root`.
3. **Load the sub-skill(s)** using the sibling `SKILL.md` links below. Use the current client's skill-loading mechanism when available, or read those files directly; a dedicated Skill tool is not required.
4. **Checkpoint before risk** → call `save_checkpoint` for multi-step edits that might need rollback.
5. **Execute** the sub-skill's workflow.
6. **Close the loop** → screenshot, validate (Hytale), or export if the user asked for a deliverable.

## Skill routing table

Pick by primary intent. When the task spans domains, load **all** relevant skills before starting.

| User intent | Primary skill | Also load when… |
|---|---|---|
| Build cubes, meshes, groups, hierarchy | [blockbench-modeling](../blockbench-modeling/SKILL.md) | needs texture → [blockbench-texturing](../blockbench-texturing/SKILL.md) |
| Paint, fill, draw, brush, layers, UV | [blockbench-texturing](../blockbench-texturing/SKILL.md) | channel-aware (normal/MER) → [blockbench-pbr-materials](../blockbench-pbr-materials/SKILL.md) |
| Keyframes, bone rigs, walk/idle/attack | [blockbench-animation](../blockbench-animation/SKILL.md) | bones need geometry first → [blockbench-modeling](../blockbench-modeling/SKILL.md) |
| `.texture_set.json`, normal/height/MER | [blockbench-pbr-materials](../blockbench-pbr-materials/SKILL.md) | textures not yet drawn → [blockbench-texturing](../blockbench-texturing/SKILL.md) |
| `.blockymodel`, `.blockyanim`, attachments, quads, stretch, shading modes | [blockbench-hytale](../blockbench-hytale/SKILL.md) | modeling/animation parts → those skills |
| `.bbmodel` files on disk, parallel agents, validate/render/contact sheet, Bedrock geometry or Java block export, Bedrock particle effects | [blockbench-headless](../blockbench-headless/SKILL.md) | texture/UV/PBR/animation rules → those skills (use headless tool names) |
| "What tools are available?" / unclear scope | [blockbench-mcp-overview](../blockbench-mcp-overview/SKILL.md) | — |

**Skip this skill** for pure research questions (API docs, "how does Blockbench work?"). Go straight to `blockbench-mcp-overview`.

## Choosing a server

| Situation | Server |
|---|---|
| The user is working in an open Blockbench project, or needs brushes, the live timeline, Hytale tools, or editor screenshots | Desktop (`get_capabilities` and friends) |
| The work is a file in a folder, several agents build in parallel, or Blockbench is not running | Headless (`bbmodel_*`), via [blockbench-headless](../blockbench-headless/SKILL.md) |
| Both are connected and the task is ambiguous | Ask, or prefer headless for batch and parallel work and desktop for the user's live model |

Never edit one `.bbmodel` through both servers at once: Blockbench does not reload a file changed on disk, and the next save overwrites the headless edit. If the desktop tools are unavailable, say so and offer the headless server instead of guessing.

The desktop pre-flight checks below do not apply to headless work. Headless writes take an `expected_revision` from the last read, and `bbmodel_validate` plus `bbmodel_contact_sheet` replace the outline and screenshot checks.

## Pre-flight checks

1. **Discover the running host.** Call `get_capabilities: include_tools=true`. It works without an open project and returns `project` (or `null`), the active `format`, registered `formats`, and tool enabled states. An enabled tool may still require a compatible format, mode, or selection.
2. **Choose a supported format.** Use an exact ID from `formats`, then inspect it with `get_capabilities: format_id="<returned ID>"`. This query does not create or switch projects.
   - Mesh/freeform or Generic Model → normally `free`; require `format.features.meshes=true`. The display name "Generic Model" is not a format ID named `generic`.
   - Minecraft cube modeling → choose the target's registered format, commonly `bedrock_block`, `java_block`, or `bedrock`. `modded_entity` and `optifine_entity` are cube formats, not freeform mesh choices; inspect the running host's feature flags.
   - Animation → also require the format's `animation_mode` and suitable rig features.
   - Hytale → use registered `hytale_character` or `hytale_prop` formats and their matching skill. Their availability depends on the Hytale plugin.
   - A detailed feature value of `null` means unknown. In the compact list, `supported_features` contains true flags; missing flags are false unless listed in `unknown_features`.
3. **Open the intended project.** If `project` is `null`, create it with the chosen ID. For an existing project, compare `project.format_id` with the needed format before editing. Do not silently replace the user's project. Call `get_capabilities` without `format_id` afterward to confirm the active project.
4. **Inspect existing content.** Use `list_outline` + `list_textures`, or targeted `find_elements_by_criteria` / `filter_by_material` queries for large projects. Use `get_mesh_info` for actual mesh vertex and face keys; names such as `top_face` are not generated geometry IDs.
5. **Hytale project?** Run `hytale_validate_model` at the end; never silently exceed 255 nodes.

## Multi-skill workflow compositions

### "Create a Minecraft character with a walk cycle"

```
blockbench-modeling    → bones + cubes
blockbench-texturing   → skin texture
blockbench-animation   → walk cycle keyframes
# finally:
capture_screenshot     → preview
export_model: codec_id="project"  → save .bbmodel
```

### "Make a Bedrock RTX block"

```
blockbench-modeling        → single cube
blockbench-texturing       → color map
blockbench-pbr-materials   → normal + MER + texture_set.json
# finally:
hytale_validate_model      → (skip — not Hytale)
capture_screenshot
```

### "Build a Hytale character with attachments"

```
blockbench-hytale          → read first: format, node limits, pieces
blockbench-modeling        → geometry in character format
blockbench-animation       → optional keyframes (60 FPS)
# separately per attachment collection:
blockbench-hytale          → hytale_set_attachment_piece on bones
# finally:
hytale_validate_model      → node count, stretch, shading
export_model: codec_id="blockymodel"
```

### "Build several assets in parallel without opening Blockbench"

```
blockbench-headless        → one .bbmodel per subagent, each owns its file
bbmodel_create + bbmodel_edit          → blockout, then detail
bbmodel_validate + bbmodel_contact_sheet → every pass, look at the images
bbmodel_export_bedrock_geometry        → deliverable, if the target is Bedrock
# finally: give the user the web_app link the write tools return
```

### "Retexture an existing model"

```
# Pre-flight: find everything that uses the old texture
filter_by_material: texture="old_skin"
# Load:
blockbench-texturing       → paint/create replacement
# Swap references:
apply_texture per match (from filter_by_material results)
```

## Safety & efficiency rules (apply in every session)

1. **Checkpoint before risk.** For any workflow of 3+ mutations, call `save_checkpoint: name="<descriptive>"` first. If the result is wrong, `undo: steps=N` back.
2. **Filter, don't dump.** Prefer `find_elements_by_criteria`, `filter_by_material`, or `select_all_of_type` over `list_outline` when you know the shape of what you want. Large outlines blow context.
3. **Respect the format.** Use `get_capabilities` for the active format and feature flags; use `hytale_get_format_info` for Hytale-specific details when a Hytale format is active.
4. **Screenshot after meaningful changes.** `capture_screenshot` confirms the model looks right. Do it at milestones, not every edit.
5. **Export only when the user asks for a deliverable.** Use `list_export_formats` first to pick the right codec, then `export_model` with a `path` (or content-only if the user just wants to see it).
6. **Never call `trigger_action: action="undo"` or `"redo"`.** Use the dedicated `undo` / `redo` tools — they return which actions were traversed.
7. **Name everything.** Descriptive names make `find_elements_by_criteria` and filtering work later.

## When to load `blockbench-mcp-overview`

Load it instead of a specialized skill when:

- The user's intent is ambiguous ("help me with this model")
- The tool call count will be small (<5) and spans multiple domains
- The user is asking about capabilities, not executing

Otherwise prefer the specialized skills — they have concrete examples and return shapes.

## What this skill does NOT cover

- **Installing the desktop plugin or building the headless server itself** → see the plugin README; this skill set only uses them
- **Blockbench plugin development** (writing `.js` plugins) → outside this MCP skill set
- **MCP server development** (adding tools to this repo) → not in this skill set
- **General 3D theory / THREE.js / rendering internals** → out of scope
