# Delivering Particle Effects

A particle effect is several files that must agree: the effect JSON, its texture, locators in the geometry, keyframes or controller states, and (on Bedrock) the client entity's name map. A model export alone delivers none of the effect files.

## Bedrock Resource Pack

Layout (the one Blockbench's preview also resolves, so author into it from the start):

```
RP/
  particles/dragon_smoke.json            ← export_particle_pack / bbmodel_particle_pack
  textures/particle/dragon_smoke.png     ← only for custom textures
  models/entity/dragon.geo.json          ← export_model; bones carry "locators"
  animations/dragon.animation.json       ← animation export; "particle_effects" keyframes
  animation_controllers/dragon.animation_controllers.json   ← only for controller-state effects
  entity/dragon.entity.json              ← client entity; you add "particle_effects"
```

1. `export_particle_pack: destination="<RP>"` (headless: `bbmodel_particle_pack`). It writes the effects the model uses, copies custom textures, and returns `client_entity.particle_effects`.
2. Export the geometry. Locators appear under their bones:
   ```json
   { "name": "head", "pivot": [0, 24, 0], "locators": { "mouth": [0, 26, -7] } }
   ```
3. Export the animations (Bedrock animation JSON). Particle keyframes become:
   ```json
   "animation.dragon.breathe": {
     "loop": true, "animation_length": 2,
     "particle_effects": { "0.0": { "effect": "dragon_smoke", "locator": "mouth" } }
   }
   ```
4. Merge the returned map into the client entity's `description`, next to `animations`:
   ```json
   "particle_effects": { "dragon_smoke": "mymod:dragon_smoke" }
   ```
   Attachables (`minecraft:attachable`) take the same `particle_effects` map in their description.
5. Save the editable `.bbmodel` alongside.

Test an effect alone in game with `/particle mymod:dragon_smoke ~ ~1 ~`, then on the entity. Content-log errors name the bad file and field.

### Controller States

Sustained effects belong on controller states, which start their emitters on entry and end them on exit (Microsoft's [particle entity integration](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/particlesreference/particleentityintegration?view=minecraft-bedrock-stable) documents both behaviors). The MCP tools do not edit controllers. Add the particle in Blockbench's Animation Controllers panel (Animate mode, Bedrock Entity format) or write the JSON:

```json
"controller.animation.dragon.breath": {
  "initial_state": "default",
  "states": {
    "default": { "transitions": [{ "breathing": "query.is_charging" }] },
    "breathing": {
      "particle_effects": [{ "effect": "dragon_smoke", "locator": "mouth" }],
      "transitions": [{ "default": "!query.is_charging" }]
    }
  }
}
```

A looping emitter is safe here. On an animation keyframe it is not: timeline effects are fire-and-forget, so use `looping: false` with `duration` equal to the clip length and key it at 0 on a looping clip.

### Keyframe Fields

| Field | Effect |
|---|---|
| `effect` | Name looked up in the client entity's `particle_effects` map. |
| `locator` | Spawn point that the emitter follows, including rotation. Omitted: entity origin. |
| `pre_effect_script` | Molang run before the emitter starts; set `variable.*` the effect reads. |
| `bind_to_actor` | `false` leaves the emitter in the world where it spawned (ground impacts, footprints). |

## GeckoLib

GeckoLib animation JSON uses the Bedrock animation format, so particle keyframes (`effect`, `locator`, `pre_effect_script`) export with the animations. GeckoLib does not read Bedrock particle JSON: your mod's code receives each keyframe and spawns real particles. In GeckoLib 4 that is the controller's particle keyframe handler (`setParticleKeyframeHandler`), which receives the keyframe data (effect, locator, script). Check the handler API for the GeckoLib version you target.

- Name effects after what the handler understands: a registered particle type (`minecraft:flame`) or your own key the handler maps to particles.
- The Bedrock effect file is still worth making: it is the Blockbench preview and documents the intended look (color, rate, spread) for whoever writes the handler.
- Resolving a locator name to a position is the handler's job; a bone of the same name is a common approach. State the convention in the handoff.
- `manage_particle_keyframes` accepts effect names with no file (they export without a preview) and warns about them.

## Targets Without Particles

glTF/GLB, OBJ, FBX, Java block/item models and Hytale models do not carry particle systems. Choose one of these, and say which in the handoff:

1. **Sockets for the runtime (usually best).** Add named empty groups (or null objects) at each spawn point, such as `fx_smoke_mouth`, oriented along the intended emission direction. glTF exports them as nodes, so the engine's particle system can attach there. Document each socket's effect, rate, colors and timing, using the Bedrock effect as the visual spec. If the Babylon.js node-particle MCP tools are available, the engine-side effect can be authored there and attached to the socket nodes.
2. **Baked fake particles in geometry.** For a few large, slow elements (a smoke plume, a glow halo, a fixed flame), model crossed quads or small cubes with an emissive or translucent texture and animate them with bone scale, position and visibility keyframes that glTF carries. Start at scale 0, grow, drift and shrink to 0 so they vanish between uses. Keep counts low; each "particle" is real geometry.
3. **Emissive flipbook textures** for flames, screens and lava surfaces in Minecraft targets. See [flipbook textures](../../blockbench-flipbook-textures/SKILL.md). Java block models animate through `.png.mcmeta`; the particles themselves (a campfire's smoke) come from game code, which resource packs cannot add.
4. **Hytale:** Hytale's particle systems are authored outside Blockbench. Deliver named attachment points per [Hytale](../../blockbench-hytale/SKILL.md) guidance and describe the intended effect.

## Handoff Checklist

- [ ] Effect files validate (`list_particle_effects` shows no problems) and use your namespace.
- [ ] Custom textures are in `textures/particle/` and show in the preview (no checkerboard).
- [ ] Locators exist, are parented to the right bones, and are exported in the geometry.
- [ ] Keyframes sit on the right frames; continuous effects use the right trigger.
- [ ] Client entity `particle_effects` covers every keyframe effect name.
- [ ] Preview screenshots at start, peak and loop seam; in-game or engine check done or explicitly listed as remaining.
