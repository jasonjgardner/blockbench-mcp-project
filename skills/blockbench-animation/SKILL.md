---
name: blockbench-animation
description: Create and manage animations in Blockbench using MCP tools. Use when animating 3D models, creating keyframes, managing bone rigs, editing animation curves, or working with animation timelines. Covers walk cycles, idle animations, combat animations, and complex multi-bone animations.
---

# Blockbench Animation

Create animations for 3D models using Blockbench MCP tools.

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
    {time: 2, values: [0, 180, 0], interpolation: "linear"},
    {time: 4, values: [0, 360, 0], interpolation: "linear"}
  ]
animation_timeline: animation_id=spin.uuid, action="set_time", time=1.0
capture_screenshot
animation_timeline: animation_id=spin.uuid, action="play"
```

Replace `logo_root` with a group returned by `list_outline`. This example turns around the Y axis once every four seconds; use Z for an in-plane spin of a logo lying in the XY plane. Keep the final angle at 360 degrees, with linear interpolation, for a continuous turn. Inspect a nonzero time before playback to verify the model moves around the intended pivot.

### Animation Channels

- `position` - [x, y, z] offset
- `rotation` - [x, y, z] degrees
- `scale` - [x, y, z] or uniform number

### Interpolation Types

- `linear` - Constant rate
- `catmullrom` - Smooth spline
- `bezier` - Custom curves
- `step` - Instant change

## Common Workflows

### Walk Cycle (1 second)

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

```
batch_keyframe_operations: operation="scale", selection="all",
  parameters={scale_factor: 2.0}  # Double keyframe times around zero
animation_timeline: animation_id=walk.uuid, action="set_length", length=2.0
```

## Bone Rigging

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

Pass the returned animation UUID as `animation_id` to target a timeline explicitly. Omitting it uses the selected animation; `create_animation` selects its result. Batch operations use the active timeline, so confirm its selection first. Increasing keyframe times requires updating the animation length separately.

```
animation_timeline: animation_id=spin.uuid, action="set_fps", fps=60
animation_timeline: animation_id=spin.uuid, action="loop", loop_mode="loop"  # or "once", "hold"
animation_timeline: animation_id=spin.uuid, action="set_time", time=0.5
animation_timeline: animation_id=spin.uuid, action="play"
```

## Tips

- Use `list_outline` to see available bones before animating
- Set up bone hierarchy first with `bone_rigging` before adding keyframes
- Use `catmullrom` interpolation for organic movement
- Use `step` interpolation for mechanical/robotic movement
- For exact rotation values, use `manage_keyframes` with explicit per-axis values. Copy/paste and batch value-offset/mirror operations currently have unresolved value-handling bugs; do not rely on their success text as verification.
