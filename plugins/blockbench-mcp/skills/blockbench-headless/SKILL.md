---
name: blockbench-headless
description: "Build, check, convert and render Blockbench .bbmodel files on disk with the headless Blockbench MCP server (bbmodel_* tools) — no Blockbench app needed, and several agents can work in parallel. Use for batch or parallel model work, validating geometry and animations, rendering previews and contact sheets, exporting Bedrock geometry / Java block / modded entity code, Bedrock particle effects, and web-app links. Trigger on: bbmodel_create, bbmodel_edit, bbmodel_validate, bbmodel_render, bbmodel_contact_sheet, 'headless', '.bbmodel file', 'without opening Blockbench', 'parallel agents building models'."
license: Apache-2.0
---

# Blockbench Headless

The headless server is a second, separate MCP server (`blockbench-headless`) that reads and writes `.bbmodel` files directly. It never touches the Blockbench app, so each agent can run its own process and build a different file at the same time while the user keeps editing in Blockbench.

Tool names below are semantic. Discover the tools your client exposes (for example `mcp__blockbench-headless__bbmodel_edit`) and read their live schemas rather than assuming parameters. Read [Blockbench use](../blockbench-use/SKILL.md) first to decide between this server and the desktop server.

## Headless or desktop?

| Need | Use |
|---|---|
| Work on files in a folder; several agents at once; CI-style checks; renders without a GPU-heavy app open | **Headless** (`bbmodel_*`) |
| Edit the model the user has open right now; paint with brushes; drive the live timeline; Hytale tools; screenshots of the editor | **Desktop** (`get_capabilities`, `list_outline`, …) |
| Both: build headless, then show the user | Headless edit → `bbmodel_web_url` or `blockbench_launch` |

The two servers are independent. A file open in Blockbench does **not** reload after a headless edit, and editing the same file in both at once loses work. Tell the user to reopen the file, or use `blockbench_launch` to open it as a new tab.

## Connection check

The plugin registers the server in `.mcp.json` with `npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root .`. Only Node is required; the launcher installs its own Bun.

1. Call `bbmodel_info` on a file, or `bbmodel_create` on a scratch path, to confirm the server answers. The first start downloads the package and can take a minute.
2. `--root .` is the folder the client started in. The server refuses any path outside its roots, including through symbolic links. If the client started in the home directory, the sandbox is the whole home directory: ask the user for a project folder and give them a `--root <folder>` registration instead.
3. If the tools are missing, the server did not start. Give the user the command and stop; a server added mid-session usually needs a client restart:

```sh
codex mcp add blockbench-headless -- npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root "<project folder>"
claude mcp add blockbench-headless -- npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root "<project folder>"
```

On Windows, clients that cannot launch `.cmd` shims need `cmd /c npx …`. Headless mode ships from plugin version 1.9; older tags do not include it.

## Tools

| Group | Tools |
|---|---|
| Read | `bbmodel_info`, `bbmodel_outline`, `bbmodel_find_elements`, `bbmodel_get_node`, `bbmodel_list_textures`, `bbmodel_list_animations`, `bbmodel_sample_pose` |
| Write | `bbmodel_create`, `bbmodel_edit` (batched operations, atomic), `bbmodel_add_texture` |
| Check | `bbmodel_validate` (geometry gates), `bbmodel_validate_animations` |
| Render | `bbmodel_render` (one view), `bbmodel_contact_sheet` (several views) |
| Export / convert | `bbmodel_export_bedrock_geometry`, `bbmodel_export_java_block`, `bbmodel_import_java_block`, `bbmodel_export_modded_entity`, `bbmodel_convert_legacy` |
| Particles | `bbmodel_particle_effect`, `bbmodel_particle_pack` |
| Hand-off | `bbmodel_web_url`, `blockbench_launch` |

### `bbmodel_edit` operations

One call applies up to 500 operations in order and writes once. If any operation fails, nothing is written and the error names the operation. Nodes, textures and animations are addressed by UUID or exact name; coordinates are absolute model units; rotations are degrees.

- **Structure:** `add_group`, `add_cube`, `update_node` (also re-parents), `remove_node`, `set_model_properties`.
- **Meshes** (Generic `free` format only): `add_mesh`, `add_mesh_primitive` (cuboid, beveled_cuboid, pyramid, plane, circle, cylinder, tube, cone, sphere, icosphere, octahedron, dodecahedron, torus), `edit_mesh` (vertex, face, extrude, subdivide, loop-cut actions), `map_mesh_uv` (auto, axis projection or explicit).
- **Textures and materials:** `add_texture`, `update_texture` (replace an image, `wrap_mode`, emissive `render_mode`), `add_material`, `update_material`, `assign_texture`. PBR channels (color, normal or height, MER) go through a material; assign only color textures to faces.
- **Animation:** `add_animation`, `remove_animation`, `set_keyframe`, `remove_keyframe`.
- **Particles:** `add_locator`, `set_particle_keyframe`, `remove_particle_keyframe`.

The batch is refused when touched nodes break the model format's limits (meshes outside `free`; `java_block` cubes outside -16..32 or with rotations its version disallows; forced box UV and integer sizes). Softer issues come back as `format_warnings`. Fix and resend.

## Workflow

1. `bbmodel_create` with the target `format` (`free` unless the plan names another, such as `bedrock`, `bedrock_block`, `java_block`, `geckolib_model`, `modded_entity`).
2. Block out the silhouette with `bbmodel_edit`, then refine. Silhouette before detail.
3. `bbmodel_validate` and `bbmodel_contact_sheet` after each major pass. Fix floating parts, gaps and scale before texturing. `self_test: true` proves each gate still detects its defect on this model.
4. Textures: `bbmodel_add_texture` embeds a PNG; PBR maps go through `add_material`. Follow [Blockbench texturing](../blockbench-texturing/SKILL.md) and [Blockbench PBR materials](../blockbench-pbr-materials/SKILL.md) for UV scale and channel rules; those skills' desktop tool names do not apply here.
5. Animation with `add_animation` / `set_keyframe`, then `bbmodel_validate_animations` and `bbmodel_render` or `bbmodel_contact_sheet` with `clip` and `time` to check poses. See [Blockbench animation](../blockbench-animation/SKILL.md) for rig conventions.
6. Deliver: export with the matching `bbmodel_export_*` tool, and give the user the `web_app` link that write tools return (see below). Look at every render before calling the work done.

## Revisions: several agents, one file

Every read returns a `revision`. Pass it as `expected_revision` on the next write. If another agent changed the file in the meantime the write is refused instead of overwriting their work; re-read and reapply. Writes go to a temporary file and are renamed into place, so readers never see a half-written file.

For parallel work, give each subagent its **own file** and tell it not to touch the others. Every brief should include the subject and shared style decisions, real-world size in model units, texel density and texture size, the file path it owns, and the checks it must return (validate result, a contact sheet, element count).

## Validation

- `bbmodel_validate` gates: outliner, unlisted nodes, degenerate cubes (slivers, inverted), block limits, floating parts, interpenetration, left/right mirror. Use `free_elements` for deliberately detached parts and `asymmetric` for intentionally uneven ones. GeckoLib rules run automatically for `geckolib_model`.
- Interpenetration uses world-space boxes, so rotated cubes can give false positives, and a cube exactly 0.2 units thick can trip the degenerate check through float error. Confirm visually before "fixing" them.
- `bbmodel_validate_animations` samples each clip and flags parts sinking below the ground or limbs detaching from their parent. Bezier keys are sampled as straight lines and Molang channels are skipped; both are listed in the result.

## Rendering

`bbmodel_render` and `bbmodel_contact_sheet` use a built-in WebGPU renderer. It needs **Node 23.6+ with npm and a GPU**; every other tool works without them.

- The first render installs `three`, `three-blockbench` and Dawn (about 130 MB) into a per-user cache folder. Expect a minute or more, and do not treat that wait as a hang. Set `BB_RENDER_HOME` (or `--render-home`) before the first render if the system drive is short on space.
- It renders PNG stills only; embedded textures must be PNG and not interlaced. Render motion as stills at several clip times. Video, path tracing and glTF/USD need an external bb-render build (`--bb-render` / `BB_RENDER_CLI`).
- A failed install returns "The render engine is not available: …" with the cause. Fix it and call again.
- Views are relative to the model's front (-Z): `front`, `back`, `left`, `right`, `three-quarter`, `iso`, `top`. Optional presets: `showcase`, `turntable`, `icon` (orthographic, transparent), `sprite-sheet-frame`. Pass `clip` and `time` to pose an animation.

## Particles

Bedrock particle effects (the Snowstorm format) are written next to the model:

1. `bbmodel_particle_effect` with `action: "create"`, an `identifier`, and either a `preset` or `design` knobs (blocks and seconds). It validates before writing to `<pack_root>/particles/<name>.json`. Pass `model` to get the keyframe path relative to the `.bbmodel`. `action: "update"` changes only the components a knob owns.
2. `bbmodel_edit` with `add_locator` (where the effect spawns) and `set_particle_keyframe` (animation, time, effect, `file`, `locator`).
3. `bbmodel_particle_pack` copies the effects a model's animations use into a resource pack and returns the client entity `particle_effects` map. It reports missing effect files and locators, and refuses to overwrite files with different content unless `overwrite` is true.

Particles cannot be rendered headlessly. Open the model in Blockbench to preview them.

## Web app links and launching

- Every write tool returns `web_app`. Send the user `web_app.url`; when it is absent, use `geometry_url` (no texture images) or `launcher.file_url` (a local page for Chrome or Edge). The model travels inside the URL after `#` and is never uploaded. `bbmodel_web_url` makes one for any file.
- `blockbench_launch` starts the desktop app, optionally opening a file as a new tab. It finds the app from `--blockbench`, `BLOCKBENCH_PATH`, `PATH`, then standard install folders. Pass `wait_for_mcp_ms` to wait until the desktop plugin answers, then continue with the desktop tools. Starting another program needs user approval.

## Limits and gotchas

- Elements other than cubes, meshes, groups and locators are preserved but cannot be edited.
- A texture taller than about 1.05× its width is treated as an animated flipbook and shows only its top frame. Keep textures square or wide.
- Material `mer_value` is 0–255 per channel, not 0–1.
- Normal maps for `free` models use the OpenGL convention (green up); Blockbench flips green only for Bedrock formats.
- Scripts that merge models must copy `texture_groups` and keep each texture's `uv_width` / `uv_height`.
- Keep element names unique; duplicates make name lookups edit the wrong element.
- Written models carry `ai_used` and `ai_agents` fields, matching the desktop plugin. The server option `--no-ai-disclosure` turns this off; do not strip the fields by hand.
- `bbmodel_convert_legacy` writes a copy Blockbench 4.x can open.
