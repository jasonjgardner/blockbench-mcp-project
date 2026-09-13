# Blockbench MCP for Codex and Claude Code

Connect your coding agent to Blockbench desktop and use seven skills to create,
inspect, texture, and animate models. This directory is a complete plugin for
both clients, checked into the `codex` marketplace branch. Installation requires
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

## Before connecting

1. Open **Blockbench desktop** on the computer running the agent's MCP client.
2. In **File > Plugins > Load Plugin from URL**, load
   [the Blockbench MCP desktop plugin](https://jasonjgardner.github.io/blockbench-mcp-plugin/mcp.js).
   Developers can instead load their locally built `dist/mcp.js` from the server repository.
3. Keep Blockbench open. The connection in [.mcp.json](.mcp.json) uses
   `http://localhost:3000/bb-mcp`, matching the default MCP Server Port and
   MCP Server Endpoint in Blockbench settings.

This agent package contains the MCP connection and skills. The server executes
inside Blockbench; installing this package does not install or start Blockbench.
For a custom port or endpoint, change `.mcp.json` in your source copy before
installing it. `localhost` refers to the MCP client's computer; a hosted agent or
separate container needs an explicitly configured connection to your desktop.

In Claude Code, check `/mcp` for the Blockbench connection, then try:

```text
/blockbench-mcp:blockbench-use Inspect my open model and summarize its format and contents.
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

Hytale workflows additionally require the Hytale plugin in Blockbench. Available
tools and formats depend on the running server; the skills discover them with
`get_capabilities`. Clients assign different MCP tool prefixes, so examples use
the short tool names and the skills resolve their callable equivalents.

## Verify the connection

Ask the agent to call `get_capabilities` with `include_tools: true`, then inspect
the open project with `list_outline`. Both checks can run without modifying the
model. Check the reported plugin version and that the expected skills are listed.

If the server is unavailable, verify Blockbench is open, the desktop plugin is
loaded, and its port/endpoint match `.mcp.json`. Reloading the desktop plugin
expires existing MCP sessions; reconnect the client afterward. If you already
configured Blockbench as a standalone MCP server, choose one connection to avoid
duplicate tool listings.

## Package contents and licensing

- `.codex-plugin/plugin.json`: Codex compatibility manifest and display metadata.
- `.claude-plugin/plugin.json`: Claude Code manifest.
- `.mcp.json`: Shared HTTP connection.
- `skills/`: The seven portable skills, with sibling links kept intact.
- `assets/icon.svg`: Blockbench MCP icon.

The skills are maintained directly in this plugin's `skills/` directory on the
[agent project's codex branch](https://github.com/jasonjgardner/blockbench-mcp-project/tree/codex).
The optional Bun packaging build creates a ZIP from these checked-in files.

Packaging metadata and the icon retain the server repository's
[GPL-3.0-only license](LICENSE). The skills retain their
[Apache-2.0 license](licenses/Apache-2.0.txt). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for source attribution and changes.

Format references: [Codex packaging](https://developers.openai.com/plugins/build/plugins),
[Claude plugin reference](https://code.claude.com/docs/en/plugins-reference), and
[Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).
