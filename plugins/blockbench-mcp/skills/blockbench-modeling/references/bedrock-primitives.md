# Bedrock Poles, Cylinders, and Tubes

Use this reference for round-looking shafts, pipes, columns, rings, and similar primitives in Bedrock models. Build a polygonal prism from rotated cuboids when the target uses cube geometry. Choose its facet count through the existing [appearance/performance preference](../../blockbench-use/references/appearance-and-performance.md), then preserve [UV proportions and material scale](../../blockbench-texturing/references/uv-scale-and-distortion.md).

## Choose the Construction

Inspect the active format and live tool schemas first. Standard Blockbench Bedrock block/entity workflows support rotated cubes; `create_cylinder` and `create_sphere` create meshes and require a mesh-capable format. Use `place_cube` for these constructions. Do not convert a Bedrock project to Generic Model solely to access a mesh primitive and assume it will export back unchanged.

The supplied `shape_generator.js`, version 0.0.3 by dragonmaster95 ([upstream source](https://github.com/JannisX11/blockbench-plugins/blob/master/plugins/shape_generator.js)), supplies useful examples: `determineShape`, `generateOctagonFilled`, `generateHexadecagonFilled`, and their `Bordered` variants. They arrange overlapping cuboids around one pivot; they do not create a Boolean union or a smooth mesh. Use the calculations below with current MCP arguments rather than copying the plugin's legacy Cube constructor or UI code.

| Need | Construction | Initial cost before face cleanup |
|---|---|---|
| Small or distant shaft whose square profile is acceptable | One cuboid, material shading where useful | 1 cube, up to 6 quad faces |
| Solid octagonal shaft | Four bars sharing a center, rotated in 45-degree increments | 4 cubes, up to 24 quad faces |
| Solid 16-sided shaft | Eight bars sharing a center, rotated in 22.5-degree increments | 8 cubes, up to 48 quad faces |
| Open octagonal tube | Eight wall strips around the opening | 8 cubes, up to 48 quad faces |
| Open 16-sided tube | Sixteen wall strips around the opening | 16 cubes, up to 96 quad faces |
| Ring or collar | Shorten the tube's axial length | Same cross-section cost as the chosen tube |

These are starting options, not required quality tiers. Choose the smallest facet count that preserves the visible outline at the intended distance. A long straight shaft can use the same number of cuboids as a short one; do not subdivide its length unless shape, articulation, export bounds, or a justified UV strategy requires it. Account for repeated shafts across the whole model. HD textures and surface relief do not require more radial facets.

## Define the Dimensions

Let `N` be the number of sides, `H` the axial length, and `C = [cx, cy, cz]` the center. For the solid-bar formula use an even integer `N >= 6`; the 8- and 16-sided cases reproduce the supplied plugin's proportions. A square needs only one cube.

Use `D` for the diameter **across opposite flat faces**, and `s` for one polygon side's width. The plugin's octagon and hexadecagon `diameter` follows this convention, even though it is labeled simply "Diameter/Length" in its UI.

```text
alpha = pi / N                         # radians for trigonometry
a = D / 2                              # apothem: center to a flat face
s = D * tan(alpha)
rotation_step = 360 / N                 # degrees for MCP rotations
corner_radius = a / cos(alpha)

Given a desired outside corner radius R instead:
D = 2 * R * cos(alpha)
s = 2 * R * sin(alpha)
```

For `N = 8`, `s / D = 0.414213562373095`; for `N = 16`, it is `0.198912367379658`, matching the plugin's constants. For `D = 4`, the side widths are approximately `1.65685425` and `0.79564947`. Keep adequate numeric precision and verify the silhouette before rounding to a texture grid.

State which diameter convention the design uses. A polygon with a given flat-to-flat diameter reaches farther at its corners; its rotated bounds can differ from `D`. If a shaft must fit inside a circular envelope, derive `D` from that envelope's radius. Require positive finite dimensions, a valid side count, and a finite center and phase angle.

## Solid Prisms from Centered Bars

For a Y-axis shaft, each unrotated bar has dimensions `[s, H, D]` and bounds:

```text
from = [cx - s/2, cy - H/2, cz - D/2]
to   = [cx + s/2, cy + H/2, cz + D/2]
origin = C
rotation = [0, phase + i * 360/N, 0]     # i = 0 ... N/2 - 1
```

All bars rotate around the same center. For the four-cube octagon, the angles are `0, 45, 90, 135` degrees plus the desired phase. Two full squares rotated 45 degrees against each other produce a different outline; they are not a substitute for these proportions.

Example client-side calculation for `place_cube` arguments; this is ordinary arithmetic outside Blockbench, not a `risky_eval` script:

```js
const sides = 8;
const diameter = 4;
const length = 16;
const center = [0, 8, 0];
const phase = 0;
const sideWidth = diameter * Math.tan(Math.PI / sides);

const cubeBatch = {
  elements: Array.from({length: sides / 2}, (_, index) => ({
    name: `shaft_bar_${index + 1}`,
    from: [center[0] - sideWidth / 2, center[1] - length / 2, center[2] - diameter / 2],
    to: [center[0] + sideWidth / 2, center[1] + length / 2, center[2] + diameter / 2],
    origin: [...center],
    rotation: [0, phase + index * 360 / sides, 0],
  })),
  faces: true,
};
```

Pass `cubeBatch` to the discovered `place_cube` tool, adding an existing group UUID if needed, and retain returned element IDs. `faces: true` requests size-based Auto UV, which still needs inspection and atlas planning for fractional dimensions and HD textures. `faces: false` skips texture assignment; it is not a hidden-face removal operation.

The bars fill the cross-section collectively, but their interior faces remain separate geometry. Their top/bottom faces overlap in the same planes. Hidden ends are a useful fit for this construction. When an end is visible, inspect it for z-fighting and inconsistent grain; resolve the overlapping cap surfaces with a suitable Bedrock-compatible cap layout or change the construction before repeating the part. Moving caps by arbitrary tiny offsets can leave a stepped end and does not make a clean union. Remove a whole face only when it is fully hidden throughout required views and poses and its omission survives export.

## Hollow Tubes and Rings

For the 8- or 16-sided tube, use one strip per side instead of bars crossing the center. Let `t` be wall thickness measured perpendicular to a flat face, with `0 < t < a`. If the intended inner flat-to-flat diameter is `D_inner`, use `t = (D - D_inner) / 2`.

One Y-axis wall strip starts on the positive-Z side:

```text
from = [cx - s/2, cy - H/2, cz + a - t]
to   = [cx + s/2, cy + H/2, cz + a]
origin = C
rotation = [0, phase + i * 360/N, 0]     # i = 0 ... N - 1
```

For an octagonal tube with `D = 4`, `H = 16`, `t = 0.25`, and `C = [0, 8, 0]`, the first strip runs from approximately `[-0.82842712, 0, 1.75]` to `[0.82842712, 16, 2]`. Rotate eight copies about `C`; the inner flat-to-flat diameter is `3.5`. All strip pivots must stay on the tube axis, rather than at each strip's own center.

Square-ended strips overlap at their inner corners; this is a cuboid approximation of a mitered tube. Inspect the bore, rim, and both ends for overlap artifacts. Preserve visible inner walls and rim faces. Do not cover an intended opening with a full cap or paint a dark circle onto a solid shaft when a visible through-hole is required. If the bore cannot be seen in the intended views, a solid construction can save elements within the agreed design preference.

## Orient, Texture, and Verify

- For X- or Z-axis shafts, permute the bounds and rotation axis consistently. For arbitrary directions, build around a local principal axis and orient the assembly through a supported parent group/bone with a deliberate pivot. Adding Euler angles component by component does not reliably compose the axial facet rotation with a diagonal shaft orientation. Group pivots do not translate cube bounds.
- MCP cube `origin` means its pivot; raw Bedrock JSON cube `origin` means its unrotated lower corner, with `pivot` stored separately. The Bedrock codec also converts coordinate conventions. Use the exporter rather than copying MCP arguments directly into `.geo.json`. See the [Bedrock geometry schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/schemasreference/schemas/minecraftschema_geometry_1.21.0?view=minecraft-bedrock-stable).
- Assign side UVs from actual face width and axial length, keeping grain size consistent between shafts of different diameters or lengths. Use separate, proportionate mappings for end/rim faces. A solid bar's long internal face has different dimensions from its exposed `s × H` outer face; do not reuse one full UV rectangle indiscriminately. Check fractional UV sizes, seams, and all PBR channels using the [UV scale guide](../../blockbench-texturing/references/uv-scale-and-distortion.md).
- Inspect one section in an axial orthographic view for equal facets, the correct flat/corner diameter, and a centered opening when applicable. Check side and oblique views for alignment, cap overlap, and texture scale before duplication. Count actual elements and enabled/exported faces rather than treating `N` silhouette sides as the total geometry cost.
- Verify rotated bounds and the destination's block/entity requirements. For custom blocks, follow the modeling skill's [oversized-block workflow](../SKILL.md#oversized-bedrock-blocks) and [material-instance guidance](../../blockbench-use/references/bedrock-material-instances.md) where applicable. The old plugin's canvas checks are not current Bedrock block validation. Reopen/export a representative section and inspect it in the target runtime when available.
