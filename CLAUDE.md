# Claude Code guidance

This `codex` branch is the Blockbench MCP plugin marketplace. Follow
[AGENTS.md](AGENTS.md) for repository structure, maintenance rules, and Blockbench
workflows. The original sample workspace remains on `main`.

The complete plugin lives at `plugins/blockbench-mcp/`; its seven MCP skills are
maintained directly in `plugins/blockbench-mcp/skills/`. Both marketplace catalogs
load this checked-in directory. Installation does not require generated files.
The separate desktop MCP server is maintained in
[jasonjgardner/blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin).

## Install or load locally

```sh
claude plugin marketplace add jasonjgardner/blockbench-mcp-project@codex
claude plugin install blockbench-mcp@blockbench-mcp-project --scope user
```

For a local session from this checkout:

```sh
claude plugin validate ./plugins/blockbench-mcp --strict
claude --plugin-dir ./plugins/blockbench-mcp
```

Keep Blockbench desktop running with the desktop MCP plugin loaded. The shared
connection defaults to `http://localhost:3000/bb-mcp`. Discover tools through the
client and load `blockbench-use` before modifying or exporting model content.

## Validate and package

```sh
bun run plugins:check
bun run plugins:package
```

Validation uses Bun. The optional ZIP build uses Windows PowerShell on Windows or
`zip` on macOS and Linux and writes ignored output to `artifacts/agent-plugins/`.
See [packaging instructions](docs/agent-plugin-packaging.md).

The repository and skills retain Apache-2.0 licensing. The package preserves
GPL-3.0-only notices for metadata moved from the desktop server
repository; see [package notices](plugins/blockbench-mcp/THIRD_PARTY_NOTICES.md).
