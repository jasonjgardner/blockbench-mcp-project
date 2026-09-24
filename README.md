# Blockbench MCP Sample Project

This repository serves as a template or example of how to create a workspace which sets up the [Blockbench MCP server](https://github.com/jasonjgardner/blockbench-mcp-plugin/) for success.

> __Note:__ In this example repository, the MCP port in Blockbench is set to __`3000`__ and the endpoint is __`bb-mcp`__. These are the default values, but can be changed within the plugin's settings in Blockbench.

## Start Blockbench

Desktop version of Blockbench must be running in the background.

## IDE Setup Examples

### VS Code

See the files in the [.vscode](./.vscode) and [.github](./.github) directories.

### Claude Code

```bash
claude mcp add blockbench npx mcp-remote http://localhost:3000/bb-mcp
```

### Cline

__cline_mcp_settings.json__
```json
{
  "mcpServers": {
    "blockbench": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/bb-mcp"
      ]
    }
  }
}
```

## Babylon.js MCP Servers

The workspace also configures the [Babylon.js MCP servers](https://doc.babylonjs.com/toolsAndResources/mcpServers/) (`@babylonjs/mcp-servers`, pinned to `9.26.2`). They build Babylon.js editor graphs that pair with Blockbench assets. For example, a Node Material can drive a Bedrock `texture_set` in Babylon, and a particle system can add effects to an exported model. See [docs/research/babylonjs-mcp-integration.md](./docs/research/babylonjs-mcp-integration.md) for workflows.

| Server | Dispatcher | Default |
|--------|------------|---------|
| `babylonjs-node-material` | `nme` | on |
| `babylonjs-node-geometry` | `nge` | on |
| `babylonjs-node-particle` | `npe` | on |
| `babylonjs-gui` | `gui` | opt-in |
| `babylonjs-flow-graph` | `flow-graph` | opt-in |
| `babylonjs-node-render-graph` | `nrge` | opt-in |
| `babylonjs-smart-filters` | `smart-filters` | opt-in |

- **Claude Code:** [`.mcp.json`](./.mcp.json) defines every server. [`.claude/settings.json`](./.claude/settings.json) turns the opt-in ones off; move a name from `disabledMcpjsonServers` to `enabledMcpjsonServers` to use it.
- **OpenCode:** [`opencode.jsonc`](./opencode.jsonc). Set `enabled` per server.
- **VS Code:** [`.vscode/mcp.json`](./.vscode/mcp.json) lists all seven. Stop the ones you don't need from the MCP server list, since each one adds 24–29 tools.

Requirements and gotchas:

- Node.js `^20.19`, `^22.13` or `^24`. Odd-numbered releases such as 23.x print an engine warning.
- On Windows, if the client can't resolve `npx`, use `C:\Program Files\nodejs\npx.cmd` (or `cmd /c npx`) as the command.
- Each graph server's live editor session listens on `localhost:3001` by default. Keep Blockbench's MCP port on `3000`.
- `save_snippet` uploads the graph to the public Babylon.js Snippet Server. Use `export_*_json` with an `outputFile` for private work.

## Skills

The [`skills/`](./skills) directory ships a set of Agent Skills that teach Claude (or any compatible client) how to drive the Blockbench MCP server productively. See [skills/README.md](./skills/README.md) for the full index.

| Skill | Purpose |
|-------|---------|
| [`blockbench-use`](./skills/blockbench-use) | **Mandatory orchestrator** — load before any `mcp__blockbench__*` call. Routes to the right sub-skill and enforces pre-flight checks, checkpoints, and exports. |
| [`blockbench-new-model`](./skills/blockbench-new-model) | `/blockbench-new-model [subject]`: intake form, headless `.bbmodel` build, Blender scene, and a `render.cmd` that renders on every GPU and assembles the video with FFmpeg. |
| [`blockbench-mcp-overview`](./skills/blockbench-mcp-overview) | High-level tour of the MCP server's tools, resources, and prompts. Start here when onboarding to a new Blockbench project. |
| [`blockbench-modeling`](./skills/blockbench-modeling) | Build geometry — cubes, meshes, spheres, cylinders — and edit vertices, faces, and groups. |
| [`blockbench-texturing`](./skills/blockbench-texturing) | Create and paint textures, manage UVs, brushes, layers, fills, gradients, and shapes. |
| [`blockbench-pbr-materials`](./skills/blockbench-pbr-materials) | Author PBR materials for Minecraft Bedrock RTX (normal / height / MER maps, `texture_set.json`). |
| [`blockbench-animation`](./skills/blockbench-animation) | Create animations, keyframes, bone rigs, and animation curves. |
| [`blockbench-hytale`](./skills/blockbench-hytale) | Hytale-specific models and animations (attachments, shading modes, quads, visibility keyframes). Requires the Hytale Blockbench plugin. |
| [`blockbench-gpt-image-textures`](./skills/blockbench-gpt-image-textures) | AI-generate textures with GPT Image 2.5 (Flare / Sunburst) on fal.ai, with the model's UV layout written into the prompt. Requires a `FAL_KEY`. |
| [`blockbench-flipbook-textures`](./skills/blockbench-flipbook-textures) | Generate animated texture sheets with the GPT Image 2.5 texture skill, convert them to vertical flipbook PNGs with Pillow, and configure Blockbench/Minecraft playback. |
| [`blockbench-albedo-to-normal`](./skills/blockbench-albedo-to-normal) | Derive height, normal and packed MER (metalness / emissive / roughness) maps from a color texture with PyPBR (Python) or vgpu + Dawn WebGPU (Node.js), optionally estimating height with Depth Anything V2. Use after `blockbench-gpt-image-textures` or hand painting. |
| [`blockbench-development`](./skills/blockbench-development) | Build Blockbench plugins/extensions themselves — actions, dialogs, panels, menus, custom formats and codecs. |

### Install

```bash
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-use
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-mcp-overview
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-new-model
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-modeling
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-texturing
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-pbr-materials
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-animation
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-hytale
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-gpt-image-textures
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-flipbook-textures
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-albedo-to-normal
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-development
```
