# Blender Handoff and Render Deliverable

Drive Blender with background processes: `blender -b [file.blend] --python script.py -- <args>`. Put results on stdout with `print(json.dumps(...))`. Never render inside an open Blender editor; a crash there loses unsaved work. Save the `.blend` from the script.

## Find the tools

| Tool | Look in order | Probe |
|---|---|---|
| Blender 4.2+ | `$BLENDER`, `blender` on `PATH`, `%ProgramFiles%\Blender Foundation\Blender */blender.exe` on every drive, `/Applications/Blender.app/Contents/MacOS/Blender` | `blender -b --version` |
| FFmpeg | `$FFMPEG`, `ffmpeg` on `PATH`, FFmpeg builds bundled with other apps (ImageMagick ships one) | `ffmpeg -hide_banner -version` |
| GPUs | the render worker | `blender -b -P render_worker.py -- --list-devices` prints `DEVICES_JSON {"backend": ..., "gpus": [...]}` |

Ask the user only for what the search could not find. Use the absolute paths you found in the generated `render.cmd`; that file stays on their machine.

## Import route

Check for an add-on that imports `.bbmodel` directly (search `addon_utils.modules()` for a name or `bl_info` mentioning bbmodel or Blockbench, then `addon_utils.enable(...)`). It keeps materials, flipbooks and clips best. Without one, open each `.bbmodel` in Blockbench desktop (`blockbench_launch`), export glTF/GLB with animations through the desktop MCP's `export_model`, and import with `bpy.ops.import_scene.gltf`. glTF export drops normal and MER maps, so rebuild those shader inputs from the files in `textures/`.

Blockbench axes map to Blender as (x, y, z) → (x, −z, y). One Blockbench unit is 1/16 m; importers usually put that scale on a root rig or empty. Scale the root, not the meshes.

## Fix pass after import

Imports into Blender have predictable defects. Script these fixes in `import_and_fix.py` and check every object, not a sample:

1. **Image extension**: set `REPEAT` on every Image Texture node. `EXTEND` smears any UVs outside 0–1.
2. **Interpolation**: `Closest` for 16×–32× pixel art, `Linear` (or `Cubic`) for HD and 2K.
3. **Normal maps**: Blockbench and Bedrock bakes are DirectX (green down). Blender wants OpenGL; invert the green channel (Separate Color → 1 − G → Combine) or the relief lights backwards.
4. **Emission**: emission read straight from MER caps at 1.0 and never glows. Multiply it (×10–30) where something should read as a light.
5. **Flipbook drivers**: check the frame rate a flipbook driver uses against the texture's `frame_time`.
6. **Smoothing**: clear custom split normals (`mesh.customdata_custom_splitnormals_clear`) before `shade_auto_smooth`. On any Subdivision modifier set `uv_smooth = 'PRESERVE_BOUNDARIES'`, or textures smear on rounded parts.
7. **Animation**: each clip lands as an action or NLA strip on its rig. When a file is imported twice, take each rig's clip from its own NLA tracks, not by name.

Seamless tiling materials authored as world-space projections survive modifiers best with `Texture Coordinate ▸ Object → Mapping → Image Texture (projection BOX, blend ≈ 0.3)`; keep the UV map for the Normal Map node's tangents.

## Assembly, light and camera

- `assemble.py`: import once per unique asset into an excluded `_sources` collection and place collection instances for repeats; import one-off assets directly and move their root.
- Ground everything: nothing floats, nothing sinks. Check contact points from a low camera.
- `lights_cameras.py`: follow the scene-type row in [option specs](option-specs.md#scene-type). Render engine Cycles, AgX view transform. Very dark albedo lifts under AgX; drop exposure 1–1.5 EV instead of repainting. In Blender 4.4+ the Glare node's Bloom is driven by its input sockets (Threshold, Strength, Size), not the legacy properties; its default Strength veils the whole frame, so start near 0.1.
- Multiple shots: bind cameras to timeline markers (`marker.camera`) so one animation render produces the cut.
- Frame range = preset length at the preset frame rate. Set resolution, fps, adaptive samples and OIDN from the render preset.
- Volumetrics: prefer a local volume box around the set over world volume. Keep haze density low (≈0.05–0.1 per m) or the image goes milky.

## Deliverable

Copy both assets into `render/`:

- [`assets/render_worker.py`](../assets/render_worker.py): sets the GPU, PNG output `frames/frame_####.png`, skip-existing and placeholders. Several workers share one frame range without coordination, and a rerun resumes.
- [`assets/render.cmd`](../assets/render.cmd): replace every `{{…}}` placeholder, then confirm none remain.

| Placeholder | Value |
|---|---|
| `{{BLEND_NAME}}` | file name, for the header comment |
| `{{BLENDER_EXE}}` / `{{FFMPEG_EXE}}` | absolute paths found above |
| `{{BLEND_RELATIVE}}` | path from `render/` to the scene, e.g. `..\blender\<slug>.blend` |
| `{{VIDEO_NAME}}` | `<slug>.mp4` |
| `{{FPS}}` / `{{FRAME_START}}` / `{{FRAME_END}}` | scene frame rate, first and last frame |
| `{{GPU_COUNT}}` | number of GPUs from `--list-devices`; `1` when the backend is null (CPU) |
| `{{SAMPLES}}` | empty to keep the scene's samples |

`render.cmd` starts one minimized Blender per GPU (`start ... worker N`), waits for every worker's `logs/gpuN.done`, deletes 0-byte placeholders left by a crashed worker, re-renders every missing frame in the range once on GPU 0, then encodes exactly the range as H.264 MP4 (CRF 17, yuv420p, padded to even dimensions, faststart). Frames already on disk are never re-rendered, so after changing the scene, empty `frames/` first. `render.cmd encode` re-encodes only. `set RENDER_GPUS=1` limits it to the first GPU. A render in progress on a GPU that also drives the display can make the desktop sluggish; say so in the report.

On macOS or Linux write `render.sh` with the same steps (`&` per worker, `wait`, then ffmpeg).

Only Cycles honors the per-worker GPU choice. EEVEE scenes still split frames across workers but run on the display GPU.

## Verify before handing over

1. Render 2–3 stills at low samples from the start, middle and end of the range, one per camera shot: `blender -b scene.blend --python-exit-code 1 -P render_worker.py -f <frame> -- --gpu 0 --out <render>/preview --samples 32`. The worker never overwrites, so empty `preview/` before a rerun. Look at them: exposure, framing, textures present (no pink), nothing floating, animation pose correct for that time.
2. Time one still at full samples to estimate the full render.
3. Do not start the full render unless the user asked; hand over `render.cmd`.
