# What Each Form Answer Means

Turn every answer into concrete numbers in `plan.md` before building. The tables are starting points; adjust them to the subject and say so in the plan.

Units: 16 Blockbench units = 1 Minecraft block = 1 m. Texel density is pixels per Blockbench unit (px/u).

## Quality

| Answer | Geometry | Surface | Blender |
|---|---|---|---|
| High-quality | Appearance first. Meshes where cubes cannot hold the silhouette; rounded parts get 12–24 segments; hero asset typically 150–600 elements. Bevel real edges that catch light. | Detail lives in textures and PBR channels, not in fastener geometry (see blockbench-use's appearance guide). | Smooth-by-angle on rounded parts, a light bevel modifier allowed. |
| Low-poly | Deliberately faceted: bold silhouette, 6–10 segments on round parts, hero ≤ ~2k triangles, props ≤ ~300. No micro detail. | Large flat color regions, gradients or simple ramps. | Flat shading, no subdivision; let lighting sell the facets. |

## Textures

The first question picks the style. **Only PBR asks the follow-up** for resolution.

| Answer | Density and size | Filtering | Channels | How to make it |
|---|---|---|---|---|
| PBR · 2K | ~32 px/u; 2048² atlases or tiling materials | Linear | albedo, normal, MER (or roughness/metal), height optional | Albedo with [GPT Image textures](../../blockbench-gpt-image-textures/SKILL.md) (or painting), maps with [albedo to PBR](../../blockbench-albedo-to-pbr/SKILL.md), assignment with [PBR materials](../../blockbench-pbr-materials/SKILL.md) |
| PBR · HD | 8–16 px/u (128–256 px per block); 512–1024² | Linear | same | same |
| PBR · standard | 1–2 px/u (16×–32× per block), Bedrock RTX look | Closest | albedo, normal (or height), MER | Paint pixel art ([texturing](../../blockbench-texturing/SKILL.md)), derive maps, assign |
| Vanilla Minecraft | 1 px/u, 16× | Closest | albedo only (vanilla `texture_set.json` if the skill fetches one) | [Vanilla textures](../../blockbench-vanilla-textures/SKILL.md) for named blocks; paint the rest to match the vanilla palette |
| Classic Blockbench | 1–2 px/u painted pixel art | Closest | albedo only | [Texturing](../../blockbench-texturing/SKILL.md): hand-shaded pixel art, one atlas per model |

AI-generated albedo needs a `FAL_KEY`. When it is missing, say so once and paint procedurally instead of stopping.

Keep one texel density across the whole scene. A 2K hero next to 16× props reads as two games.

## Animation

| Answer | Needs | Build |
|---|---|---|
| Animated | Headless server only | Keyframed clips written with `bbmodel_edit`. One clip per shot or one continuous clip as long as the render. Verify with `bbmodel_validate_animations`, `bbmodel_sample_pose` and posed renders at several times; check the loop seam when it loops. Follow [animation](../../blockbench-animation/SKILL.md) for pivots and timing. |
| Havok physics | Blockbench desktop, the desktop MCP plugin and the **Havok Physics Animations** plugin (`havok_*` tools) | Author the scene headlessly, then bake physics in desktop. See [Havok bakes](#havok-bakes). If the plugin is not available, stop and offer keyframed animation instead. |

Every choice renders a moving shot: even a still subject gets camera motion (orbit, push-in or parallax) so the FFmpeg output is a real clip.

### Havok bakes

1. Headless authoring: static scenery as ungrouped elements or `dynamic: false` groups; **one root group per rigid body** with that body's elements as direct children (nested groups become separate bodies joined together). Leave small gaps: bodies that start interpenetrating explode at t=0.
2. Open the file in desktop (`blockbench_launch` with `wait_for_mcp_ms`), then use the desktop MCP: `havok_set_body_physics` for per-body `dynamic`, `mass`, `linearVelocity`, `angularVelocity` (wildcards allowed), then `havok_simulate_physics`. Read its dynamic/static body summary every run; a scenery group listed as dynamic is a setup bug.
3. Units: pass `unitsPerMeter` (16 for block scale, 39.37 for 1 unit = 1 inch). Desk-sized or slow objects stall at true scale; raise `solverScale` (10–100). Keyframed movers use `driveWith: "animation.<clip>"`; supports that give way use per-body `removeAt`; extend a bake with `continueFrom`.
4. Meshes collide as convex hulls (sphere-like meshes as true spheres), so hollow containers must be built from convex segments.
5. Save the baked `.bbmodel` and continue the pipeline from it.

## Scene type

| Answer | Content | Camera and light |
|---|---|---|
| Simple 3D scene | Subject + ground + 2–5 supporting props that explain its context. | One or two cameras; sun + sky or three-point lighting. |
| Complete 3D scene | Subject in a full environment: foreground, midground and background layers, 10+ props, set dressing, a backdrop or sky. Build props in parallel. | Several shots cut with timeline markers; atmosphere (light haze or fog) for depth. |
| Simple 3D vignette | Subject on a small diorama base (a plinth, slab or cut-earth chunk) with a few props; nothing past the base edge. | Turntable or slow orbit; soft key light, rim light, dark gradient or transparent backdrop. |
| 3D isometric room | Cutaway room: floor and two back walls (open toward the camera), furnished around the subject; windows, interior lamps. | Orthographic camera at true isometric angles (rotation X 54.736°, Z 45°); lamps and emissive props light the interior; slow ortho pan or no camera move with animated contents. |

## Render presets

| Preset | Resolution | Frame rate · length | Cycles samples |
|---|---|---|---|
| 1080p | 1920×1080 | 30 fps · 10 s (300 frames) | 128 adaptive + OIDN |
| 4K UHD | 3840×2160 | 30 fps · 10 s | 96 adaptive + OIDN |
| Square loop | 1080×1080 | 30 fps · 6 s seamless loop | 128 adaptive + OIDN |
| Quick preview | 1280×720 | 24 fps · 5 s | 32 adaptive + OIDN |

Estimate the render time from the verification stills (seconds per frame × frames ÷ GPUs, roughly) and put it in the final report.
