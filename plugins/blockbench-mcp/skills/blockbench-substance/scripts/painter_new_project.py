"""Runs INSIDE Substance 3D Painter via painter_remote.py; not a local CLI script.

    python painter_remote.py --python-file painter_new_project.py --result \\
        --set MESH=C:/work/model.obj --set NORMAL=DirectX --set RESOLUTION=1024 --set BAKE=0

Creates a Painter project from a Blockbench OBJ/FBX export (Painter does not
import glTF). Blockbench exports 1 unit = 1 block = 1 m; Painter works in
centimetres, so ``mesh_unit_scale`` is 100. Refuses to replace an open project
that has unsaved changes. With BAKE=1 it starts Painter's mesh-map bake (AO,
curvature, normal, ...) for the selected texture sets so smart materials and
generators have inputs. Writes a JSON result to PAINTER_RESULT.

Painter executes remote Python with separate globals and locals, so top-level
functions cannot see other top-level names. Everything lives in main().
"""


def main():
    import json

    import substance_painter.baking as baking
    import substance_painter.project as project
    import substance_painter.textureset as textureset

    mesh = "{{MESH}}"
    normal = "{{NORMAL}}"
    resolution = int("{{RESOLUTION}}")
    bake = "{{BAKE}}" == "1"

    def write(result):
        with open("PAINTER_RESULT", "w", encoding="utf-8") as fh:
            json.dump(result, fh)

    if project.is_open() and project.needs_saving():
        write({"ok": False, "error": "an open Painter project has unsaved changes; save or close it first"})
        return
    if project.is_open():
        project.close()

    settings = project.Settings(
        normal_map_format=getattr(project.NormalMapFormat, normal),
        default_texture_resolution=resolution,
        mesh_unit_scale=100.0,
    )
    project.create(mesh, settings=settings)
    if bake:
        baking.bake_selected_textures_async()
    write({
        "ok": True,
        "mesh": mesh,
        "baking_started": bake,
        "texture_sets": [
            {"name": ts.name(), "uv_tiles": len(ts.all_uv_tiles()) if ts.has_uv_tiles() else 0}
            for ts in textureset.all_texture_sets()
        ],
    })


main()
