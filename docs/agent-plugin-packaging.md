# Packaging the Codex and Claude Code plugin

The `codex` branch contains the marketplace catalogs and a complete plugin at
[`plugins/blockbench-mcp/`](../plugins/blockbench-mcp/README.md). Its seven MCP
skills are checked in under `plugins/blockbench-mcp/skills/` and loaded directly
by both clients. Marketplace installation requires no build.

The desktop MCP server is maintained separately in the
[Blockbench MCP plugin repository](https://github.com/jasonjgardner/blockbench-mcp-plugin).
The agent plugin connects to that server running inside Blockbench desktop.

## Install from the marketplace

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

Claude's GitHub marketplace syntax selects a branch with `@codex`; see the
[marketplace reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplace-add).
Both catalogs name this marketplace `blockbench-mcp-project` and point to the
same `plugins/blockbench-mcp/` directory.

For a local Claude session, run these commands from this branch's checkout root:

```sh
claude plugin validate ./plugins/blockbench-mcp --strict
claude --plugin-dir ./plugins/blockbench-mcp
```

Follow the [plugin README](../plugins/blockbench-mcp/README.md) for desktop setup
and a read-only connection check.

## Validate or build a ZIP

From this branch's checkout root, with Bun available:

```sh
bun run plugins:check
bun run plugins:package
```

The equivalent direct script commands are:

```sh
bun run build/package-agent-plugin.ts --check
bun run build/package-agent-plugin.ts
```

Bun handles validation, file I/O, and SHA-256 checksums. Archive creation uses
Windows PowerShell (`powershell.exe`) with .NET's `ZipArchive` on Windows, or the
system `zip` command on macOS and Linux. Ensure that tool is available on `PATH`;
`plugins:check` only requires Bun. The build needs no npm dependencies, network
connection, or running Blockbench instance.

The build writes:

- `artifacts/agent-plugins/blockbench-mcp/`: a copy of the complete plugin.
- `artifacts/agent-plugins/blockbench-mcp-<version>.zip`: the plugin under a
  `blockbench-mcp/` archive directory.
- `artifacts/agent-plugins/blockbench-mcp-<version>.zip.sha256`: the archive checksum.

Only the explicit package file list is copied, including both client manifests,
the shared MCP connection, seven skills, licenses, and icon. Generated output is
ignored by Git. CI validates and builds the package for pushes and pull requests
targeting `codex`, then uploads the ZIP and checksum as an artifact.

The checker verifies manifest version agreement with `package.json`, required
files, the shared HTTP connection, skill names, and packaged documentation links.
Native client loading is a separate check. Building a ZIP does not install the
plugin or change client profiles.

## Maintain the plugin

Edit the published MCP skills directly in `plugins/blockbench-mcp/skills/`. Keep
these as the only source for the seven skills on this branch. The root
`skills/README.md` links to them; `skills/blockbench-development/` remains a
separate developer skill outside the plugin's file list.

Edit client manifests, the shared `.mcp.json`, README, icon, and package notices
in `plugins/blockbench-mcp/`. The marketplace catalogs are
`.agents/plugins/marketplace.json` for Codex and
`.claude-plugin/marketplace.json` for Claude Code. Both must keep pointing to the
checked-in plugin directory.

Preserve the Apache-2.0 skill license and the existing GPL-3.0-only notices for the
packaging metadata and icon. Keep the versions in `package.json` and both plugin
manifests aligned; these describe the agent package release, while the desktop
server is versioned separately.

After changing package sources, run `bun run plugins:check` and
`bun run plugins:package`, then check discovery in both clients with Blockbench
running.
