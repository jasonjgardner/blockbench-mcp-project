# License notices

The eight bundled skills are maintained in `plugins/blockbench-mcp/skills/` on the
[`codex` branch](https://github.com/jasonjgardner/blockbench-mcp-project/tree/codex).
Git installations and ZIP builds use those same files. They retain the project's
[Apache License, Version 2.0](licenses/Apache-2.0.txt).

The plugin metadata originated in the
[Blockbench MCP server repository](https://github.com/jasonjgardner/blockbench-mcp-plugin),
maintained by Jason J. Gardner under [GPL-3.0-only](LICENSE). Its relocation here
does not change its license. The separately installed Blockbench desktop server
remains in that repository and is not bundled in this agent package. The
headless server is likewise not bundled: `.mcp.json` runs the released package
`github:jasonjgardner/blockbench-mcp-plugin` (GPL-3.0-only) through `npx` at run
time, and this repository distributes only the configuration that launches it.

The ID mark in `assets/plugin-logo.png` was supplied by Jason J. Gardner for use
as this plugin's icon and logo. It replaces the icon from the desktop server
repository.

The package contains eight MCP workflow skills. Developer skills, example resource
packs, and legacy `.claude/skills` copies are not included.
