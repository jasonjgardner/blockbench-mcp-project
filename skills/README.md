# Blockbench MCP Skills

Agent Skills that teach Claude (or any compatible MCP client) how to drive the [Blockbench MCP server](https://github.com/jasonjgardner/blockbench-mcp-plugin/) effectively.

Each subdirectory contains a `SKILL.md` with frontmatter (`name`, `description`) and the full skill body. Some skills also ship `references/` and `assets/` for deeper context.

## Skill Index

| Skill | Description |
|-------|-------------|
| [blockbench-use](./blockbench-use) | **Mandatory orchestrator.** Load before any `mcp__blockbench__*` tool call that creates, modifies, or exports Blockbench content. Dispatches to the right sub-skill(s), enforces pre-flight checks (project open, format, outline), wraps risky work in checkpoints, and ensures exports close the loop. |
| [blockbench-mcp-overview](./blockbench-mcp-overview) | Overview of the Blockbench MCP server's tools, resources, and prompts. Use to understand the full capability set or when starting a new Blockbench project. Covers all domains (modeling, animation, texturing, PBR, UI, camera). |
| [blockbench-modeling](./blockbench-modeling) | Create and edit 3D models. Use when building geometry with cubes, creating meshes, placing spheres/cylinders, editing vertices, extruding faces, or organizing models with groups. Covers both cube-based Minecraft modeling and freeform mesh editing. |
| [blockbench-texturing](./blockbench-texturing) | Create and paint textures. Use when creating textures, painting on models, using brush tools, filling colors, drawing shapes, applying gradients, managing texture layers, or working with UV mapping. Covers pixel art texturing, procedural painting, and UV manipulation. |
| [blockbench-pbr-materials](./blockbench-pbr-materials) | Create and manage PBR (Physically Based Rendering) materials. Use when working with `texture_set.json` files, creating normal/height/MER maps, configuring material properties for Minecraft Bedrock RTX, or setting up multi-channel texture workflows. |
| [blockbench-animation](./blockbench-animation) | Create and manage animations. Use when animating 3D models, creating keyframes, managing bone rigs, editing animation curves, or working with animation timelines. Covers walk cycles, idle animations, combat animations, and complex multi-bone animations. |
| [blockbench-hytale](./blockbench-hytale) | Create Hytale models and animations. Use when working with Hytale character/prop formats, creating attachments, setting shading modes, using quads, or animating with visibility keyframes. **Requires the Hytale Blockbench plugin to be installed.** |
| [blockbench-development](./blockbench-development) | Blockbench **plugin/extension** development (not MCP usage). Use when creating, modifying, or debugging JavaScript plugins for Blockbench including actions, dialogs, panels, menus, toolbars, model manipulation, animation APIs, and custom formats/codecs. The skill itself is named `blockbench-plugins` in its frontmatter. |

## Loading Order

Process skills first, implementation skills second:

1. `blockbench-use` — orchestrator, always first when touching the 3D scene
2. `blockbench-mcp-overview` — when you need the lay of the land
3. Domain skill(s) — `blockbench-modeling`, `blockbench-texturing`, `blockbench-pbr-materials`, `blockbench-animation`, or `blockbench-hytale`
4. `blockbench-development` — only when authoring a Blockbench plugin (not when using MCP)

## Install

Install one or more skills into a project from the repo root:

```bash
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-use
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-mcp-overview
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-modeling
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-texturing
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-pbr-materials
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-animation
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-hytale
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-development
```

## Authoring Notes

- Frontmatter `name` should match the directory name. The `blockbench-development` folder currently registers as `blockbench-plugins` in its frontmatter — keep this in mind when referencing it from other skills or tooling.
- Skill descriptions should be specific enough that an agent can decide relevance from the description alone (include trigger phrases and the kinds of tool calls each skill governs).
- Keep each `SKILL.md` self-contained; offload long reference material to `references/` and link to it from the body.
