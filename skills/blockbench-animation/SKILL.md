---
name: blockbench-animation
description: Create and manage animations in Blockbench using MCP tools. Use when animating 3D models, creating keyframes, managing bone rigs, editing animation curves, or working with animation timelines. Covers walk cycles, idle animations, combat animations, and complex multi-bone animations.
---

# Blockbench Animation

Create animations for 3D models using Blockbench MCP tools.

## Rig and Motion Decisions

Confirm the format's animation support and intended exporter before animating. Group-based `bone_rigging` and `manage_keyframes` operate on Blockbench groups; native armature bones and vertex weights are a separate rig type with their own tools. Do not assume these group tools animate an `ArmatureBone` merely because it has a similar name. See [MCP overview](../blockbench-mcp-overview/SKILL.md) for discovery and [format/delivery guidance](../blockbench-use/references/formats-and-delivery.md) for target requirements.

Choose the animation type before modeling, because it changes the geometry.
- Minecraft supports only rigid bone (node) animation. Split each bend into separate parts at the joint, and overlap them so rotation opens no gaps.
- Skinned deformation needs a Generic Model armature with vertex weights, edge loops at joints, and an exporter that carries the rig.
- No MCP tools author morph targets. Substitute bones, visibility keyframes, or texture flipbooks.

See [real-time asset planning](../blockbench-use/references/real-time-asset-planning.md) section 10.

Place pivots at joints and build outward through the hierarchy. Block important poses and timing first, then refine weight, contact, anticipation and follow-through as the action requires. Smooth interpolation can overshoot, and mechanical motion can be continuous; choose curves to suit the movement rather than assigning one interpolation to a whole genre. The official [Blockbench overview](https://blockbench.net/wiki/guides/blockbench-overview-tips/) explains hierarchy, pivots and timeline controls.

Animation times are seconds. Timeline FPS controls snapping, not a universal game playback rate or a guarantee that an exporter samples at that rate. Preserve the target format's rules. Inspect start, extrema and in-between poses, and the loop seam for repeating clips; equal endpoint values alone do not guarantee smooth velocity or foot contact.

## Available Tools

| Tool | Purpose |
|------|---------|
| `create_animation` | Create animation with keyframes for bones |
| `manage_keyframes` | Create/edit/delete keyframes per bone and channel |
| `animation_graph_editor` | Fine-tune animation curves (smooth, linear, ease) |
| `bone_rigging` | Create/modify bone structure for animation |
| `animation_timeline` | Control playback, time, FPS, loop settings |
| `batch_keyframe_operations` | Batch operations: offset, scale, reverse, mirror |
| `animation_copy_paste` | Copy animation data between bones/animations |

## Quick Start

### Create a Continuous Rotation

Check `get_capabilities` for `format.features.animation_mode=true` and use `list_outline` to identify the existing bone/group. Animate a shared parent group to rotate a multi-mesh object together; place that group's pivot at the intended center before adding keyframes. Preserve the user's existing project and geometry.

The examples use tool-call pseudocode. Bind `spin.uuid` to the UUID returned by `create_animation`; do not invent animation IDs or assume a name prefix. `bones` is required, including when creating an empty animation for subsequent keyframe calls.

```
spin = create_animation: name="spin", animation_length=4.0, loop=true, bones={}
manage_keyframes: animation_id=spin.uuid, action="create",
  bone_name="logo_root", channel="rotation", keyframes=[
    {time: 0, values: [0, 0, 0], interpolation: "linear"},
    {time: 1, values: [0, 90, 0], interpolation: "linear"},
    {time: 2, values: [0, 180, 0], interpolation: "linear"},
    {time: 3, values: [0, 270, 0], interpolation: "linear"},
    {time: 4, values: [0, 360, 0], interpolation: "linear"}
  ]
animation_timeline: animation_id=spin.uuid, action="set_time", time=1.0
capture_screenshot
animation_timeline: animation_id=spin.uuid, action="play"
```

Replace `logo_root` with a group returned by `list_outline`. This example turns around the Y axis once every four seconds; use Z for an in-plane spin of a logo lying in the XY plane. Quarter-turn keys preserve the intended path in quaternion-interpolated formats where equivalent orientations or a 180-degree interval can make the direction ambiguous. Inspect intermediate times and the loop boundary before playback and after export.

### Animation Channels

- `position` - [x, y, z] offset
- `rotation` - [x, y, z] degrees
- `scale` - [x, y, z] or uniform number

`manage_keyframes.values` accepts either a three-axis array or a number expanded across all three axes. Prefer an explicit array when axes differ, especially for rotations. Numeric tool channels do not imply support for arbitrary Molang, Hytale UV-offset/visibility, or effect channels. Use the corresponding specialized tool or supported native workflow. Particle keyframes, locators and effect files are covered by [Particles](../blockbench-particles/SKILL.md).

### Interpolation Types

- `linear` - Constant rate
- `catmullrom` - Smooth spline
- `bezier` - Custom curves
- `step` - Instant change

## Common Workflows

### Walk Cycle (1 second)

This is a minimal timing example for existing leg bones, not a completed walk. Check planted-foot contact, knee motion, body movement and limb clearance in the actual model before refining the cycle.

```
walk = create_animation: name="walk", animation_length=1.0, loop=true, bones={
  "leg_left": [
    {time: 0, rotation: [30, 0, 0]},
    {time: 0.5, rotation: [-30, 0, 0]},
    {time: 1.0, rotation: [30, 0, 0]}
  ],
  "leg_right": [
    {time: 0, rotation: [-30, 0, 0]},
    {time: 0.5, rotation: [30, 0, 0]},
    {time: 1.0, rotation: [-30, 0, 0]}
  ]
}
```

### Smooth Curves

```
animation_graph_editor: animation_id=walk.uuid,
  bone_name="leg_left", channel="rotation", action="smooth"
```

### Batch Timing Adjustment

Batch operations use the active animation. `selection="all"` includes hidden/collapsed animators, so use `selected`, `range`, or `pattern` when the request covers fewer keyframes. Confirm the active animation before editing. Timing operations reject negative/out-of-range times and duplicate times within a channel.

```
batch_keyframe_operations: operation="scale", selection="all",
  parameters={scale_factor: 2.0}  # Double keyframe times around zero
animation_timeline: animation_id=walk.uuid, action="set_length", length=2.0
```

`scale` scales keyframe times around `scale_pivot` (default zero). `offset_values` adds numeric XYZ components; `mirror` negates the requested component and is not an anatomical left/right retargeting operation. Numeric value edits require transform keyframes with one data point; use native tools for expressions or pre/post values. Current batch edits validate before applying one undoable transaction.

### Bake Numeric Curves

In the current source plugin, `operation="bake"` samples original continuous numeric transform curves before inserting linear keys. It affects each selected channel between its first and last selected times, retains existing sample times/endpoints, restores the playhead, and caps the total at 10,000 samples.

```
batch_keyframe_operations: operation="bake", selection="selected",
  parameters={bake_interval: 0.05}
```

Select at least two times per intended channel. The interval is seconds (minimum 0.001); choose it for the motion/export target. Expressions, effect channels, step curves and pre/post data points are rejected. Baking only part of a smooth channel can alter adjacent interpolation because the boundary keys become linear; bake a whole channel when continuity outside a selected span must be preserved. Inspect sampled poses and destination output before relying on the bake.

## Bone Rigging

### Copy Between Existing Bones

The current `animation_copy_paste` preserves native transform data points, expressions, pre/post values, interpolation and detached Bezier handles. Copy is read-only with respect to model/history; paste is one undoable animation edit.

```
animation_copy_paste: action="copy", source={animation: walk.uuid,
  bone: "leg_left", channels: ["rotation"], time_range: {start: 0, end: 1}}
animation_copy_paste: action="mirror_paste", target={animation: walk.uuid,
  bone: "leg_right", time_offset: 0, mirror_axis: "x"}
```

Paste uses exact unsnapped timestamps and replaces existing keys at the same channel/time. Inspect the target before overwriting it. `mirror_paste` uses the native spatial mirror: position negates the chosen axis, rotation negates the other two axes, and scale is preserved; curve handles follow the mirrored values. This differs from batch `mirror`, which negates one numeric component. Inspect the mirrored pose against the rig's actual pivots and orientation; copying channels does not retarget a differently proportioned skeleton. Clipboard contents persist until the next copy or plugin reload.

### Create Bone Structure

```
bone_rigging: action="create", bone_data={name: "spine", origin: [0, 12, 0]}
bone_rigging: action="create", bone_data={name: "head", origin: [0, 24, 0], parent: "spine"}
```

### Set Pivot Point

```
bone_rigging: action="set_pivot", bone_data={name: "arm_left", origin: [4, 22, 0]}
```

## Timeline Control

Pass the returned animation UUID as `animation_id` to target a timeline explicitly. Omitting it uses the selected animation; `create_animation` selects its result. Batch operations use the active animation, so confirm its selection first. They may extend length to contain moved keys; set the requested final clip length explicitly when timing changes.

```
animation_timeline: animation_id=spin.uuid, action="set_fps", fps=60
animation_timeline: animation_id=spin.uuid, action="loop", loop_mode="loop"  # or "once", "hold"
animation_timeline: animation_id=spin.uuid, action="set_time", time=0.5
animation_timeline: animation_id=spin.uuid, action="play"
```

## Tips

- Use `list_outline` to see available bones before animating
- Set up bone hierarchy first with `bone_rigging` before adding keyframes
- Use `catmullrom` for smooth paths when appropriate, then inspect for overshoot
- Use `step` for intentional holds and abrupt pose changes
- For exact rotation values, use `manage_keyframes` with explicit per-axis values; inspect copied or mirrored poses as well as their tool result

## Export Verification

Preserve an editable project when the handoff needs one. Discover the actual animation export workflow: a model codec does not necessarily export separate animation files, controllers or effects. Bedrock animation JSON and Hytale `.blockyanim` assets must accompany the appropriate model when requested. Verify names, duration, interpolation and loop behavior in the destination when available.

Molang expressions require format/runtime support; glTF and FBX cannot retain arbitrary expression-driven behavior. Baking can approximate a chosen time sequence but cannot preserve a variable-driven state machine. The current batch bake supports numeric curves only; expression baking requires an appropriate native workflow. See [Blockbench animation expressions](https://blockbench.net/wiki/guides/animation-expressions/).
