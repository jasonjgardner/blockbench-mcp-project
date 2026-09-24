# Building with the Headless Server

The headless Blockbench MCP server edits `.bbmodel` files without the Blockbench app. Each MCP client launches its own process, so several agents can build different files at once. Its tools are named `bbmodel_*` (plus `blockbench_launch`); read their live schemas instead of assuming parameters.

## Setup

This plugin registers the server as `blockbench-headless` in its `.mcp.json`, pinned to a released tag of [jasonjgardner/blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) and started with `npx` (only Node is needed; the package installs its own Bun). Its sandbox is `--root .`, the folder the client started in. Read [Blockbench headless](../../blockbench-headless/SKILL.md) for the tool list, revision rules, and the sandbox caveat.

If the client started somewhere other than the project folder (a home directory, for example), register the server yourself with the project folder as its root, for example in Claude Code:

```sh
claude mcp add blockbench-headless -- npx -y github:jasonjgardner/blockbench-mcp-plugin#v1.9.1 --root "<project folder>"
```

Useful flags: `--root` (repeatable; the server refuses paths outside it), `--render-home <dir>` or `$BB_RENDER_HOME` for where the renderer's packages are installed, `--blockbench <exe>` or `$BLOCKBENCH_PATH` for `blockbench_launch`.

### Rendering

`bbmodel_render` and `bbmodel_contact_sheet` use a renderer built into the server; there is no separate bb-render checkout to find or build. It needs Node 23.6+ with npm and a WebGPU-capable GPU. Everything else works without them.

- **First render installs packages.** `three`, `three-blockbench` and Dawn (about 130 MB) are installed once into a per-user cache folder (`%LOCALAPPDATA%\blockbench-mcp-headless\render` on Windows, `~/.cache/blockbench-mcp-headless/render` elsewhere), so the first render takes a minute or more and later ones a few seconds. Do not treat that wait as a hang. If the system drive is short on space, set `$BB_RENDER_HOME` (or `--render-home`) to another drive before the first render.
- **Scope.** It renders one PNG still per call from a `.bbmodel`, optionally posed at a clip time. Embedded textures must be PNG and not interlaced; a JPG or interlaced texture fails with a message naming the problem. Video, path tracing and glTF/USD input are not part of it; render motion as stills at several clip times.
- **Errors.** A failed install or missing npm comes back as "The render engine is not available: ..." with the cause. Fix it (install Node 23.6+, free disk space, check network) and call again; a failed install is retried on the next render.
- `--bb-render <cli.js>` or `$BB_RENDER_CLI` still points the tools at an external bb-render build (for video or path tracing outside this workflow), replacing the built-in engine.

If the tools are not connected, give the user the command above with their folder filled in and wait. A server added mid-session usually needs a client restart.

## Project layout

```
<output>/<slug>/
  plan.md                 decisions, budgets, part list, shot list
  models/<asset>.bbmodel  one file per asset; scene.bbmodel when assembled in Blockbench
  textures/               source PNGs (albedo, normal, MER) before they are embedded
  blender/<slug>.blend    the deliverable scene
  blender/scripts/        import_and_fix.py, assemble.py, lights_cameras.py
  render/                 render.cmd, render_worker.py, preview/, frames/, logs/, <slug>.mp4
```

Keep every script that produced something. The `.blend` must be rebuildable by running `blender/scripts/*.py` in order.

## Build order

1. `bbmodel_create` each asset (format `free` unless the plan names another), then block out proportions with `bbmodel_edit`. Silhouette before detail.
2. `bbmodel_validate` and `bbmodel_contact_sheet` after every major pass. Fix floating parts, gaps and scale before texturing.
3. UVs and textures per [option specs](option-specs.md#textures). `bbmodel_add_texture` embeds PNGs; PBR channels go in `texture_groups`.
4. Animation per [option specs](option-specs.md#animation).
5. `bbmodel_render` at the scene's intended view (several clip times when animated). Look at every image before moving on.

Share the `web_app` link each write tool returns with the user, so they can open the model in the Blockbench web app.

For a subject that is a real object (a machine, vehicle, building, creature), run the `blockbench-physical-accuracy-reviewer` agent after blockout if the client has it; it checks mechanisms, scale and floating parts against the real thing.

## Parallel agents

For a complete scene or an isometric room, split the part list into independent assets and hand each to a subagent with its own output file. Build the hero subject yourself or with the strongest agent. Every brief includes:

- the subject, the shared style decisions from `plan.md`, the asset's real-world size in units, texel density, texture size and filtering;
- the file path it owns (and that it must not touch others);
- the verification it must return: validate result, a contact sheet, element/triangle count;
- the gotchas below.

Assemble when every asset passes: either import each `.bbmodel` into Blender separately and place it there (preferred for large scenes; repeated props become collection instances), or merge into `models/scene.bbmodel` with a script (required for a Havok bake, which needs every body in one project).

## Gotchas to put in every brief

- A texture taller than ~1.05× its width is treated as an animated flipbook and shows only its top frame. Keep textures square or wide; pad tall art.
- Material `mer_value` is 0–255 per channel, not 0–1.
- Scripts that merge models must copy `texture_groups` (the PBR materials) and keep each texture's `uv_width` / `uv_height` at its source model's resolution.
- `bbmodel_validate` checks interpenetration with world-space boxes, so rotated cubes produce false positives; a cube exactly 0.2 units thick can trip the degenerate check through float error. Confirm visually before "fixing" them.
- `place_mesh`-style primitives start with zero UVs; map large faces explicitly instead of trusting an automatic unwrap.
- Keep element names unique. Duplicate names make later look-ups edit the wrong element.
