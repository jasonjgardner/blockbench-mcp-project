# Substance 3D Painter round trip

Verified with Painter 12.1.1 on Windows. Painter's Python API docs ship with the install at `resources/python-doc/index.html`; its modules are readable at `resources/python/modules/substance_painter/*.py`. Grep them instead of guessing API names.

## Contents

- [Launch](#launch)
- [Remote scripting protocol](#remote-scripting-protocol)
- [Blockbench → Painter](#blockbench--painter)
- [Painter → Blockbench](#painter--blockbench)
- [Export JSON essentials](#export-json-essentials)
- [Gotchas](#gotchas)

## Launch

Painter has no headless mode; it is a GUI app that an agent drives over HTTP. Command-line flags ([docs](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/pipeline-and-integration/configuration/command-lines)):

| Flag | Effect |
|---|---|
| `--enable-remote-scripting` | Listen on `localhost:60041`. Required for everything below. |
| `--mesh <file>` | Start a new project with this mesh (or update the mesh of a project passed alongside). |
| `--mesh-map <file>` | Pre-baked map (AO, normal, curvature, ...); repeatable. |
| `--export-path <dir>` | Default export folder. |
| `--split-by-udim` | Texture set per UDIM tile. |
| `--disable-version-checking`, `--vram-budget <MB>` | Quieter start, VRAM cap. |

`--help` does **not** print help; it opens the application. Launch in the background (PowerShell `Start-Process ... -PassThru` and keep the PID), then `python scripts/painter_remote.py --ping --wait 240`. Ask the user before closing a Painter they opened themselves. Close only instances you started.

## Remote scripting protocol

`POST http://localhost:60041/run.json` with `{"js": "<base64>"}` or `{"python": "<base64>"}` ([docs](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/scripting-and-development/scripts-and-plugins/remote-control-with-scripting)).

- JavaScript returns the value of its last expression (`alg.version.painter` → `"12.1.1"`).
- Python returns `null`, and `print` output is not relayed. Report back by writing JSON to a file (`PAINTER_RESULT` placeholder, `--result`).
- Errors in either language come back as HTTP 200 with `{"error": {"description": "..."}}`; `painter_remote.py` exits 1.
- **Scope trap:** remote Python runs with separate globals and locals, so a top-level `def` cannot see other top-level names (imports, helpers). Put imports and helpers inside one `main()` and call it, as the bundled Painter scripts do.

## Blockbench → Painter

1. Fix UVs first (no overlap; see [baker.md](baker.md#prepare-the-blockbench-mesh)). Painter paints in UV space exactly like the baker.
2. `export_model` with `codec_id: "obj"` (or `fbx`). Painter imports fbx, obj, dae, ply, usd, **not glTF**.
3. `painter_new_project.py` with `MESH`, `NORMAL` (`DirectX` for Bedrock, `OpenGL` for glTF/Java), `RESOLUTION` (≥ 512 even for 16 px art: Painter tools need texels), `BAKE=1` to start the mesh-map bake that smart materials need. It sets `mesh_unit_scale=100` (Blockbench blocks are 1 m; Painter works in cm) and refuses to replace an open project with unsaved changes.
4. Texture sets are named after Blockbench's material IDs (`m_<uuid>`), one per Blockbench texture.
5. Painting is usually done by the human in the Painter UI. Scripted layer work (`substance_painter.layerstack`, `resource`) is possible but version-specific; read the local docs first.

## Painter → Blockbench

1. `painter_bedrock_export.py` with `OUT`, `NAME`, `PRESET=bedrock|gltf`, `SIZE_LOG2`.
2. Painter's export floor is **128 px** (`sizeLog2` 6 still wrote 128×128). For 16/32/64 px art export ≥ 128 and shrink: `prep_maps.py convert OUT/NAME*.png --out final --size 64 --filter box`.
3. Maps whose source channel does not exist in the texture set are skipped silently (the glTF preset's `_emissive` when no emissive channel). Trust the `files` list in the result, not the preset.
4. Import in Blockbench: `create_texture` with `data: <path>` and `pbr_channel`, then `create_pbr_material` / `configure_material`, or write a texture set with `prep_maps.py texture-set` and run `import_texture_set`.

## Export JSON essentials

From the local `export.html` "Full JSON config":

- `srcMapType`: `documentMap` (`baseColor`, `metallic`, `roughness`, `emissive`, `opacity`, `height`, `normal`, `ambientOcclusion`, `specularlevel`, `user0..7`), `meshMap` (`ambient_occlusion`, `curvature`, `normal_base`, `world_space_normals`, `position`, `thickness`, `id`), `virtualMap` (`Normal_DirectX`, `Normal_OpenGL`, `AO_Mixed`, `Glossiness`, `f0`, `View_2D`), `defaultMap` (`black`, `white`).
- `destChannel`: `R`, `G`, `B`, `A`, or `L`. Give R+G+B, or L alone, plus optional A. `srcChannel: "L"` on a colour map mixes R+G+B, which is how emissive colour becomes the MER green channel.
- `parameters`: `fileFormat`, `bitDepth` (string), `dithering`, `sizeLog2` (int or `[w, h]`), `paddingAlgorithm` (`passthrough`, `color`, `transparent`, `diffusion`, `infinite`), `dilationDistance`.
- `fileName` wildcards: `$textureSet`, `$mesh`, `$project`, `$udim`, `$sceneMaterial`, `$colorSpace`.
- `exportList[].rootPath` is a texture set name (`set/stack` with stacks).

## Gotchas

| Symptom | Fix |
|---|---|
| Calls fail right after launch | Painter still loading; use `--wait`. |
| `NameError` for an import or helper | Scope trap; wrap in `main()`. |
| `ValueError: file format ... not supported` | You sent a `.glb`; export OBJ/FBX. |
| Exported normals shade upside-down in Blockbench | Wrong convention: re-export with the other preset or `prep_maps.py convert --flip-green`. |
| Files named `m_1a2b..._mer.png` | `$textureSet` in `fileName`; the bundled preset uses `NAME`. |
