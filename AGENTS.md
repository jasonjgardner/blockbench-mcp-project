# Blockbench MCP marketplace branch

This `codex` branch distributes the Blockbench MCP agent plugin for Codex and
Claude Code. The `main` branch retains the original sample workspace. The desktop
MCP server is developed separately in `jasonjgardner/blockbench-mcp-plugin`.

## Repository structure

- `.agents/plugins/marketplace.json`: Codex marketplace catalog.
- `.claude-plugin/marketplace.json`: Claude Code marketplace catalog.
- `plugins/blockbench-mcp/`: the complete, checked-in plugin for both clients.
- `plugins/blockbench-mcp/skills/`: the eight canonical MCP skills on this branch.
- `skills/README.md`: skill index; `skills/blockbench-development/` is a separate
  developer skill outside the published plugin.
- `build/`: Bun validation and optional ZIP packaging, with OS compression tools.
- `docs/agent-plugin-packaging.md`: installation and maintenance instructions.
- `artifacts/agent-plugins/`: ignored ZIP, checksum, and plugin build output.

## Maintaining the plugin

Edit the published skills directly under `plugins/blockbench-mcp/skills/`. Keep
one tracked source for each of the eight MCP skills on this branch. Both
marketplace catalogs must point to `./plugins/blockbench-mcp`; installations read
that directory directly and must not depend on generated artifacts.

`plugins/blockbench-mcp/.mcp.json` registers the desktop HTTP server and the
`blockbench-headless` stdio server. Keep the headless package pinned to a released
tag of `jasonjgardner/blockbench-mcp-plugin` (headless mode ships from 1.9) and
keep `--root` in its arguments; the checker enforces both.

Keep the version in `package.json` and both client manifests aligned. Preserve the
Apache-2.0 skill license and GPL-3.0-only notices for the packaging metadata.
Use `assets/plugin-logo.png` as the plugin icon and logo. Do not change personal
client profiles as part of a package build.

Use Bun for validation and packaging:

```sh
bun run plugins:check
bun run plugins:package
```

The checker requires only Bun. ZIP creation uses Windows PowerShell on Windows
or `zip` on macOS and Linux. Keep the build free of Python and npm dependencies.
Use strict TypeScript and document exported symbols. Prefer early returns and
explicitly narrowed types.

Native Claude validation can check the source plugin directly:

```sh
claude plugin validate ./plugins/blockbench-mcp --strict
claude --plugin-dir ./plugins/blockbench-mcp
```

## Working in Blockbench

For modeling, texturing, animation, or exports, load the packaged `blockbench-use`
skill and relevant domain skills before editing the scene. Use `blockbench-headless`
for `.bbmodel` files on disk or parallel agents. Discover the tools
exposed by the current MCP client and use their registered names. Inspect the
active project and format, preserve checkpoints for risky edits, and verify the
result with available inspection or screenshot tools.

Repository documentation and packaging changes use normal development tools and
do not require a live Blockbench connection. Use the MCP server when the task
involves the user's model or a requested live integration check. Explain failures
clearly and involve the user when missing runtime state prevents progress.
