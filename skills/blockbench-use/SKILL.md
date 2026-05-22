---
name: blockbench-use
description: "MANDATORY prerequisite — invoke BEFORE any mcp__blockbench__* tool call that creates, modifies, or exports Blockbench content. Orchestrates the other blockbench-* skills (modeling, texturing, animation, PBR, Hytale, MCP overview). Trigger on: 3D model/texture/animation creation or edits in Blockbench; calls to mcp__blockbench__* tools; phrases like 'build a Minecraft model', 'paint a texture', 'animate this rig', 'export the model'. Dispatches to the right sub-skill(s), enforces pre-flight checks (project open, format, outline), wraps risky work in checkpoints, and ensures exports close the loop."
---

# Blockbench Use

Orchestrator for Blockbench MCP work. Load this **before** touching the 3D scene so the right sub-skills load and the right pre-flight checks run.

## Rule

Any request that will call an `mcp__blockbench__*` tool to create or modify content **must** go through this skill first.

Steps, in order:

1. **Classify the request** → pick one or more sub-skills (table below).
2. **Pre-flight** → confirm a project is open and the format is correct (see "Pre-flight checks").
3. **Load the sub-skill(s)** via the Skill tool.
4. **Checkpoint before risk** → call `save_checkpoint` for multi-step edits that might need rollback.
5. **Execute** the sub-skill's workflow.
6. **Close the loop** → screenshot, validate (Hytale), or export if the user asked for a deliverable.

## Skill routing table

Pick by primary intent. When the task spans domains, load **all** relevant skills before starting.

| User intent | Primary skill | Also load when… |
|---|---|---|
| Build cubes, meshes, groups, hierarchy | `blockbench-modeling` | needs texture → `blockbench-texturing` |
| Paint, fill, draw, brush, layers, UV | `blockbench-texturing` | channel-aware (normal/MER) → `blockbench-pbr-materials` |
| Keyframes, bone rigs, walk/idle/attack | `blockbench-animation` | bones need geometry first → `blockbench-modeling` |
| `.texture_set.json`, normal/height/MER | `blockbench-pbr-materials` | textures not yet drawn → `blockbench-texturing` |
| `.blockymodel`, `.blockyanim`, attachments, quads, stretch, shading modes | `blockbench-hytale` | modeling/animation parts → those skills |
| "What tools are available?" / unclear scope | `blockbench-mcp-overview` | — |
| Write a Blockbench JS plugin (not use MCP) | `blockbench-plugins` (from `blockbench-development/`) | — |

**Skip this skill** for pure research questions (API docs, "how does Blockbench work?"). Go straight to `blockbench-mcp-overview`.

## Pre-flight checks

Run before any mutation. One round of `list_outline` + `list_textures` is usually enough.

1. **Is a project open?** If no project, call `create_project` first (format from the routing table below).
2. **Is the format correct for the task?**
   - Cube modeling (Minecraft) → `bedrock_block`, `java_block`, `bedrock`
   - Mesh/freeform → `free`, `modded_entity`, `optifine_entity`
   - Hytale character → `hytale_character` (64px)
   - Hytale prop → `hytale_prop` (32px)
   - Generic → `generic` or `free`
3. **What's already there?** Use `list_outline` (structure) + `list_textures` (materials). Prefer `find_elements_by_criteria` / `filter_by_material` over dumping the whole outline for large projects.
4. **Hytale project?** Run `hytale_validate_model` at the end; never silently exceed 255 nodes.

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
3. **Respect the format.** Don't call Hytale tools on a non-Hytale project — they will error. Check `Format.id` via `risky_eval` or `hytale_get_format_info` if unsure.
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

- **Blockbench plugin development** (writing `.js` plugins) → `blockbench-plugins`
- **MCP server development** (adding tools to this repo) → not in this skill set
- **General 3D theory / THREE.js / rendering internals** → out of scope
