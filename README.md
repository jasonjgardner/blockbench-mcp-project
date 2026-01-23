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

```bash
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-animation
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-modeling
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-texturing
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-pbr-materials
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-mcp-overview
npx skills add https://github.com/jasonjgardner/blockbench-mcp-project --skill blockbench-hytale
```
