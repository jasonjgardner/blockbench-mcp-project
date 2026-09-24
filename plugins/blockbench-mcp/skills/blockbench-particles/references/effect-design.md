# Particle Effect Design

How to design effects that read well on Blockbench models and stay cheap in game. Units: sizes, speeds, offsets and radii in **blocks** (16 model units); times in **seconds**.

## Plan Before Building

Answer these for every effect and keep the answers in your report:

| Question | Why it matters |
|---|---|
| What does it communicate? (heat, magic charging, damage, wetness, speed) | Picks the preset, color family and motion. |
| Where does it spawn and what does it follow? | Picks the locator, its parent bone, and `local_space`. |
| Continuous or one-shot? How long? | Picks the trigger (keyframe vs controller state) and emitter lifetime. |
| Peak live particles? | rate × lifetime (steady) or burst count. Sets the budget. |
| Viewing distance? | Close-up effects can use fine sprites; distant ones need larger, fewer, brighter particles. |

A good effect has a clear **silhouette** (a column, a cone, a ring, a burst), a **lifecycle** (appear, develop, fade), and **variation** (random size, speed, spin and direction so it never looks stamped).

## Presets

Start from the closest preset, then change as few knobs as possible. `list_particle_presets` returns each preset's knobs.

| Preset | Look | Trigger | Common adjustments |
|---|---|---|---|
| `smoke` | Gray puffs rising, spreading, fading | continuous | `color` for soot vs steam, `rate`, `size` end for spread |
| `campfire_smoke` | Tall, slow, large soft column | continuous | `lifetime` for column height, `acceleration` y |
| `fire` | Animated flames licking up | continuous | `shape.radius` to cover the fuel, `size` |
| `flame` | One small steady flame | continuous | none; place the locator on the wick |
| `embers` | Glowing specks drifting up | continuous | `rate` (keep low), `color` |
| `sparks` | Hot burst that falls and bounces | one-shot | `burst`, `speed`, `direction` for a spray cone |
| `magic` | Swirling motes rising around a caster | continuous | `color`, `shape.radius` |
| `sparkle` | Twinkling stars over an area | continuous | `shape.half_dimensions` to the object's bounds |
| `glow` | Soft pulsing halo, a fake bloom | continuous | `size`, `color` alpha for intensity |
| `dust` | Slow motes in a room or sunbeam | continuous | `shape` to the room, `rate` 2-6 |
| `snow` | Swaying flakes from a plane above | continuous | `shape.offset` height, `rate` |
| `drip` | Occasional falling drops | continuous | `rate` 0.3-2, `color` (water, lava, honey) |
| `bubbles` | Wobbling bubbles rising | continuous | `shape.radius` to the liquid surface |
| `hearts` | A few hearts floating up | one-shot | `burst` |
| `poof` | Outward cloud burst | one-shot | `burst`, `speed`, `color` |
| `soul` | Cyan wisps rising and swelling | continuous | `rate` |
| `portal` | Motes converging to a center | continuous | `shape.radius`, `lifetime` so they reach the center |
| `steam` | Fast jet from a vent | continuous | rotate the locator to aim; `speed` |
| `electric` | Crackling blue sparks | continuous | `color`, `shape.radius` |

Continuous presets loop. On an animation keyframe, change them to `looping: false` with `duration` equal to the clip length (see the SKILL's trigger rules).

## Motion Recipes

| Want | Knobs |
|---|---|
| Rise and spread (smoke, steam) | `direction` jittered up, `acceleration` [0, 0.3-0.6, 0], `drag` 0.3-2, `size` growing |
| Fall and bounce (sparks, debris) | `acceleration` [0, -9.8, 0], `collision` with `bounciness` 0.2-0.5 (game only) |
| Burst that slows (poof, explosion) | `burst`, `direction: "outwards"`, `speed` [1, 3], `drag` 2-4 |
| Converge (charging, absorbing) | `shape` sphere `surface_only`, `direction: "inwards"`, `lifetime` ≈ radius ÷ speed |
| Orbit or follow a moving part | `local_space: true` |
| Leave a trail behind a moving part | `local_space: false`, steady `rate`, short `lifetime`, `size` shrinking |
| Sway (snow, leaves, bubbles) | raw `components` patch: `linear_acceleration` x/z = `math.sin(variable.particle_age * <deg/s> + variable.particle_random_1 * 360) * <amount>` |
| Aim a jet | Rotate the locator (Bedrock emitters follow its orientation) and fire along the effect's +Y, or set `direction` to the needed vector; confirm the aim in the preview and in game |

Speeds around 0.2-0.6 read as drifting, 1-3 as a puff, 4+ as a spray. Drag above 2 stops a burst within about half a second.

## Size, Color and Material

- **Size.** `size` is a half-width in blocks, so a particle is twice its size across. Vanilla smoke is 0.1, a flame 0.1-0.2, a soft glow 0.5 (one block across). Sizes shrink to nothing for sparks and embers (`size: [0.08, 0]`) and grow for smoke (`[0.12, 0.35]`). `size_variation` 0.3-0.6 breaks uniformity.
- **Color over life.** 2-4 stops is enough: hot to cool for fire (`#fff3b0` → `#ff9d2e` → `#5a1a0a00`), light to dark for smoke, saturated to pale for magic. `fade_out: true` sends the last stop to transparent.
- **Material.** `particles_alpha` for crisp opaque pixel sprites (hearts, notes, drips); `particles_blend` for translucent smoke and puffs; `particles_add` for anything that emits light. Additive particles vanish on white backgrounds and bloom on dark ones; judge them against the scene they will appear in.
- **Lighting.** `lighting: true` for smoke, dust and debris that should darken in shadow; leave it off for fire, magic and glow.
- **Palette.** Match the model's texture palette or its emissive accents. Two hues plus value variation is usually enough.

## Timing

- One-shots land on the contact frame (the hammer hits, the foot lands), not before it.
- Stagger layered effects by 0.05-0.15 s (flash, then sparks, then smoke) so they read as a sequence.
- Particle lifetime should outlast the action a little so the effect settles instead of cutting off.
- A continuous effect on a looping clip must look the same at the loop seam: check the clip's start and end frames in the preview.

## Budgets

Live particles ≈ `rate × lifetime` for steady emitters, `burst` for one-shots. Per emitter:

| Use | Target |
|---|---|
| Ambient loop on a prop or idle mob | 10-50 |
| Active effect (attack, casting) | 50-100 |
| Rare big moment (explosion, death) | up to 200, briefly |

Multiply by how many copies of the entity can be on screen. Prefer fewer, larger, better-textured particles over many tiny ones. `max_particles` must be at least rate × max lifetime or emission stalls at the cap.

## Layering

Complex effects are several simple emitters on the same locator, keyed at the same or staggered times: a fire is `fire` + `embers` + a little `smoke`; a spell is `magic` + `glow`; an impact is `sparks` + `poof`. Keep each layer's job distinct (core, detail, aftermath) and budget them together.

## Custom Sprites

1. Paint or generate a small sprite: 8, 16 or 32 px, transparent background, white or light gray if it will be tinted, soft alpha edges for `particles_blend`.
2. For animation, make a vertical strip of equal frames (frame 0 at the top) and pass `design.flipbook: {frame_size: [16, 16], frames: 8}`. Omit `fps` to play the frames once over each particle's life, or set `fps` and `loop` for a continuous cycle. [Flipbook textures](../../blockbench-flipbook-textures/SKILL.md) covers generating strips.
3. Pass it as `texture_image` (a Blockbench texture or a PNG path). The tool saves it to `textures/particle/<name>.png`, sets the texture path and UVs, and the preview picks it up.

A checkerboard in the preview means the texture was not found at `<pack>/<texture>.png`.

## Molang Patterns

Knobs accept Molang strings anywhere a number is allowed. Useful variables:

| Expression | Meaning |
|---|---|
| `variable.particle_age / variable.particle_lifetime` | Life fraction 0-1; the default gradient interpolant |
| `variable.particle_random_1` … `_4` | Per-particle random 0-1, stable for the particle's life (the builder uses `_3` for size variation) |
| `variable.emitter_age`, `variable.emitter_random_1` … | Emitter clock and per-emitter randoms |
| `math.random(a, b)` | New random each evaluation; fine for values read once (lifetime, speed), wrong for per-frame values |
| `math.sin(deg)` | Degrees, not radians |

`pre_effect_script` on a keyframe runs before the emitter starts, so one effect can serve several looks: key `variable.color = 1;` and read `variable.color` inside the effect.

## Common Mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Nothing appears in the preview | Not in Animate mode, keyframe has no file, or time is before the keyframe | `set_time` after the keyframe; `list_particle_effects` problems |
| Checkerboard squares | Custom texture not at `<pack>/<texture>.png` | Pass `texture_image` or move the PNG |
| Hard-edged fading | `particles_alpha` with alpha gradient | `particles_blend` or `particles_add` |
| Effect thins out, then refills | `max_particles` cap | Raise it or lower `rate` |
| Emitter never stops in game | Looping emitter on an animation keyframe | `looping: false` + `duration`, or a controller state |
| Particles float away from a moving bone | World space | `local_space: true` (or accept it for trails) |
| Giant or invisible particles | Pixels used as blocks, or the reverse | Sizes are blocks; divide model units by 16 |
| Particles twice as big as planned | `size` read as a full width | `size` is a half-width; halve it |
