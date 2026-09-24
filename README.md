# Blockbench MCP for Codex and Claude Code

The `codex` branch is the plugin marketplace for connecting your coding agent to
Blockbench desktop or to the headless `.bbmodel` server. It includes both MCP
connections and eight skills for modeling, texturing, animation, PBR materials,
Hytale, and headless file workflows. The complete plugin is
checked in at [`plugins/blockbench-mcp/`](plugins/blockbench-mcp/README.md), so
installation does not require a build.

## Install in Codex

```sh
codex plugin marketplace add jasonjgardner/blockbench-mcp-project --ref codex
codex plugin add blockbench-mcp@blockbench-mcp-project
```

Start a new Codex conversation after installation and load the `blockbench-use`
skill to begin working with your open model.

## Install in Claude Code

```sh
claude plugin marketplace add jasonjgardner/blockbench-mcp-project@codex
claude plugin install blockbench-mcp@blockbench-mcp-project --scope user
```

Claude's GitHub marketplace syntax uses `@codex` to select the branch. See the
[Claude marketplace reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplace-add).

From a local checkout of this branch, you can also load the plugin for one session:

```sh
claude plugin validate ./plugins/blockbench-mcp --strict
claude --plugin-dir ./plugins/blockbench-mcp
```

## Connect to Blockbench

1. Open **Blockbench desktop** on the computer running the agent's MCP client.
2. Load [the desktop MCP plugin](https://jasonjgardner.github.io/blockbench-mcp-plugin/mcp.js)
   through **File > Plugins > Load Plugin from URL**.
3. Keep Blockbench open. The shared connection uses `http://localhost:3000/bb-mcp`,
   matching the default port and endpoint in Blockbench settings.
4. Ask the agent to inspect your open model using `get_capabilities` and
   `list_outline`. These calls can verify the connection without editing the model.

In Claude Code, check `/mcp` and try:

```text
/blockbench-mcp:blockbench-use Inspect my open model and summarize its format and contents.
```

## Headless server

The plugin also registers `blockbench-headless`, a stdio MCP server that edits,
validates, and renders `.bbmodel` files without Blockbench, so several agents can
work in parallel. It starts through `npx` (Node only) with `--root .`, which limits
it to the folder your client started in. Load the `blockbench-headless` skill to use
it. Rendering needs Node 23.6+ and a GPU. See the
[plugin README](plugins/blockbench-mcp/README.md#headless-server) for the sandbox
root, Windows, and registration options.

The [plugin README](plugins/blockbench-mcp/README.md) covers connection settings,
skills, and troubleshooting. The desktop MCP server is maintained in the separate
[Blockbench MCP plugin repository](https://github.com/jasonjgardner/blockbench-mcp-plugin).

## Maintain or package the plugin

The eight published MCP skills live in `plugins/blockbench-mcp/skills/`. Edit those
files directly; they are the source loaded by both clients. See the
[skill index](skills/README.md) for the included skills and the separate developer
skill.

Bun can validate the checked-in plugin and optionally create a ZIP with a SHA-256
checksum:

```sh
bun run plugins:check
bun run plugins:package
```

ZIP creation uses Windows PowerShell on Windows or the system `zip` command on
macOS and Linux. See [packaging instructions](docs/agent-plugin-packaging.md).
CI validates and packages changes to this branch.

The [main branch](https://github.com/jasonjgardner/blockbench-mcp-project/tree/main)
contains the original sample workspace and standalone skills. This branch keeps
the installable marketplace catalogs and plugin together.
