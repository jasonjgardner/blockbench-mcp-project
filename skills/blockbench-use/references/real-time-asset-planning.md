# Real-Time Asset Planning

Answers to the planning questions in Babylon.js's [Planning Your Assets for Real-Time Rendering](https://doc.babylonjs.com/preparingArtForBabylon/planningRealTimeAssets/), resolved for this project's targets: **Minecraft** (Java and Bedrock, blocks and entities) and **low-poly glTF** (Generic Model `free` exported to Babylon.js or another web/game engine). Hytale answers live in [Hytale guidance](../../blockbench-hytale/SKILL.md).

Read before a new model or a substantial redesign, after the appearance/performance preference in [appearance and performance planning](appearance-and-performance.md) is settled. Answer each question once, write the answers into the plan (template at the end), and carry them through modeling, UVs, textures, materials, animation, and export. Changing the shading model or texel density mid-production invalidates UVs and textures, so settle both while the model is still a blockout.

Contents: 1 Target device · 2 Shading model · 3 Special materials · 4 Triangle budget · 5 Removing triangles · 6 Baking detail · 7 Texture size · 8 Tiled vs atlas · 9 Non-square and NPOT · 10 Animation type · Plan template

## 1. What is the target device?

| Target | Answer |
|---|---|
| Minecraft Bedrock | Plan for the weakest device the content ships to. Bedrock runs on phones, consoles, and low-end Chromebooks, so assume low-end mobile unless the user limits distribution. |
| Minecraft Java | Desktop, but the cost that matters is **copies**. A block may be placed thousands of times. Its faces are baked into chunk meshes, so face count and transparency multiply per placement. Entities and block entities render and animate one instance at a time. |
| Low-poly glTF | Ask: desktop, mobile, or headset (HMD)? For web on mobile, keep textures ≤ 2048, keep few materials, and avoid expensive post-processing. A headset needs a high frame rate in stereo, which roughly halves the budget. |

## 2. What is the shading model?

The shading model decides texture content, UV strategy, and whether normal maps are worth making.

- **Minecraft Java (vanilla):** the game controls lighting (per-face directional shading plus smooth-lighting ambient occlusion). There are no normal or roughness slots, so the albedo must carry all form: paint highlights, shadows, and edge wear into the pixels. Shader packs such as Iris or OptiFine read LabPBR maps, but only when the user asks for that pack. They are not the default.
- **Minecraft Bedrock:** Classic rendering uses only the color layer. Vibrant Visuals and RTX read `.texture_set.json` (MER/MERS plus normal or heightmap). Treat PBR as an enhancement over a color texture that reads well by itself; follow [PBR guidance](../../blockbench-pbr-materials/SKILL.md).
- **Low-poly glTF:** decide between two routes at the prototype stage:
  - *Stylized:* flat or faceted shading, colors from a palette texture, no normal maps. Faceted shading needs split normals (hard edges), which duplicates vertices in the export.
  - *PBR:* glTF metallic-roughness with image-based lighting when materials must look accurate.

  Do not mix the two routes in one asset set.

## 3. Do any materials need special rendering?

Split out only the surfaces whose shader requirements differ. Combine everything else into one opaque material.

| Target | Techniques available | How to split |
|---|---|---|
| Java block | opaque, cutout, translucent | Vanilla assigns the render layer **per block in code**, not per face or per model. One block cannot mix opaque and translucent faces without mod-loader support (NeoForge's model `render_type`). Emission comes from block properties, not the model. |
| Bedrock block | `opaque`, `alpha_test`, `alpha_test_single_sided`, `blend` per material instance | Give only the cutout or translucent faces their own instance. See [material instances](bedrock-material-instances.md). |
| Bedrock entity | entity materials (alpha test, emissive, and others) bound per bone by render controllers | Keep translucent or emissive parts in their own bones so a render controller can target them. |
| glTF | `alphaMode` OPAQUE / MASK / BLEND; extensions such as clearcoat and transmission | Give each shader need its own material. Clearcoat and transmission cost more per pixel, so restrict them to the parts that need them. |

Blended transparency sorts badly and adds overdraw. Prefer cutout (alpha test / MASK) wherever edges can be hard.

## 4. What is the triangle budget?

A cube is 6 quads, which is 12 triangles; omitted faces reduce that. The figures below are **starting proposals to state to the user**, not limits. Scale each one by how many copies render at once.

| Asset role | Starting budget |
|---|---|
| Minecraft decorative block placed in quantity | A handful of elements. Cull faces against neighboring blocks (Java `cullface`). A full block that never culls its faces is expensive at scale. |
| Bedrock custom block | Must fit the 30×30×30 bounds ([modeling](../../blockbench-modeling/SKILL.md)). Aim for the fewest elements that keep the silhouette. |
| Minecraft mob or entity | Vanilla-style mobs mostly use about 6–30 cubes. Allow more for a boss or hero. Use the minimum for things that appear in crowds (herds, projectiles, drops). |
| Low-poly glTF prop | Hundreds to about 2k triangles. |
| Low-poly glTF hero character (game) | About 15k triangles (the Babylon article's example). |
| Single object shown alone (product viewer) | Up to about 100k triangles. |

Give hero assets that sit near the camera more than background assets or assets seen only briefly.

## 5. Where do triangles go, and where can they be removed?

Spend triangles on **silhouette, parallax, and deformation**. Flat regions that neither deform nor contribute to the outline get large, sparse faces. An optimized mesh rarely has evenly sized triangles.

- **Delete faces nobody sees.** Real-time meshes do not need to be watertight.
  - Java: remove faces between touching elements; use `cullface` on block-boundary faces.
  - Bedrock per-face UV: omitted faces are not drawn. Box UV cannot omit faces; switch to per-face UV if the target allows it.
  - Meshes: use `delete_mesh_elements`.
  - Keep a face if any required pose or view reveals it.
- **Intersect instead of connecting.** Let a cylinder pass through a plane rather than stitching an edge loop around the joint. Minecraft cubes interpenetrate natively, so never cut a cube to meet another cube exactly.
- **Float detail instead of cutting it in.** A thin plane or zero-thickness element placed just above a surface can fake panel lines or trim without extra topology. Offset it enough to avoid z-fighting at the farthest intended view distance, and check grazing angles. On pixel-art Minecraft assets, a floating sticker often reads worse than painting the same pixels onto the surface.
- **Measure.** Use `find_elements_by_criteria`, `get_mesh_info`, and `list_outline` to count before and after each change, as described in [appearance and performance planning](appearance-and-performance.md).

## 6. Which detail can be baked into textures?

Bake high-frequency detail that needs no parallax: scratches, chips, panel lines, rivets, stitching, and small fasteners (see Hardware Details in [appearance and performance planning](appearance-and-performance.md)).

- **Minecraft Java and Bedrock Classic:** "baking" means painting shading into the albedo, because there is no normal channel.
- **Vibrant Visuals and RTX:** add normal or height detail in the texture set, with the albedo still painted. Derive the maps with [albedo to PBR](../../blockbench-albedo-to-pbr/SKILL.md), or bake them with [Substance](../../blockbench-substance/SKILL.md).
- **Low-poly stylized:** skip normal maps. Bake ambient occlusion or gradients into the palette texture or albedo.

Keep detail as geometry when it needs **parallax**, meaning its visible depth changes as the camera moves: recesses, vents, openings, window depth, a barrel bore, an engine intake. A painted opening turns into a flat sticker when the camera orbits the model. Minecraft's texel density (16 texels per block) is also too coarse to hold fine normal detail. Bake small, non-distracting detail; model detail whose depth must be seen.

## 7. What is the largest usable texture size?

Fix a **texel density** first, then derive texture sizes from it.

- **Minecraft:** 16 texels per block, which is 1 texel per model unit. Standard entity atlases are 64×64; large mobs use 128 or more. Use 32×, 64×, or larger densities only when the whole pack is HD. Mixed densities on one model break the style ([formats and delivery](formats-and-delivery.md)).
- **Low-poly glTF:** palette textures stay tiny (64–256). Unique atlases are usually ≤ 2048, and ≤ 1024 for mobile web. The Babylon article cites 4K as the glTF ceiling. Pick a density per meter during the prototype and hold it on every asset so they look equally detailed.

When one texture cannot reach the density, split into several texture sets. Give the close-to-camera parts the extra density, and accept the extra materials and draw calls that the split adds.

## 8. Tiled textures or a unique atlas?

| Target | Answer |
|---|---|
| Minecraft blocks | Tiling is native: every face maps one 16×16 seamless tile, so large builds reuse tiles. Java face UVs stay inside the 0–16 texture space and cannot wrap past it. To repeat a tile, split the face or map each face to a full tile; UVs above 1 do not repeat it. |
| Minecraft entities | Use a unique atlas (box or per-face UV). Share UV space between mirrored or repeated parts. |
| Low-poly glTF | Use a **palette atlas**: collapse each face's UVs onto a solid swatch. One tiny texture and one material cover the whole asset set, which batches well. Use repeat-wrapped tiled textures (UVs above 1) for ground and walls, in a separate material. |

Mix atlas and tiled textures where each works best. Shared tiles for repeated structure are covered in [texturing](../../blockbench-texturing/SKILL.md).

## 9. Can textures be non-square or non-power-of-two (NPOT)?

- **Java:** keep block and item textures square with power-of-two sides. A tall strip is read as a flipbook with `.mcmeta`. Entity textures may be non-square (64×32 is standard) but keep power-of-two sides. Mixed or NPOT sizes reduce the block atlas's mipmap levels.
- **Bedrock:** keep power-of-two sides. Flipbooks are tall strips ([flipbook textures](../../blockbench-flipbook-textures/SKILL.md)).
- **Hytale:** each side must be a multiple of 32; NPOT sizes are allowed.
- **Babylon.js / glTF:** non-square and NPOT textures are supported (WebGL2 and WebGPU). Use them to pack atlases without dead space, or to size a decal exactly (80×80 rather than 128×128). GPU texture compression such as KTX2/Basis needs sides that are multiples of 4, and other engines may resize NPOT textures, so confirm the destination before relying on NPOT.

In formats with `per_texture_uv_size`, set each texture's UV size to match its actual image.

## 10. Does the asset animate, and how?

| Type | Where it applies | Plan for it |
|---|---|---|
| Node (transform) animation | The only kind Minecraft supports: Bedrock entities, GeckoLib, and OptiFine animate rigid bones. Java block and item models do not animate (block states and display transforms only). | Parts cannot bend. Split each bend into separate parts at the joint, overlap them so rotation does not open gaps, and put pivots at joints ([animation](../../blockbench-animation/SKILL.md)). |
| Skinned animation | Generic Model with native armatures and vertex weights, exported to glTF. | Add edge loops at joints so the mesh deforms cleanly, and weight every vertex. Confirm the exporter carries the rig before promising a skinned asset ([MCP overview](../../blockbench-mcp-overview/SKILL.md)). A control rig does not export. |
| Morph targets | No MCP tools author them. | Substitute bones, visibility keyframes, or texture flipbooks (for eyes and mouths). Otherwise, add the morphs in another 3D app after export. |
| Texture animation | Minecraft flipbooks (fire, eyes, screens). | Costs no geometry. See [flipbook textures](../../blockbench-flipbook-textures/SKILL.md). |

When several people edit one asset, keep the `.bbmodel` as the single source and ship each animation clip as its own file where the target allows it. Bedrock already stores animations in separate `.animation.json` files. This lets one clip change without overwriting the mesh or other clips.

## Plan Template

Record the answers before detailed geometry, then check the result against them.

```text
Target / device floor:   Bedrock entity; low-end mobile
Copies at once:          up to 20
Shading:                 color-first; Vibrant Visuals texture set as enhancement
Materials:               1 opaque atlas + 1 alpha_test (wings)
Budget:                  ≤ 24 cubes (≤ 288 triangles)
Texel density / texture: 16 px per block; 64×64 atlas; power-of-two
Detail:                  painted albedo; normal map in texture set only
Geometry kept for:       silhouette, mouth opening (parallax)
Animation:               bone (node): idle, walk; flipbook blink
```
