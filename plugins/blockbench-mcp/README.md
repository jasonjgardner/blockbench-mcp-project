# Blockbench MCP for Codex and Claude Code

Connect your coding agent to Blockbench desktop, or to the headless `.bbmodel`
server, and use fifteen skills to create, inspect, texture, animate, validate, and
render models. This directory is a complete plugin for both clients, checked into the `codex` marketplace branch. Installation requires
no build.

## Install in Codex

```sh
codex plugin marketplace add jasonjgardner/blockbench-mcp-project --ref codex
codex plugin add blockbench-mcp@blockbench-mcp-project
```

Start a new Codex conversation after installation and load `blockbench-use`.

## Install in Claude Code

```sh
claude plugin marketplace add jasonjgardner/blockbench-mcp-project@codex
claude plugin install blockbench-mcp@blockbench-mcp-project --scope user
```

Claude's GitHub marketplace shorthand uses `@codex` to select the branch. See the
[Claude marketplace reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplace-add).

From a checkout of the `codex` branch, you can validate and load the plugin for a
single Claude session:

```sh
claude plugin validate ./plugins/blockbench-mcp --strict
claude --plugin-dir ./plugins/blockbench-mcp
```

If you downloaded the optional ZIP, extract it and use `./blockbench-mcp` in those
commands from the directory containing the extracted folder.

## Two MCP servers

[.mcp.json](.mcp.json) registers both servers. Use the desktop server for the
model open in Blockbench and the headless server for files on disk.

| Server | Transport | Works on | Needs |
| --- | --- | --- | --- |
| `blockbench` | HTTP, `http://localhost:3000/bb-mcp` | The project open in Blockbench desktop | Blockbench running with the desktop MCP plugin |
| `blockbench-headless` | stdio, started by `npx` | `.bbmodel` files under its `--root` folder | Node.js; no Blockbench |

If the desktop app is closed, its server simply shows as unavailable; the headless
server still works, and the reverse. Skills discover whichever tools are connected.

## Headless server

The headless server edits, validates, converts, and renders `.bbmodel` files
without Blockbench. Each agent gets its own server process, so several agents can
build different models at the same time while you keep working in the editor.
Its tools are named `bbmodel_*`, plus `blockbench_launch`. Load
[blockbench-headless](skills/blockbench-headless/SKILL.md) to use it.

The plugin starts it with:

```sh
npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root .
```

- **Sandbox.** `--root` is required and limits every read and write to that
  folder, including through symbolic links. `.` means the folder the client
  started in. Some clients start servers in your home directory; if yours does,
  register the server yourself with a project folder instead (below) and turn off
  the bundled entry.
- **First start.** `npx` downloads the package from GitHub, so the first launch
  takes a moment and needs network access. Only Node is required; the launcher
  installs its own Bun. The tag pins the server version; headless mode ships from
  1.9, and older tags do not include it.
- **Windows.** A client that cannot start `.cmd` shims needs the command
  `cmd` with arguments `/c npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root .`.
- **Rendering.** `bbmodel_render` and `bbmodel_contact_sheet` need Node 23.6+ with
  npm and a GPU. The first render installs about 130 MB of packages into a
  per-user cache folder; set `BB_RENDER_HOME` to move it. Every other tool works
  without them.
- **Files open in Blockbench.** Blockbench does not reload a file changed on
  disk. Reopen it after headless edits, and do not edit one file in both at once.

Register it yourself with a chosen folder:

```sh
codex mcp add blockbench-headless -- npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root "/path/to/models"
claude mcp add blockbench-headless -- npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root "/path/to/models"
```

Choose one registration per client so the tools are not listed twice. See the
[server's headless documentation](https://github.com/jasonjgardner/blockbench-mcp-plugin/blob/main/headless/README.md)
for every option and the full tool list.

## Before connecting to the desktop app

1. Open **Blockbench desktop** on the computer running the agent's MCP client.
2. In **File > Plugins > Load Plugin from URL**, load
   [the Blockbench MCP desktop plugin](https://jasonjgardner.github.io/blockbench-mcp-plugin/mcp.js).
   Developers can instead load their locally built `dist/mcp.js` from the server repository.
3. Keep Blockbench open. The connection in [.mcp.json](.mcp.json) uses
   `http://localhost:3000/bb-mcp`, matching the default MCP Server Port and
   MCP Server Endpoint in Blockbench settings.

This agent package contains the MCP connections and skills. The desktop server
executes inside Blockbench; installing this package does not install or start
Blockbench.
For a custom port or endpoint, change `.mcp.json` in your source copy before
installing it. `localhost` refers to the MCP client's computer; a hosted agent or
separate container needs an explicitly configured connection to your desktop.

In Claude Code, check `/mcp` for the Blockbench connection, then try:

```text
/blockbench-mcp:blockbench-use Inspect my open model and summarize its format and contents.
```

For the headless server, try:

```text
/blockbench-mcp:blockbench-headless Create models/crate.bbmodel as a 16-unit wooden crate, validate it, and render a contact sheet.
```

## Included skills

| Skill | Purpose |
| --- | --- |
| [blockbench-use](skills/blockbench-use/SKILL.md) | Route tasks and check the active project and supported formats |
| [blockbench-mcp-overview](skills/blockbench-mcp-overview/SKILL.md) | Discover tools and plan MCP workflows |
| [blockbench-modeling](skills/blockbench-modeling/SKILL.md) | Build cubes, meshes, groups, and model hierarchies |
| [blockbench-texturing](skills/blockbench-texturing/SKILL.md) | Create textures, paint, work with UVs, and assign materials |
| [blockbench-pbr-materials](skills/blockbench-pbr-materials/SKILL.md) | Work with normal, height, and MER material channels |
| [blockbench-animation](skills/blockbench-animation/SKILL.md) | Rig models and edit animations and keyframes |
| [blockbench-hytale](skills/blockbench-hytale/SKILL.md) | Use Hytale model, animation, and attachment workflows |
| [blockbench-headless](skills/blockbench-headless/SKILL.md) | Build, validate, convert, and render `.bbmodel` files without Blockbench; parallel agents and particle effects |
| [blockbench-particles](skills/blockbench-particles/SKILL.md) | Add Bedrock/Snowstorm particle effects, locators, and particle keyframes, and deliver them to a resource pack |
| [blockbench-new-model](skills/blockbench-new-model/SKILL.md) | Start a new model or scene from an intake form and deliver a render-ready Blender scene with a render script; slash command `/blockbench-new-model` |
| [blockbench-vanilla-textures](skills/blockbench-vanilla-textures/SKILL.md) | Fetch original Minecraft textures, resolve block IDs to faces, tint, tile, and import vanilla PBR sets |
| [blockbench-gpt-image-textures](skills/blockbench-gpt-image-textures/SKILL.md) | Generate UV-aware texture atlases, skins, and tiles with GPT Image 2.5 on fal.ai (needs a fal.ai API key) |
| [blockbench-flipbook-textures](skills/blockbench-flipbook-textures/SKILL.md) | Create animated flipbook textures from generated sprite sheets |
| [blockbench-albedo-to-pbr](skills/blockbench-albedo-to-pbr/SKILL.md) | Derive normal, height, and MER maps from an albedo texture with PyPBR or vgpu |
| [blockbench-substance](skills/blockbench-substance/SKILL.md) | Optional Adobe Substance 3D Designer, Painter, and Automation Toolkit pipeline (needs Substance installed) |

Hytale workflows additionally require the Hytale plugin in Blockbench. Some skills
also ship helper scripts and use optional outside tools: Python for PyPBR and
Substance scripts, Node for the vgpu, vanilla-texture, and GPT Image scripts, a
fal.ai API key for GPT Image, Adobe Substance 3D for `blockbench-substance`, and
Blender plus FFmpeg for `blockbench-new-model`. The other skills work without them. Available
tools and formats depend on the running server; the skills discover them with
`get_capabilities`. Clients assign different MCP tool prefixes, so examples use
the short tool names and the skills resolve their callable equivalents.

## Verify the connection

Desktop: ask the agent to call `get_capabilities` with `include_tools: true`, then
inspect the open project with `list_outline`. Both checks can run without
modifying the model. Check the reported plugin version and that the expected
skills are listed.

Headless: ask the agent to call `bbmodel_info` on a `.bbmodel` file inside the
root folder. It is read-only. If the tools are missing, run the `npx` command above
in a terminal to see the error, then restart the client.

If the server is unavailable, verify Blockbench is open, the desktop plugin is
loaded, and its port/endpoint match `.mcp.json`. Reloading the desktop plugin
expires existing MCP sessions; reconnect the client afterward. If you already
configured Blockbench as a standalone MCP server, choose one connection to avoid
duplicate tool listings.

## Package contents and licensing

- `.codex-plugin/plugin.json`: Codex compatibility manifest and display metadata.
- `.claude-plugin/plugin.json`: Claude Code manifest.
- `.mcp.json`: Shared desktop HTTP connection and headless stdio server.
- `skills/`: The fifteen portable skills, with sibling links kept intact.
- `assets/plugin-logo.png`: Blockbench MCP ID mark, used as the plugin icon and logo.

The skills are maintained directly in this plugin's `skills/` directory on the
[agent project's codex branch](https://github.com/jasonjgardner/blockbench-mcp-project/tree/codex).
The optional Bun packaging build creates a ZIP from these checked-in files.

Packaging metadata retains the server repository's
[GPL-3.0-only license](LICENSE). The skills retain their
[Apache-2.0 license](licenses/Apache-2.0.txt). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for source attribution and changes.

Format references: [Codex packaging](https://developers.openai.com/plugins/build/plugins),
[Claude plugin reference](https://code.claude.com/docs/en/plugins-reference), and
[Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).
