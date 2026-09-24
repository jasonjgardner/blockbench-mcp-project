"""Runs INSIDE Substance 3D Painter via painter_remote.py; not a local CLI script.

    python painter_remote.py --python-file painter_bedrock_export.py --result \\
        --set OUT=C:/work/painter_out --set NAME=pedestal --set PRESET=bedrock --set SIZE_LOG2=9

Exports every texture set of the open project with a custom preset, 8-bit PNG,
infinite padding:

    PRESET=bedrock  NAME.png (base colour + opacity alpha), NAME_mer.png
                    (R metallic, G emissive luminance, B roughness),
                    NAME_normal.png (DirectX, green-down)
    PRESET=gltf     NAME.png, NAME_orm.png (R AO, G roughness, B metallic),
                    NAME_normal.png (OpenGL, green-up), NAME_emissive.png

Blockbench material names become Painter texture set names (``m_<uuid>``), so
files are named from NAME, not ``$textureSet``; with more than one texture
set the set name is appended. Painter never exports below 128 px
(``SIZE_LOG2`` < 7 is clamped); shrink afterwards with ``prep_maps.py convert``.
Writes the export status and file list to PAINTER_RESULT.

Painter executes remote Python with separate globals and locals, so top-level
functions cannot see other top-level names. Everything lives in main().
"""


def main():
    import json

    import substance_painter.export as export
    import substance_painter.project as project
    import substance_painter.textureset as textureset

    out_dir = "{{OUT}}"
    name = "{{NAME}}"
    preset_key = "{{PRESET}}"
    size_log2 = max(7, int("{{SIZE_LOG2}}"))

    def ch(dest, src, map_name, kind="documentMap"):
        return {"destChannel": dest, "srcChannel": src, "srcMapType": kind, "srcMapName": map_name}

    def rgb(map_name, kind="documentMap"):
        return [ch(c, c, map_name, kind) for c in "RGB"]

    presets = {
        "bedrock": [
            ("", rgb("baseColor") + [ch("A", "L", "opacity")]),
            ("_mer", [ch("R", "L", "metallic"), ch("G", "L", "emissive"), ch("B", "L", "roughness")]),
            ("_normal", rgb("Normal_DirectX", "virtualMap")),
        ],
        "gltf": [
            ("", rgb("baseColor") + [ch("A", "L", "opacity")]),
            ("_orm", [ch("R", "L", "ambientOcclusion"), ch("G", "L", "roughness"), ch("B", "L", "metallic")]),
            ("_normal", rgb("Normal_OpenGL", "virtualMap")),
            ("_emissive", rgb("emissive")),
        ],
    }

    def write(result):
        with open("PAINTER_RESULT", "w", encoding="utf-8") as fh:
            json.dump(result, fh)

    if not project.is_open() or preset_key not in presets:
        write({"ok": False, "error": f"need an open project and PRESET in {sorted(presets)}"})
        return

    sets = [ts.name() for ts in textureset.all_texture_sets()]
    stem = name if len(sets) == 1 else name + "_$textureSet"
    preset = {
        "name": "blockbench_" + preset_key,
        "maps": [{"fileName": stem + suffix, "channels": channels} for suffix, channels in presets[preset_key]],
    }
    config = {
        "exportPath": out_dir,
        "exportShaderParams": False,
        "defaultExportPreset": preset["name"],
        "exportPresets": [preset],
        "exportList": [{"rootPath": s} for s in sets],
        "exportParameters": [{"parameters": {
            "fileFormat": "png", "bitDepth": "8", "dithering": False,
            "paddingAlgorithm": "infinite", "sizeLog2": size_log2,
        }}],
    }
    exported = export.export_project_textures(config)
    write({
        "ok": exported.status == export.ExportStatus.Success,
        "status": str(exported.status),
        "message": exported.message,
        "texture_sets": sets,
        "files": [f for files in exported.textures.values() for f in files],
    })


main()
