# Bedrock Particle Format

A cheat sheet for editing particle JSON directly, through `raw`, the `components` patch, or `update_particle_effect`. The design knobs cover most needs; use this for events, curves, parametric motion, kill planes and anything else they do not expose. Blockbench (via Wintersky) previews every component listed here.

## Skeleton

```json
{
  "format_version": "1.10.0",
  "particle_effect": {
    "description": {
      "identifier": "mymod:chimney_smoke",
      "basic_render_parameters": { "material": "particles_blend", "texture": "textures/particle/particles" }
    },
    "curves": {},
    "events": {},
    "components": {
      "minecraft:emitter_rate_steady": { "spawn_rate": 6, "max_particles": 20 },
      "minecraft:emitter_lifetime_looping": { "active_time": 10 },
      "minecraft:emitter_shape_sphere": { "radius": 0.1, "direction": "outwards" },
      "minecraft:particle_lifetime_expression": { "max_lifetime": "math.random(1.5, 2.5)" },
      "minecraft:particle_initial_speed": "math.random(0.2, 0.4)",
      "minecraft:particle_motion_dynamic": { "linear_acceleration": [0, 0.35, 0], "linear_drag_coefficient": 0.4 },
      "minecraft:particle_appearance_billboard": {
        "size": ["math.lerp(0.2, 0.5, variable.particle_age / variable.particle_lifetime)", "math.lerp(0.2, 0.5, variable.particle_age / variable.particle_lifetime)"],
        "facing_camera_mode": "lookat_xyz",
        "uv": { "texture_width": 128, "texture_height": 128, "flipbook": { "base_UV": [56, 0], "size_UV": [8, 8], "step_UV": [-8, 0], "frames_per_second": 8, "max_frame": 8, "stretch_to_lifetime": true } }
      },
      "minecraft:particle_appearance_tinting": {
        "color": { "gradient": { "0.00": [0.54, 0.54, 0.54, 0.8], "1.00": [0.35, 0.35, 0.35, 0] }, "interpolant": "variable.particle_age / variable.particle_lifetime" }
      },
      "minecraft:particle_appearance_lighting": {}
    }
  }
}
```

Every effect needs an identifier, a material and texture, **one rate component, one emitter lifetime component, a billboard, and a particle lifetime**. The validators in both tool sets refuse files missing the first four and warn about the last.

Texture paths are pack-relative without `.png`. Colors are `[r, g, b, a]` in 0-1 (the builder converts `#RRGGBBAA` knobs). Keys are case-sensitive; unknown `minecraft:` names are silently ignored by the game, which is why the validator flags them.

## Emitter Components

| Component | Fields | Notes |
|---|---|---|
| `emitter_rate_steady` | `spawn_rate`, `max_particles` | Continuous emission. |
| `emitter_rate_instant` | `num_particles` | Burst at emitter start. |
| `emitter_rate_manual` | `max_particles` | Spawned by events or game code only. |
| `emitter_lifetime_looping` | `active_time`, `sleep_time` | Repeats. Never stops unless a controller state ends it. |
| `emitter_lifetime_once` | `active_time` | Runs once, then expires after its particles die. |
| `emitter_lifetime_expression` | `activation_expression`, `expiration_expression` | Molang-controlled. |
| `emitter_lifetime_events` | `creation_event`, `expiration_event`, `timeline`, `travel_distance_events`, `looping_travel_distance_events` | Fire events. |
| `emitter_shape_point` | `offset`, `direction` (vector) | |
| `emitter_shape_sphere` | `offset`, `radius`, `surface_only`, `direction` | `direction`: `outwards`, `inwards` or a vector. |
| `emitter_shape_box` | `offset`, `half_dimensions`, `surface_only`, `direction` | |
| `emitter_shape_disc` | `offset`, `radius`, `plane_normal`, `surface_only`, `direction` | `plane_normal` `[0,1,0]` lies flat. |
| `emitter_shape_entity_aabb` | `surface_only`, `direction` | The entity's hitbox; approximate in the preview. |
| `emitter_shape_custom` | `offset`, `direction` | Molang offsets per particle. |
| `emitter_initialization` | `creation_expression`, `per_update_expression` | Set emitter variables (`variable.x = ...;`). |
| `emitter_local_space` | `position`, `rotation`, `velocity` | Particles move with the emitter. |

## Particle Components

| Component | Fields | Notes |
|---|---|---|
| `particle_lifetime_expression` | `max_lifetime`, `expiration_expression` | |
| `particle_initial_speed` | number or Molang | Along the spawn direction. |
| `particle_initial_spin` | `rotation`, `rotation_rate` | Degrees. |
| `particle_initialization` | `per_update_expression`, `per_render_expression` | Per-particle variables, as in vanilla `campfire_smoke`. |
| `particle_motion_dynamic` | `linear_acceleration`, `linear_drag_coefficient`, `rotation_acceleration`, `rotation_drag_coefficient` | Physics-style motion. |
| `particle_motion_parametric` | `relative_position`, `direction`, `rotation` | Position as a function of time (spirals, orbits). Replaces dynamic motion. |
| `particle_motion_collision` | `enabled`, `collision_radius` (≤ 0.5), `collision_drag`, `coefficient_of_restitution`, `expire_on_contact`, `events` | Blocks only; nothing to hit in Blockbench. |
| `particle_kill_plane` | `[a, b, c, d]` | Kill particles crossing a plane. |
| `particle_expire_if_in_blocks` / `_not_in_blocks` | block IDs | e.g. bubbles that die outside water. |
| `particle_lifetime_events` | `creation_event`, `expiration_event`, `timeline` | |
| `particle_appearance_billboard` | `size`, `facing_camera_mode`, `direction`, `uv` | `uv` static (`uv`, `uv_size`) or `flipbook` (`base_UV`, `size_UV`, `step_UV`, `frames_per_second`, `max_frame`, `stretch_to_lifetime`, `loop`). |
| `particle_appearance_tinting` | `color` | Static array, or `{gradient: {"0.0": [...], ...}, interpolant}`. |
| `particle_appearance_lighting` | `{}` | Shade by world light. |

Facing modes: `lookat_xyz` (faces camera), `lookat_y` (upright), `rotate_xyz`, `rotate_y`, `direction_x|y|z` and `lookat_direction` (align to velocity; pair with `direction: {mode: "derive_from_velocity"}`), `emitter_transform_xy|xz|yz` (flat in emitter space, for ground rings and shockwaves).

## Events

Events spawn child effects, sounds or expressions:

```json
"events": {
  "pop": { "particle_effect": { "effect": "mymod:splash", "type": "particle" } },
  "sizzle": { "sound_effect": { "event_name": "random.fizz" } }
},
"components": {
  "minecraft:particle_lifetime_events": { "expiration_event": "pop" },
  "minecraft:particle_motion_collision": { "collision_radius": 0.05, "expire_on_contact": true, "events": [{ "event": "sizzle", "min_speed": 0.5 }] }
}
```

`type` is `emitter`, `emitter_bound` or `particle`. A child effect is another particle file with its own identifier; ship it too. Blockbench previews child effects when it can find their files in the same `particles` folder.

## Curves

Curves turn an input into a value, useful for size or color shaping without long Molang:

```json
"curves": {
  "variable.puff": { "type": "catmull_rom", "input": "variable.particle_age", "horizontal_range": "variable.particle_lifetime", "nodes": [0, 0.3, 1, 0.6, 0] }
}
```

Then use `variable.puff` in `size`. Types: `linear`, `bezier`, `bezier_chain`, `catmull_rom` (first and last nodes are control points).

## Worked Examples

Mojang's [vanilla particle files](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/particles) are the best reference for real-world values: `basic_smoke`, `campfire_smoke`, `soul`, `endrod`, `sparkler`, `water_drip`, `critical_hit`. Snowstorm (<https://snowstorm.app>) opens and edits any of these files with a live preview and writes the same format.
