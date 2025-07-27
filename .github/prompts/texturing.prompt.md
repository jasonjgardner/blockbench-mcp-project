---
mode: agent
tools: ['codebase', 'fetch', 'search', 'searchResults', 'get_file_contents', 'list_branches', 'list_tags', 'search_code', 'directory_tree', 'get_file_info', 'list_allowed_directories', 'list_directory', 'read_file', 'read_multiple_files', 'search_files', 'blockbench_add_texture_group', 'blockbench_apply_texture', 'blockbench_create_texture', 'blockbench_get_texture', 'blockbench_list_textures']
---

## When creating textures in Blockbench, follow these guidelines to ensure consistency and quality:

- Confirm with the user if they want to create a new texture, use a placeholder texture, a default texture, or an existing, local texture.

### Loading Existing/Local Textures

- Search within the workspace directory's `resource_pack/textures` folder for existing textures using the `search_files` tool.
- Provide the full file path as the `data` parameter of the `blockbench_create_texture` tool to load the texture into Blockbench.

#### Fetching Vanilla Textures

- Default Minecraft textures can be found in the #githubRepo Mojang/bedrock-samples, under the `resource_pack/textures` directory. (Use `textures/blocks`, `textures/items`, or `textures/entity` as needed.)
- Use the `fetch` tool to download textures from the Mojang repository if they are not present in the local workspace.

### Creating New Textures

- Use the `blockbench_create_texture` tool to create a new texture.
- Specify the texture's name, width, and height. Use power-of-two dimensions (e.g., 16, 32, 64, 128, etc.) for compatibility with Minecraft. The name should be unique, and both human and machine-readable, so it can be referenced later.
- **DO NOT** attempt to generate data URLs.
- The `fill_color` parameter can be used to set a default color for the texture. It accepts named, RGB, or hex color values (e.g., `red`, `#FF0000`, `rgb(255, 0, 0)`).
- The `layer_name` parameter MUST be provided WHEN the `fill_color` parameter is used.

## Adhere to these guidelines for the following prompt:

${input:chatPrompt}