# Blockbench MCP Skills

On the `codex` branch, the fifteen published MCP skills live in the checked-in
plugin at `plugins/blockbench-mcp/skills/`. Both Codex and Claude Code load those
same files. The root `skills/` directory retains this index and the separate
Blockbench developer skill.

## Published skills

| Skill | Purpose |
| --- | --- |
| [blockbench-use](../plugins/blockbench-mcp/skills/blockbench-use/SKILL.md) | Mandatory orchestrator before Blockbench MCP calls that create, modify, or export content; routes tasks and checks the active project and format. |
| [blockbench-mcp-overview](../plugins/blockbench-mcp/skills/blockbench-mcp-overview/SKILL.md) | Discover tools, resources, prompts, and workflows across modeling domains. |
| [blockbench-modeling](../plugins/blockbench-mcp/skills/blockbench-modeling/SKILL.md) | Build cubes, meshes, groups, and model hierarchies. |
| [blockbench-texturing](../plugins/blockbench-mcp/skills/blockbench-texturing/SKILL.md) | Create textures, paint, edit UVs, and assign materials. |
| [blockbench-pbr-materials](../plugins/blockbench-mcp/skills/blockbench-pbr-materials/SKILL.md) | Work with normal, height, and MER material channels. |
| [blockbench-animation](../plugins/blockbench-mcp/skills/blockbench-animation/SKILL.md) | Rig models and edit animations and keyframes. |
| [blockbench-hytale](../plugins/blockbench-mcp/skills/blockbench-hytale/SKILL.md) | Use Hytale model, animation, and attachment workflows; requires the Hytale Blockbench plugin. |
| [blockbench-headless](../plugins/blockbench-mcp/skills/blockbench-headless/SKILL.md) | Build, validate, convert, and render `.bbmodel` files on disk with the headless server; parallel agents, particle effects, web-app links. |
| [blockbench-particles](../plugins/blockbench-mcp/skills/blockbench-particles/SKILL.md) | Add Bedrock/Snowstorm particle effects, locators, and particle keyframes, and deliver them to a resource pack. |
| [blockbench-new-model](../plugins/blockbench-mcp/skills/blockbench-new-model/SKILL.md) | Start a new model or scene from an intake form and deliver a render-ready Blender scene with a render script; slash command `/blockbench-new-model`. |
| [blockbench-vanilla-textures](../plugins/blockbench-mcp/skills/blockbench-vanilla-textures/SKILL.md) | Fetch original Minecraft textures, resolve block IDs to faces, tint, tile, and import vanilla PBR sets. |
| [blockbench-gpt-image-textures](../plugins/blockbench-mcp/skills/blockbench-gpt-image-textures/SKILL.md) | Generate UV-aware texture atlases, skins, and tiles with GPT Image 2.5 on fal.ai (needs a fal.ai API key). |
| [blockbench-flipbook-textures](../plugins/blockbench-mcp/skills/blockbench-flipbook-textures/SKILL.md) | Create animated flipbook textures from generated sprite sheets. |
| [blockbench-albedo-to-pbr](../plugins/blockbench-mcp/skills/blockbench-albedo-to-pbr/SKILL.md) | Derive normal, height, and MER maps from an albedo texture with PyPBR or vgpu. |
| [blockbench-substance](../plugins/blockbench-mcp/skills/blockbench-substance/SKILL.md) | Optional Adobe Substance 3D Designer, Painter, and Automation Toolkit pipeline (needs Substance installed). |

## Install

The marketplace installs the plugin and all fifteen skills without a build.

For Codex:

```sh
codex plugin marketplace add jasonjgardner/blockbench-mcp-project --ref codex
codex plugin add blockbench-mcp@blockbench-mcp-project
```

For Claude Code:

```sh
claude plugin marketplace add jasonjgardner/blockbench-mcp-project@codex
claude plugin install blockbench-mcp@blockbench-mcp-project --scope user
```

See the [plugin README](../plugins/blockbench-mcp/README.md) for the local desktop
connection and a first inspection request.

## Loading order

1. Load `blockbench-use` before calls that create, modify, or export model content.
2. Load `blockbench-mcp-overview` when discovering capabilities or planning work
   across domains.
3. Load the relevant modeling, texturing, PBR, animation, Hytale, or headless skills through
   the sibling links in `blockbench-use`.

Tool prefixes vary between clients. The skills use semantic tool names and direct
agents to discover the registered tools available in the current session.

## Separate developer skill

[blockbench-development](blockbench-development/SKILL.md) covers writing Blockbench
JavaScript plugins, custom formats, and codecs. Its frontmatter name is
`blockbench-plugins`. It is maintained separately from the fifteen MCP usage skills
and is not included in the marketplace plugin.

The [main branch](https://github.com/jasonjgardner/blockbench-mcp-project/tree/main)
retains the original standalone skill layout and sample workspace.

## Authoring

Edit published skills directly in `plugins/blockbench-mcp/skills/`. Keep each
skill's frontmatter name aligned with its directory and use sibling `SKILL.md`
links when loading another packaged skill. Preserve client-independent tool
discovery and Apache-2.0 licensing. Validate changes with `bun run plugins:check`;
use `bun run plugins:package` to create the optional ZIP.
