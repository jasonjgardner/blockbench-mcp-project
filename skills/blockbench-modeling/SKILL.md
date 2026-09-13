---
name: blockbench-modeling
description: Create and edit 3D models in Blockbench using MCP tools. Use when building geometry with cubes, creating meshes, placing spheres/cylinders, editing vertices, extruding faces, or organizing models with groups. Covers both cube-based Minecraft modeling and freeform mesh editing.
---

# Blockbench Modeling

Build 3D models using cubes and meshes in Blockbench.

## Plan the Shape and Target

Use [format and delivery guidance](../blockbench-use/references/formats-and-delivery.md) when selecting a format or exporting. Block out the silhouette and proportions before UV layout and surface detail. Match polygon density to visible shape or deformation needs; automatic subdivision is not a quality step by itself.

For articulated parts, create a hierarchy with pivots at joints and unique, consistent bone names. Group origins are pivots, not translations added to a cube's `from`/`to` coordinates. Place cube bounds in the model's rest coordinate space; the hierarchy applies rotations around those pivots. Mesh vertices are mesh-local, as described below. Check overlapping surfaces for z-fighting and preview moving parts for hidden gaps. See the official [modeling overview](https://blockbench.net/wiki/guides/blockbench-overview-tips/).

## Available Tools

### Cube Tools
| Tool | Purpose |
|------|---------|
| `place_cube` | Create cubes with position, size, texture |
| `modify_cube` | Edit cube properties (position, rotation, UV, etc.) |
| `get_cube_uv` / `set_cube_uv` | Inspect/edit box or per-face cube UVs; see texturing skill |

### Mesh Tools
| Tool | Purpose |
|------|---------|
| `place_mesh` | Create meshes with indexed faces; returns UUIDs and runtime geometry keys |
| `get_mesh_info` | Inspect mesh-local positions, faces, normals, selection, textures, and optional UVs |
| `create_sphere` | Create sphere mesh |
| `create_cylinder` | Create cylinder mesh |
| `extrude_mesh` | Extrude selected face regions; edge/vertex modes are unsupported |
| `subdivide_mesh` | Subdivide selected triangles/quads into `cuts + 1` segments per edge |
| `select_mesh_elements` | Select vertices/edges/faces |
| `move_mesh_vertices` | Move selected vertices |
| `delete_mesh_elements` | Remove geometry |
| `merge_mesh_vertices` | Weld nearby vertices |
| `create_mesh_face` | Create face from vertices |
| `knife_tool` | Interactive point-list operation is unsupported through MCP |

### Element Tools
| Tool | Purpose |
|------|---------|
| `add_group` | Create bone/group |
| `list_outline` | View model hierarchy |
| `duplicate_element` | Copy elements |
| `rename_element` | Rename elements |
| `remove_element` | Delete elements |
| `find_elements_by_criteria` | Query elements by name pattern, type, parent, size |
| `select_all_of_type` | Bulk-select cubes, meshes, or groups |
| `filter_by_material` | Find elements referencing a texture |

## Cube Modeling

`place_cube` supports untextured blockout in the current source plugin; use `get_capabilities: include_tools=true` to identify the loaded build. A new texture can be created after the silhouette is established. Supplying a texture or group requires a valid existing reference. Use returned UUIDs for later edits; the literal `group="root"` or `add_group`'s `parent="root"` means outliner root. Name a real root bone `rig_root`, or use its UUID, to avoid that reserved target.

### Place a Cube

```
place_cube: elements=[{
  name: "body",
  from: [-4, 0, -2],
  to: [4, 12, 2]
}], faces=true  # Size-based Auto UV; this does not pack a texture atlas
```

### Place Multiple Cubes

```
place_cube: elements=[
  {name: "head", from: [-4, 12, -4], to: [4, 20, 4]},
  {name: "arm_left", from: [4, 4, -1], to: [6, 12, 1]},
  {name: "arm_right", from: [-6, 4, -1], to: [-4, 12, 1]}
], group="body"
```

### Modify Cube

```
modify_cube: id="body", rotation=[0, 45, 0], origin=[0, 6, 0]
```

### Cube with Texture

```
place_cube: elements=[{name: "block", from: [0,0,0], to: [16,16,16]}],
  texture="stone", faces=true
```

## Mesh Modeling

Check `get_capabilities` before creating meshes. Use a registered format with `format.features.meshes=true`, normally `free` (Generic Model).

### Create a Mesh and Retain Its IDs

The JavaScript examples below are client orchestration pseudocode: `call(name, args)` invokes that MCP tool and checks for `isError`. For JSON results, it returns `structuredContent` or the decoded JSON text; for plain-text results, it returns the text unchanged. It is not code for `risky_eval`. Variables such as `panel.uuid` and `panel.face_keys[0]` must be replaced with their returned values in actual tool arguments, never sent as literal strings.

```js
const placed = await call("place_mesh", {
  elements: [{
    name: "panel",
    vertices: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]],
    faces: [[0, 1, 2, 3]],
  }],
});
const panel = placed.meshes[0];
// panel: {name, uuid, vertex_keys: [...], face_keys: [...]}
```

Input faces use zero-based vertex **indices**. Returned `vertex_keys` and `face_keys` follow input order and hold the actual runtime keys. Later selection, face creation, and UV tools need those keys. A mesh name or UUID identifies the mesh, not its vertices or faces. Retain the UUID to avoid ambiguous names. After topology edits or undo/redo, inspect again before reusing component keys.

### Inspect Geometry and Read Every Page

For primitives or existing meshes, obtain keys with `get_mesh_info`. Vertex items contain `{key, position, selected}`; face items contain `{key, vertices, normal, selected, texture}`. Positions, bounds, and normals are **mesh-local**, before origin, rotation, and parent transforms.

```js
async function readMeshPages(meshId, part, offset = 0) {
  // part is "vertices" or "faces". Read one list independently.
  const info = await call("get_mesh_info", {
    mesh_id: meshId,
    include_vertices: part === "vertices",
    include_faces: part === "faces",
    [part === "vertices" ? "vertex_offset" : "face_offset"]: offset,
    limit: 500,
  });
  const page = info[part];
  if (page.next_offset === null) return page.items;
  return page.items.concat(await readMeshPages(meshId, part, page.next_offset));
}
```

Each list has its own `next_offset`; `null` means complete. The default limit is 100, maximum 500 per list. Finish paging before mutating geometry because keys are sorted and edits can invalidate offsets. Inspection is read-only and does not select components.

### Create Sphere

```
create_sphere: elements=[{
  name: "ball",
  position: [0, 8, 0],
  diameter: 16,
  sides: 12
}]
```

### Create Cylinder

```
create_cylinder: elements=[{
  name: "pillar",
  position: [0, 0, 0],
  diameter: 8,
  height: 24,
  sides: 12,
  capped: true
}]
```

### Extrude Face

For the unrotated, capped cylinder created above, select all cap triangles facing local +Y:

```js
const pillarFaces = await readMeshPages("pillar", "faces");
const capKeys = pillarFaces.filter(face => face.normal[1] > 0.99).map(face => face.key);
if (capKeys.length === 0) throw new Error("No upward cap faces found; inspect the mesh.");
await call("select_mesh_elements", {mesh_id: "pillar", mode: "face", elements: capKeys});
await call("extrude_mesh", {mesh_id: "pillar", mode: "faces", distance: 4});
```

### Subdivide for Detail

```
select_mesh_elements: mesh_id="ball", mode="face"  # Select all faces explicitly
subdivide_mesh: mesh_id="ball", cuts=2
```

### Move Vertices

Continue from the `panel` creation example, before changing its topology:

```js
await call("select_mesh_elements", {
  mesh_id: panel.uuid, mode: "vertex", elements: panel.vertex_keys.slice(2, 4),
});
await call("move_mesh_vertices", {mesh_id: panel.uuid, offset: [0, 2, 0]});
```

### Merge Close Vertices

```
merge_mesh_vertices: mesh_id="panel", threshold=0.1
```

### Knife Cut

The host Knife tool depends on interactive pointer state, so `knife_tool` returns an unsupported-operation error for point lists. For a scripted cut, inspect with `get_mesh_info`, construct the intended replacement vertices/faces with `place_mesh`, verify them, then replace the original geometry within the user's requested scope. Use Blockbench's interactive Knife tool when the user prefers to cut manually.

## Organization

### Create Group Hierarchy

```
add_group: name="rig_root", origin=[0, 0, 0], rotation=[0, 0, 0]
add_group: name="body", parent="rig_root", origin=[0, 12, 0]
add_group: name="head", parent="body", origin=[0, 24, 0]
```

### Add Cubes to Groups

```
place_cube: elements=[{name: "torso", from: [-4, 12, -2], to: [4, 24, 2]}],
  group="body"
```

### Duplicate Element

```
duplicate_element: id="arm_left", newName="arm_right", offset=[-8, 0, 0]
```

### View Hierarchy

```
list_outline  # Returns all groups and elements
```

## Selection & Filtering

Query the model without loading the full outline. These tools are read-only except `select_all_of_type`.

### Find Elements by Criteria

Combine any of: regex name match, substring match, type, parent-group scope, cube size bounds, selection scope.

```
# All cubes under "body" named like "arm_*"
find_elements_by_criteria: type="cube", parent_group="body", name_pattern="^arm_"

# Small cubes (under 4 units on any axis) in the currently selected elements
find_elements_by_criteria: selected_only=true, max_size=[4, 4, 4]

# Groups whose name contains "hand" (case-insensitive)
find_elements_by_criteria: type="group", name_contains="hand"
```

Returns `{ count, truncated, matches: [{ uuid, name, type, parent }] }`.

### Select All of Type

```
# Replace selection with every cube in the project
select_all_of_type: type="cube"

# Add all meshes under "head" to the current selection
select_all_of_type: type="mesh", parent_group="head", add_to_selection=true
```

### Filter by Material

Find every cube or mesh that references a specific texture. For cubes, the exact face keys are returned.

```
filter_by_material: texture="skin"
# → { texture, count, matches: [{ uuid, name, type: "cube", faces: ["north", "up"] }] }
```

Useful when refactoring textures: find all users before swapping or retiring a texture.

## Common Patterns

### Minecraft Character

This example assumes a cube format with a bone rig and a 32-unit-tall rest pose. It does not prescribe a player-skin template. The cube bounds already include their location in the character; the group pivot does not reposition them.

```
# Create hierarchy
add_group: name="rig_root", origin=[0, 0, 0]
add_group: name="body", parent="rig_root", origin=[0, 24, 0]
add_group: name="head", parent="body", origin=[0, 24, 0]
add_group: name="arm_left", parent="body", origin=[5, 22, 0]
add_group: name="arm_right", parent="body", origin=[-5, 22, 0]
add_group: name="leg_left", parent="rig_root", origin=[2, 12, 0]
add_group: name="leg_right", parent="rig_root", origin=[-2, 12, 0]

# Add geometry
place_cube: elements=[{name: "head_geo", from: [-4, 24, -4], to: [4, 32, 4]}], group="head"
place_cube: elements=[{name: "body_geo", from: [-4, 12, -2], to: [4, 24, 2]}], group="body"
place_cube: elements=[{name: "arm_left_geo", from: [4, 12, -1], to: [6, 22, 1]}], group="arm_left"
place_cube: elements=[{name: "arm_right_geo", from: [-6, 12, -1], to: [-4, 22, 1]}], group="arm_right"
place_cube: elements=[{name: "leg_left_geo", from: [0, 0, -2], to: [4, 12, 2]}], group="leg_left"
place_cube: elements=[{name: "leg_right_geo", from: [-4, 0, -2], to: [0, 12, 2]}], group="leg_right"
```

### Smooth Organic Shape

Only subdivide when the requested shape needs the extra vertices. Subdivision adds topology; it does not by itself smooth the silhouette.

```js
await call("create_sphere", {
  elements: [{name: "base", position: [0, 8, 0], diameter: 16, sides: 16}],
});
await call("select_mesh_elements", {mesh_id: "base", mode: "face"});
await call("subdivide_mesh", {mesh_id: "base", cuts: 1});
const vertices = await readMeshPages("base", "vertices");
const upperKeys = vertices.filter(vertex => vertex.position[1] > 0).map(vertex => vertex.key);
await call("move_mesh_vertices", {mesh_id: "base", offset: [0, 4, 0], vertices: upperKeys});
```

The predicate uses local Y, so `> 0` selects the upper half of this sphere even though its origin is at world Y=8. Use a predicate appropriate to the inspected geometry for other shapes.

## Tips

- Use `list_outline` to see current model structure
- Use `find_elements_by_criteria` for targeted queries instead of filtering `list_outline` results client-side
- Set group origins at joint/pivot points for animation
- Use `faces=true` for size-based cube UVs; inspect and arrange the UVs before detailed painting
- Create bone hierarchy before adding geometry
- `duplicate_element` with an offset creates a translated copy, not a mirrored shape or mirrored UV layout
- Mesh editing is more flexible but cubes are simpler for Minecraft-style models
- For a substantial rework, a `save_checkpoint` history marker can help recovery; inspect actual history entries before `undo`
