# Blockbench MCP Sample Project

This repository serves as a template or example of how to create a workspace which sets up the [Blockbench MCP server](https://github.com/jasonjgardner/blockbench-mcp-plugin/) for success.

> Note: In this example repository, the MCP port in Blockbench is set to __`5007`__ and the endpoint is __`mcp`__. This is different than the default values.

## Start Blockbench

Desktop version of Blockbench must be running in the background.

## IDE Setup Examples

### VS Code

See the files in the [.vscode](./.vscode) and [.github](./.github) directories.

### Claude Code

```bash
claude mcp add blockbench npx mcp-remote http://localhost:5007/mcp
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
        "http://localhost:5007/mcp"
      ]
    }
  }
}
```