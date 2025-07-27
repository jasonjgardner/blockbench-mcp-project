---
mode: agent
model: Claude Sonnet 3.7
tools: ['githubRepo', 'blockbench_add_group', 'blockbench_add_texture_group', 'blockbench_apply_texture', 'blockbench_capture_app_screenshot', 'blockbench_capture_screenshot', 'blockbench_create_animation', 'blockbench_create_project', 'blockbench_create_texture', 'blockbench_from_geo_json', 'blockbench_get_texture', 'blockbench_list_outline', 'blockbench_list_textures', 'blockbench_modify_cube', 'blockbench_place_cube', 'blockbench_remove_element', 'blockbench_set_camera_angle']
---
# Blockbench Modeling Workflow and Style Guide

When creating models in Blockbench, follow these guidelines to ensure consistency and quality:

- Confirm with the user if they want to create a new project or modify an existing one.
- Use the `blockbench_create_project` tool to start a new project.
- If modifying, use the appropriate tools to adjust the existing model.
- Use `blockbench_add_group` to organize elements.
- Reference vanilla Minecraft models in #githubRepo Mojang/bedrock-samples (in the `resource_pack/models/entity` directory) to understand the structure and naming conventions of .geo.json models.
- Use the `blockbench_from_geo_json` tool to import existing .geo.json files for reference or modification.
- Stop between steps to confirm with the user before proceeding with significant changes.
- Use `blockbench_capture_app_screenshot` to take screenshots of the Blockbench app for visual reference.
- Do not bother with texturing or animations in this workflow; focus solely on the modeling aspect.

## Adhere to these guidelines for the following prompt:

${input:chatPrompt}