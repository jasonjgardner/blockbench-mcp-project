# UV Scale and Distortion

Read before applying detailed materials, reusing a UV swatch on differently sized geometry, resizing textured parts, or repairing inconsistent texture scale. Preserve the user's design and performance preference; consistent mapping does not require adding detail geometry.

## Distinguish Shape, Density, and Pattern Scale

- **Distortion within a face:** unequal scale along the two surface directions turns round speckles into streaks or square checks into rectangles. Correct the UV proportions relative to the face dimensions.
- **Density between faces:** a pattern can have the correct proportions yet appear larger or blurrier on one part because it receives fewer image pixels per model unit. Compare faces sharing a material, including differently sized copies and side/end faces.
- **Authored material scale:** equal pixel density does not ensure equally sized grain if separate painted/generated swatches contain different grain sizes. Compare the actual weave, pores, ribs, or other recognizable features on the model too.

Equalizing island scale and reducing local distortion are separate operations, as illustrated in the [Blender UV editing reference](https://docs.blender.org/manual/en/4.2/modeling/meshes/uv/editing.html). Discover the actual Blockbench tools instead of assuming equivalent operations are available.

## Measure Effective Texture Density

Inspect `list_textures`, `get_cube_uv`, and, for meshes, `get_mesh_info: include_uv=true`. Use the effective face texture and frame size, not an assumed project-wide bitmap size. Establish an intended pixel density for comparable visible surfaces, or preserve an existing consistent reference face. A "256 base" describes a resolution convention; it does not by itself specify pixels per model unit.

For a rectangular face, let `L_u` and `L_v` be its surface lengths in model units along the directions mapped to image U and V. Let the stored logical UV rectangle be `[u1, v1, u2, v2]`, effective logical UV dimensions be `[U_w, U_h]`, and image frame dimensions be `[F_w, F_h]`:

```text
sampled_pixels_u = abs(u2 - u1) * F_w / U_w
sampled_pixels_v = abs(v2 - v1) * F_h / U_h
density_u = sampled_pixels_u / L_u
density_v = sampled_pixels_v / L_v

For a chosen density d in image pixels per model unit:
required_uv_span_u = d * L_u * U_w / F_w
required_uv_span_v = d * L_v * U_h / F_h
```

For ordinary undistorted mapping, `density_u` and `density_v` should be approximately equal and comparable with the chosen density on neighboring parts. Do not prescribe a universal tolerance: account for pixel-grid rounding, intended viewing distance, and deliberate differences in detail allocation. Use absolute spans for the calculation and check mirroring separately. Omit disabled faces; report collapsed UVs or zero-length surface directions rather than dividing by zero.

Unrotated cube face dimensions are X/Y for north/south, Z/Y for east/west, and X/Z for up/down. Match surface directions to the actual UV rotation; 90/270-degree rotations change which edge corresponds to U or V. Account for final stretch, nonuniform scale, and inflation when they alter rendered edge lengths. Ordinary rigid rotation preserves length: a rotated object's world-axis bounding box is not its face size.

Example: a 32 x 4-unit face at 4 image pixels per unit needs a 128 x 16-pixel region. On a 1024 x 1024 bitmap with a 256 x 256 logical UV grid, that is a 32 x 4 UV span. Mapping a 128 x 128-pixel square onto the same face yields densities of 4 and 32 pixels per unit, distorting the pattern by a factor of eight. A 64 x 4-unit face needs a 256 x 16-pixel region at the same density, rather than stretching the first face's region to fit.

For curved or irregular meshes, unwrap according to surface shape and inspect local distortion. UV bounding-box proportions and an island's average density cannot detect local shear or pinching. Compare a mapped checker across the surface, especially around bends, seams, poles, and deformations.

## Reuse Materials Without Stretching Them

1. Size each face's UV footprint from its dimensions and intended density. Sharing one rectangle is suitable for matching faces; applying the complete swatch to every face of different proportions or sizes usually is not. A whole-model `apply_texture` assignment is not a scale-aware unwrap.
2. Take proportionate subregions from a shared swatch or use suitably sized trim strips. Preserve visible feature size and direction across adjoining parts; allocate adequate space for end caps rather than copying a long side-face strip onto them.
3. For long surfaces, repeat a seamless material only when the target supports that wrapping behavior. Wrapping is defined at the texture sampler level in [glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html); do not assume a Minecraft atlas subregion repeats independently. UVs extending past a swatch can sample neighboring regions or wrap the entire image. When independent repetition is unavailable, paint/bake a repeated strip into an appropriately sized atlas region, use a supported separate tile/material, or use a small number of deliberate UV sections within the geometry budget.
4. If the required footprint does not fit, repack, expand the material region, or reduce density consistently within the agreed quality budget. Do not squeeze just one axis or enlarge every grain to make a large part fit the old swatch. Extra materials and geometric splits have costs; choose them deliberately.
5. Recheck after changing geometry dimensions, merging parts, converting formats, switching textures, or changing bitmap/logical UV dimensions. Resizing the image or changing filtering cannot repair incorrect UV proportions.

## Intentional Exceptions

Stretching or collapsed sampling can be appropriate for uniform colors/material channels, low-detail stylization, or designed directional trim/gradients. Treat it as an explicit design choice on those faces, not the default for a shared material. A flat albedo with a detailed normal or roughness map is not a uniform material. Keep detailed surfaces consistent unless a deliberate variation is part of the art direction; more texture space for a prominent feature need not make its physical grain larger.

Coordinate any UV edits across albedo, normal/height, and MER or other target-specific channels. Cropping or repainting only one map can misalign relief and surface properties. After rotating or mirroring tangent-space normal detail, verify the tangent basis and lighting in the target renderer rather than treating the normal map as an ordinary color image.

## Verify Before Repetition and Delivery

Use a reversible checker or diagnostic texture before final painting and before duplicating mapped parts. In a face-aligned view, checks should keep their intended proportions; comparable surfaces should show similar check sizes. Perspective foreshortening alone is not UV distortion. Restore the intended material after inspection.

Check each distinct combination of material, face dimensions, UV mapping, and scale transform; identical repeated parts can share an audit result. Inspect long/short faces, sides/ends, differently sized copies, seams, and representative poses. Review real material features at close range and intended viewing distance: a square checker can pass while separately generated material grains remain inconsistent.

Record representative face dimensions, sampled pixel spans, density in both directions, and any intentional exceptions. Reinspect after atlas-boundary cleanup and in the exported target when available. UVs being in bounds, a successful tool call, or a clean atlas screenshot alone does not verify consistent mapping on the model.
