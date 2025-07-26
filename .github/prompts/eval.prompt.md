---
mode: agent
model: Claude Sonnet 4
description: "Execute code directly in Blockbench to create, modify, or apply textures."
tools: ['githubRepo', 'blockbench_capture_app_screenshot', 'blockbench_capture_screenshot', 'blockbench_from_geo_json', 'blockbench_risky_eval']
---

- Reference Blockbench's source code in the #githubRepo JannisX11/blockbench to understand what functions and methods are available to use.
- Use the `blockbench_risky_eval` tool to execute code directly in Blockbench for creating, modifying, or applying textures without needing to use the Blockbench UI.
- When using `blockbench_risky_eval`, NEVER include comments in the code.
- Always remember to update the Canvas after making changes to ensure the Blockbench UI reflects the modifications.
- Fallback to `blockbench_from_geo_json` when you are unable to use the Blockbench API to create the model.

${input:chatPrompt}