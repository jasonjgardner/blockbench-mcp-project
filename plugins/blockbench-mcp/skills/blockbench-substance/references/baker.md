# substance3d_baker with Blockbench meshes

Official reference: [options](https://adobedocs.github.io/substance-automation-toolkit/pysbs/sat_commandlines/substance3d_baker_options.html), [examples](https://adobedocs.github.io/substance-automation-toolkit/pysbs/sat_commandlines/substance3d_baker_examples.html). Verified with 16.0.6 on a Blockbench 5.2 `bedrock_block` export.

## Contents

- [Flag spelling](#flag-spelling)
- [Prepare the Blockbench mesh](#prepare-the-blockbench-mesh)
- [Bakers](#bakers)
- [Common options](#common-options)
- [Recipes](#recipes)
- [Reading the results](#reading-the-results)

## Flag spelling

The installed baker uses **underscores**: `--output_size`, `--use_lowdef_as_highdef`, `--projection.max_height`, `--secondary.sample_count`. The online options page prints hyphens (`--output-size`); that spelling fails with `Unknown option`. When in doubt: `substance3d_baker <Baker> --help`. Older installs ship `sbsbaker` instead, with different subcommand names (`ambient-occlusion-from-mesh` ...).

The baker **creates** `--output_path` if missing (unlike `sbsrender`).

## Prepare the Blockbench mesh

1. **Export** with `export_model`: `codec_id: "gltf"` + `options: {"encoding": "binary"}` (`.glb`) or `codec_id: "obj"`. Both load. OBJ also references a `materials.mtl` that is not written; the baker ignores it. Use OBJ/FBX when the same mesh also goes to Painter (Painter has no glTF import).
2. **Units**: 1 unit = 1 block = 16 Blockbench pixels (a 16 px cube spans −0.5..0.5). Projection and AO distances default to *normalized* (fractions of the bounding box), so scale rarely matters; switch `--projection.normalized_distance false` only when you think in metres.
3. **Mesh names**: each cube becomes its own mesh at `/root/<element name>/Mesh`. `--name_filtering_mode parent_name` (default) therefore matches on Blockbench element names, so for high→low matching name them `part_low` / `part_high`. List them with `substance3d_baker info model.glb`.
4. **UVs must not overlap.** Blockbench's per-face Auto UV maps every face of a `bedrock_block` / `java_block` cube onto the same corner of the texture, and mirrored box-UV faces share texels. A bake then stacks several faces' shadows into one rectangle and is useless. Before baking:
   - give every face its own rectangle (explicit UVs via `place_cube` face UVs / `modify_cube`, or Blockbench's *Create Texture → Template* with *Rearrange UV* in the UI, or unique mesh UVs via `auto_uv_mesh`/`set_mesh_uv`);
   - check `substance3d_baker info` (`Contained within unit square: 1`, `UV tiles 0x0`) and inspect the exported `vt` values or `get_cube_uv`.
   - Tiling block textures (every face samples the same 16×16) are not bake targets. Bake entities, props and atlases, or bake for a *mask* you later apply by hand.
5. **Texture size**: bake at 8–16× the final texel density (256–1024 px for a 64 px atlas), then shrink with `prep_maps.py convert --size 64 --filter box`. A direct 16 px bake aliases, and padding bleeds across tiny islands.

## Bakers

| Baker | Output file `{bakername}` | Use in Blockbench |
|---|---|---|
| `AmbientOcclusion.Raytraced` | `ambient_occlusion` | Multiply into base colour for contact shadows (cube gaps, under ledges). |
| `Curvature.Raytraced` | `curvature` | Edge-wear masks. Flat-shaded separate cubes give flat 0.5 gray; it needs bevelled or merged mesh geometry. |
| `Normal.Raytraced` | `normal` | High→low detail normal (needs `--high_scene_paths` or a sculpted high mesh). |
| `Normal.TangentToWorld` | `normal_world_space` | World-space normals, used for directional masks (moss on top faces). **Not raytraced**: rejects `--use_lowdef_as_highdef`. |
| `Normal.WorldToTangent`, `Normal.BentNormals` | | Conversions / bent normals. |
| `Position.Raytraced`, `Position.Rasterised` | `position` | Gradient masks (dirt at the bottom): `--mode single_axis --axis y`. |
| `Height.Raytraced` | `height` | High→low height; feeds a `heightmap` layer. |
| `Thickness.Raytraced` | `thickness` | Subsurface / translucency masks. |
| `Color.Raytraced` | ID map | `--color_source mesh_index` gives one colour per Blockbench element, a ready-made selection mask for Painter/Designer. |
| `Opacity.Raytraced`, `TextureTransfer.Raytraced` | | Opacity from high mesh; project an existing texture from one mesh to another. |
| `info` | | Meshes, UV sets, UDIMs, bounding boxes. |
| `run --json preset.json` / `update` | | Run a Designer baker preset; upgrade an old preset. |

## Common options

| Option | Default | Notes |
|---|---|---|
| `--output_path` | `./` | `{inputPath}` macro available. |
| `--output_name` | `{scenename}_{bakername}` | Macros `{scenename}`, `{bakername}`, `{udim}`, `{sizex}`, `{sizey}`, `{sizexk}`. |
| `--output_format` | `png` | 16-bit grayscale PNG for AO/curvature/height; convert before import. |
| `--output_size` | `2048,2048` | Pixels, not log2. |
| `--use_lowdef_as_highdef` | false | Bake the Blockbench mesh against itself (no separate high-poly). Raytraced bakers only. |
| `--high_scene_paths` | | High-poly scene(s) for detail transfer. |
| `--projection.max_height` / `--projection.max_depth` | 0.01 | Ray search distances (normalized). Raise for chunky high meshes. |
| `--projection.mesh_match_mode` | `match_all` | `match_mesh_name` pairs `_low`/`_high` names. |
| `--padding_radius` | 2 | Dilation in px; keep small for tight atlases. |
| `--enable_mip_diffusion` | true | Fills empty texels with a blur; harmless outside islands. |
| `--output_texture_orientation` | `directx` | Normal bakers: `directx` (Bedrock) or `opengl` (glTF, Java labPBR). |
| `--enable_ground_plane` | false | AO: adds a floor. Standing props get a grounded look, but `down` faces go black. |
| `--secondary.sample_count` / `--secondary.max_distance` | 64 / 1 | AO quality / reach. |
| `--cpu`, `--backends SAL,Embree,SoRa` | GPU SAL | Force CPU when no RTX-class GPU. |
| `--selected_meshes /root/name/Mesh` | all | Repeatable. |

## Recipes

```bash
B="C:/Program Files/Adobe/Adobe Substance 3D Designer/substance3d_baker.exe"

# Self-bake AO + curvature + position at 512 for a 64 px Blockbench atlas
"$B" AmbientOcclusion.Raytraced model.glb --use_lowdef_as_highdef true --output_size 512,512 --output_path bake
"$B" Curvature.Raytraced        model.glb --use_lowdef_as_highdef true --output_size 512,512 --output_path bake
"$B" Position.Raytraced         model.glb --use_lowdef_as_highdef true --mode single_axis --axis y --output_size 512,512 --output_path bake
"$B" Normal.TangentToWorld      model.glb --output_size 512,512 --output_path bake

# Detail normal from a sculpted high mesh onto the Blockbench low mesh, Bedrock convention
"$B" Normal.Raytraced model_low.obj --high_scene_paths model_high.obj --output_texture_orientation directx \
  --projection.max_height 0.05 --projection.max_depth 0.05 --output_size 1024,1024 --output_path bake

python scripts/prep_maps.py convert bake/*.png --out bake/64 --size 64
```

## Reading the results

- Bake space matches Blockbench's texture space: UV (0,0) is the top-left texel, so face rectangles land where `get_cube_uv` reports them. Verified by baking a three-cube pedestal.
- Everything outside UV islands is diffusion fill; ignore it.
- AO on a correct layout shows contact shadows (for example the column footprint on a base top). A single smeared rectangle means overlapping UVs.
- Inspect with numpy after scaling (`/257` for 16-bit), never with `PIL.Image.convert("L")`, which clips 16-bit data to 255 (the map looks solid white).
