# Blockbench MCP Skills

Agent Skills that teach Claude (or any compatible MCP client) how to drive the [Blockbench MCP server](https://github.com/jasonjgardner/blockbench-mcp-plugin/) effectively.

Each subdirectory contains a `SKILL.md` with frontmatter (`name`, `description`) and the full skill body. Some skills also ship `references/` and `assets/` for deeper context.

## Skill Index

| Skill | Description |
|-------|-------------|
| [blockbench-use](./blockbench-use) | Load before Blockbench content changes. Discover the running format/tools, route to domain skills, and verify results. Includes shared [format and delivery guidance](./blockbench-use/references/formats-and-delivery.md) and [real-time asset planning](./blockbench-use/references/real-time-asset-planning.md) (device, shading model, triangle and texture budgets, tiled vs atlas UVs, animation type for Minecraft and low-poly glTF). |
| [blockbench-new-model](./blockbench-new-model) | `/blockbench-new-model [subject]`: asks a short form (quality, texture style, animation, scene type, output folder, render preset), builds the subject with the headless `.bbmodel` MCP server and parallel agents, hands it to Blender, and writes a `render.cmd` that renders stills on every GPU and encodes them with FFmpeg. **Requires Blender and FFmpeg; Havok physics requires Blockbench desktop with the Havok plugin.** |
| [blockbench-mcp-overview](./blockbench-mcp-overview) | Discover tools, resources and editor modes; find shared workflows, armature/weight tools, Java display transforms, Bedrock material instances, and export/recovery guidance. |
| [blockbench-modeling](./blockbench-modeling) | Create and edit 3D models. Use when building geometry with cubes, creating meshes, placing spheres/cylinders, editing vertices, extruding faces, or organizing models with groups. Covers both cube-based Minecraft modeling and freeform mesh editing. |
| [blockbench-texturing](./blockbench-texturing) | Create and paint textures. Use when creating textures, painting on models, using brush tools, filling colors, drawing shapes, applying gradients, managing texture layers, or working with UV mapping. Covers pixel art texturing, procedural painting, and UV manipulation. |
| [blockbench-pbr-materials](./blockbench-pbr-materials) | Create and manage PBR (Physically Based Rendering) materials. Use when working with `texture_set.json` files, creating normal/height/MER maps, configuring material properties for Minecraft Bedrock RTX, or setting up multi-channel texture workflows. |
| [blockbench-animation](./blockbench-animation) | Create and manage animations. Use when animating 3D models, creating keyframes, managing bone rigs, editing animation curves, or working with animation timelines. Covers walk cycles, idle animations, combat animations, and complex multi-bone animations. |
| [blockbench-particles](./blockbench-particles) | Add particle effects to models: Bedrock/Snowstorm particle files from presets or design knobs, locators, particle keyframes, Animate-mode preview, and delivery to Bedrock resource packs (client entity `particle_effects`) and GeckoLib, with substitutes for glTF, Java block and Hytale targets. |
| [blockbench-hytale](./blockbench-hytale) | Create Hytale models and animations. Use when working with Hytale character/prop formats, creating attachments, setting shading modes, using quads, or animating with visibility keyframes. **Requires the Hytale Blockbench plugin to be installed.** |
| [blockbench-vanilla-textures](./blockbench-vanilla-textures) | Pull original Minecraft textures from Mojang's `bedrock-samples` via the jsDelivr CDN. Resolves block IDs (Java-style IDs mostly work) to per-face files. Tints grayscale grass, leaves and water, pre-tiles large faces, reports flipbooks, and optionally fetches the vanilla PBR `texture_set.json`. Includes Bedrock↔Java name mapping. Works for Bedrock, Java and generic models. |
| [blockbench-gpt-image-textures](./blockbench-gpt-image-textures) | Generate texture atlases, skins and tiles with OpenAI GPT Image 2.5 (Flare or Sunburst) on fal.ai, writing the expected UV layout into the prompt. Ships scripts that turn `get_cube_uv` output into pixel regions, call the fal endpoints, and downscale the result to atlas size. **Requires a `FAL_KEY`.** |
| [blockbench-flipbook-textures](./blockbench-flipbook-textures) | Create animated textures with the required GPT Image 2.5 texture skill, then convert sprite grids or horizontal sheets to vertical PNG strips. Includes a Pillow converter, APNG previews, and Blockbench/Java/Bedrock delivery guidance. |
| [blockbench-albedo-to-normal](./blockbench-albedo-to-normal) | Derive height, normal and packed MER (metalness / emissive / roughness) maps from an albedo texture with PyPBR (Python) or vgpu + Dawn WebGPU (Node.js), optionally estimating height with Depth Anything V2 and inferring MER from the albedo plus the normal's curvature. Use after painting or AI-generating a color texture when a material needs normal, heightmap or MER channels. Ships scripts, WGSL kernels, palette overrides and validation reports. |
| [blockbench-substance](./blockbench-substance) | **Optional, advanced.** Pair Blockbench with Adobe Substance 3D: render `.sbsar` materials at Blockbench sizes with `sbsrender`, cook `.sbs` with `sbscooker`, bake AO/curvature/ID masks from a Blockbench export with `substance3d_baker`, and paint in Substance 3D Painter over its remote-scripting API with Bedrock MER or glTF export. Ships locator, render wrapper, map packer and Painter scripts. **Requires a licensed Substance 3D install; most users do not need it.** |
| [blockbench-development](./blockbench-development) | Blockbench **plugin/extension** development (not MCP usage). Use when creating, modifying, or debugging JavaScript plugins for Blockbench including actions, dialogs, panels, menus, toolbars, model manipulation, animation APIs, and custom formats/codecs. The skill itself is named `blockbench-plugins` in its frontmatter. |

## Loading Order

Process skills first, implementation skills second:

1. `blockbench-use` — orchestrator, always first when touching the 3D scene (`blockbench-new-model` is a workflow on top of it: run it first when the user starts a new rendered scene, and it loads `blockbench-use`)
2. `blockbench-mcp-overview` — when discovering capabilities or crossing specialized format workflows
3. Domain skill(s) — `blockbench-modeling`, `blockbench-texturing`, `blockbench-pbr-materials`, `blockbench-animation`, `blockbench-particles`, or `blockbench-hytale` (load `blockbench-particles` after `blockbench-animation` when an effect rides on a clip)
4. `blockbench-vanilla-textures` — after `blockbench-texturing`, when the model should use Minecraft's own textures (a named block or material, or "vanilla" / "default" textures) instead of painted or generated ones
5. `blockbench-flipbook-textures` — after `blockbench-texturing`, for animated texture sheets; requires `blockbench-gpt-image-textures` when generating the artwork
6. `blockbench-gpt-image-textures` — after `blockbench-texturing`, when a texture should be AI-generated from the existing UV layout or a flipbook frame plan
7. `blockbench-albedo-to-normal` — after a color texture exists (painted or generated), when `blockbench-pbr-materials` needs normal, height or MER channels derived from it
8. `blockbench-substance` — optional; only when the user works with Adobe Substance 3D (`.sbsar`, `.sbs`, Painter, Automation Toolkit CLIs). Load after `blockbench-texturing` and before `blockbench-pbr-materials` assigns its maps
9. `blockbench-development` — only when authoring a Blockbench plugin (not when using MCP)

## Install

Install one or more skills into a project from the repo root:

```bash
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-use
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-mcp-overview
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-new-model
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-modeling
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-texturing
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-pbr-materials
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-animation
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-particles
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-hytale
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-vanilla-textures
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-gpt-image-textures
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-flipbook-textures
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-albedo-to-normal
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-substance   # optional, needs Adobe Substance 3D
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-development
```

## Authoring Notes

- Frontmatter `name` should match the directory name. The `blockbench-development` folder currently registers as `blockbench-plugins` in its frontmatter — keep this in mind when referencing it from other skills or tooling.
- Skill descriptions should be specific enough that an agent can decide relevance from the description alone (include trigger phrases and the kinds of tool calls each skill governs).
- Keep each `SKILL.md` self-contained; offload long reference material to `references/` and link to it from the body.
