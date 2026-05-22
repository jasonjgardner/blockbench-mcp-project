# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Blockbench MCP (Model Context Protocol) sample project that serves as a template for creating workspaces compatible with the [Blockbench MCP server](https://github.com/jasonjgardner/blockbench-mcp-plugin/). The repository contains Minecraft resource pack assets designed for use with Blockbench modeling software.

## Project Structure

```
resource_pack/
├── models/
│   ├── blocks/           # Block geometry definitions
│   │   └── basic_block.geo.json
│   └── entity/           # Entity geometry definitions
│       └── llama.geo.json
└── textures/
    ├── blocks/           # Block textures and materials
    │   ├── block.texture_set.json
    │   ├── block_mer.png
    │   ├── block_normal.png
    │   └── block_texture.png
    └── entity/           # Entity textures
        └── llama.png
```

## File Formats and Architecture

### Geometry Files (.geo.json)
- Follow Minecraft Bedrock Edition geometry format (version 1.12.0)
- Contain bone hierarchies, pivot points, and UV mappings
- Located in `resource_pack/models/` with subdirectories for `blocks/` and `entity/`

### Texture Set Files (.texture_set.json)
- Define PBR material properties using format version 1.21.30
- Map color, metalness/emissive/roughness (MER), and normal textures
- Located in `resource_pack/textures/blocks/`

### Texture Assets
- PNG format for color, normal, and MER maps
- Standard 16x16 resolution for blocks, variable for entities
- Organized by asset type (blocks vs entities)

## Development Workflow

This project contains static asset files with no build process, testing framework, or compilation steps. Changes involve:

1. **Geometry Editing**: Modify `.geo.json` files for 3D model structure
2. **Texture Updates**: Replace PNG files or update texture set configurations
3. **Asset Organization**: Maintain the directory structure for proper resource pack function

## Key Considerations

- All geometry files use Minecraft Bedrock format specifications
- Texture sets support PBR rendering with separate maps for different material properties
- File paths and identifiers in geometry files must match the directory structure
- UV coordinates in geometry files correspond to texture dimensions

## License

This project is licensed under the Apache License 2.0.