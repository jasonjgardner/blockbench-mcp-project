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

## Skills

The [`skills/`](./skills) directory ships a set of Agent Skills that teach Claude (or any compatible client) how to drive the Blockbench MCP server productively. See [skills/README.md](./skills/README.md) for the full index.

| Skill | Purpose |
|-------|---------|
| [`blockbench-use`](./skills/blockbench-use) | **Mandatory orchestrator** — load before any `mcp__blockbench__*` call. Routes to the right sub-skill and enforces pre-flight checks, checkpoints, and exports. |
| [`blockbench-mcp-overview`](./skills/blockbench-mcp-overview) | High-level tour of the MCP server's tools, resources, and prompts. Start here when onboarding to a new Blockbench project. |
| [`blockbench-modeling`](./skills/blockbench-modeling) | Build geometry — cubes, meshes, spheres, cylinders — and edit vertices, faces, and groups. |
| [`blockbench-texturing`](./skills/blockbench-texturing) | Create and paint textures, manage UVs, brushes, layers, fills, gradients, and shapes. |
| [`blockbench-pbr-materials`](./skills/blockbench-pbr-materials) | Author PBR materials for Minecraft Bedrock RTX (normal / height / MER maps, `texture_set.json`). |
| [`blockbench-animation`](./skills/blockbench-animation) | Create animations, keyframes, bone rigs, and animation curves. |
| [`blockbench-hytale`](./skills/blockbench-hytale) | Hytale-specific models and animations (attachments, shading modes, quads, visibility keyframes). Requires the Hytale Blockbench plugin. |
| [`blockbench-development`](./skills/blockbench-development) | Build Blockbench plugins/extensions themselves — actions, dialogs, panels, menus, custom formats and codecs. |

### Install

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
