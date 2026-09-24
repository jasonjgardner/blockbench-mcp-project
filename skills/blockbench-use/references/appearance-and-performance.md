# Appearance and Performance Planning

Read before building a new model, multiplying repeated geometry, or optimizing an existing asset. Apply the preference question in [Blockbench use](../SKILL.md); carry the user's answer through modeling, UVs, textures, materials, and export.

## Establish the Design Preference

Ask a short question such as: "Should this model prioritize appearance/accuracy, performance with fewer elements and faces, or a balance? Where will it be used?" Offer these choices when the client supports them:

| Preference | Design consequence |
|---|---|
| Appearance/accuracy | Keep depth, silhouette, and close-view construction detail where they matter; still avoid invisible or redundant geometry. |
| Performance | Use the smallest practical structure; move repeated and fine detail into shared UV tiles, cutout panels, and supported PBR maps. |
| Balance | Keep the recognizable silhouette, major supports, and interaction surfaces; represent secondary detail with textures. |

Do not silently choose one from "realistic", "high quality", "HD", or a texture resolution. Once the choice is explicit, do not keep asking on each tool call. If the destination is Minecraft, distinguish Java/Bedrock and block/entity; a Generic Model is not automatically a Minecraft runtime asset.

Gather only context that changes the design: typical viewing distance, expected simultaneous copies, target device/rendering mode, and an existing element/face or frame-time budget. Ask about PBR support when the design would rely on it. If the user has no numeric budget, propose and communicate a concrete working budget based on those constraints; do not invent a universal Minecraft cube limit. [Real-time asset planning](real-time-asset-planning.md) gives per-target answers for device, shading model, and texture limits, plus starting budgets to propose.

## Budget Before Repetition

Track **elements/cubes/meshes**, **rendered faces/exported triangles**, **bones/groups**, **material/render passes**, and **texture dimensions/channel count** separately. Object overhead, transparency, texture memory, and draw submissions can matter even with a modest triangle count. One shared atlas does not guarantee one draw call, and outliner groups or duplicated elements do not imply GPU instancing. Label unmeasured draw-call costs as estimates.

Build one representative section and inspect it at the intended distance before duplicating it. Multiply its counts by the planned repetitions and compare the total with the working budget. For example, 100 fully faced detail cubes contribute 600 quad faces (usually 1,200 triangles); representing surface details on existing faces adds no geometry. Omitting unused faces changes that estimate, so count the actual export too.

Preserve the main shape first, then spend the remaining budget on details that remain visible. Remove internal/hidden faces only when they stay hidden in required views and poses and the target exporter preserves their omission. Verify that merging parts or converting cubes to a mesh is supported by the destination and actually reduces the relevant cost. Do not add arbitrary subdivision or bevel segments to satisfy a vague quality adjective.

## Choose the Representation

Choose by what a feature contributes at the intended viewing distance and across required poses: outline, depth, motion, interaction, or surface appearance. Apply these criteria to any subject; the examples illustrate feature types rather than prescribe how a particular asset must be built.

| Feature type | Keep geometry when | Lower-cost representation to consider |
|---|---|---|
| Primary form and silhouette, such as body volumes or terrain contours | The outline, depth, or prominent gaps depend on the shape. | Fewer, larger primitives or simpler topology that preserves the recognizable profile. |
| Moving or deforming features, such as hinges, limbs, or fabric | Independent movement, articulation, or deformation must remain visible. | Simplify each moving part while preserving pivots, necessary topology, and rig behavior; texture detail that moves with its supporting surface. |
| Repeated open patterns, such as lattices, grilles, or foliage clusters | Thickness, parallax, or changing views make individual parts necessary. | A small number of format-supported cutout planes or thin panels with shared UV tiles, retaining important outer contours. |
| Small attachments and edge details, such as fittings, trim, or knobs | A visible protrusion, contact edge, or interaction needs the shape. | Merge static attachments into a simpler form, paint detail onto an existing surface, or omit details that remain hidden. |
| Shallow surface relief, such as stitching, grooves, chips, or embossed patterns | Relief is large enough to affect the silhouette or close views materially. | Albedo plus aligned normal/height and roughness/metalness detail where supported. |
| Color and material variation, such as markings, wear, or decorative patterns | A separate layer has visible physical thickness or independent motion. | Shared atlas regions, painted detail, or supported material channels on existing faces; avoid one extra element or decal plane per mark. |

These are options, not automatic substitutions. A cutout panel loses thickness and parallax, and PBR surface detail does not change the outer silhouette or create collision geometry. Explain the visible tradeoff when it matters to the selected preference. Preserve required collision/selection shapes independently of the visual simplification.

For cutout representations, preserve empty space with actual alpha holes; painting a background color onto an opaque surface does not preserve those openings. Use [texturing guidance](../../blockbench-texturing/SKILL.md) to verify both sides, distant views, seams, and filtering. Large overlapping alpha panels and extra render passes can outweigh the geometry savings; keep panels tight and avoid unnecessary translucent blending. Use the destination's supported geometry representation rather than assuming arbitrary mesh planes export to every format.

For shallow relief and material variation, use [PBR guidance](../../blockbench-pbr-materials/SKILL.md) only when supported by the intended game/rendering mode. Keep a readable albedo fallback. Multiple visual surfaces can share an atlas and channel maps with different values by region; they do not each need a new material. Follow the destination's channel conventions and material bindings; for Bedrock custom blocks, use [material-instance guidance](bedrock-material-instances.md).

When moving detail into textures, preserve its intended size and proportions across surfaces. Use [UV scale and distortion guidance](../../blockbench-texturing/references/uv-scale-and-distortion.md) to plan proportionate UV footprints and pattern repetitions; mapping the same full tile onto a larger or longer surface can visibly enlarge or stretch the detail. Prefer UV and atlas corrections within the working budget before adding geometry or materials solely to repair mapping.

## Hardware Details

Screws, bolts, nuts, rivets, washers, and hinge pins rarely earn geometry on a large or complicated model. Each one costs an element and up to six faces for a feature only a few pixels wide at the intended viewing distance, and dozens of them add object overhead, extra UV islands, and outliner clutter without changing the silhouette.

Represent them on the supporting face instead:

- Paint the head, slot, and contact shadow into the albedo at the correct UV scale.
- Add the raised or countersunk relief in an aligned normal/height map where the target supports PBR; that relief is what makes the head read as three-dimensional under moving light.
- Set the fastener's own metalness and roughness in the MER region so it separates from the painted, plastic, or wooden surface around it.

This usually reads better than tiny cubes, which cannot round a head, alias badly at distance, and z-fight when inset flush. Author one reusable fastener patch in the atlas and point every instance's UVs at it rather than repeating the artwork; follow [PBR guidance](../../blockbench-pbr-materials/SKILL.md) for channel authoring and [UV scale and distortion guidance](../../blockbench-texturing/references/uv-scale-and-distortion.md) so a bolt stays the same physical size across differently sized faces.

Model a fastener only when it does something the surface cannot: a head that protrudes far enough to break the silhouette, a hero prop viewed close or in the hand, or a part that animates, detaches, or carries collision/selection. Where PBR is unsupported, keep the albedo mark and drop the relief rather than adding geometry back.

## Validate the Chosen Tradeoff

At blockout, after the first repeated section, and after texturing, compare counts with the budget and check editor responsiveness. If repetition is exceeding the budget or causing severe slowdown, stop adding detail and simplify the costly pattern. Revisit the user's preference only if satisfying the request requires changing an agreed constraint.

For optimization, record before/after counts and FPS or frame time when measurable. Compare the same camera, viewport size, selection/outline state, lighting, texture mode, and number of model copies. A screenshot validates appearance, not FPS; severe editor slowdown warrants investigation but does not prove the same rate or cause in the target runtime. Check the exported asset in the target runtime with representative instance counts when access permits. Report editor and runtime measurements separately, including when the latter was not tested.

Deliver the chosen preference, final counts, texture/material setup, and observed performance or remaining measurement limits. Separate an appearance-focused source from a simplified runtime version only when the requested deliverable benefits from both; do not silently ship the expensive source as the game-ready result.
