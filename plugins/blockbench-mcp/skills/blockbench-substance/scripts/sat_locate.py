#!/usr/bin/env python3
"""sat_locate.py — find the Substance CLIs and Painter on this machine.

    python sat_locate.py [--root DIR ...]

Prints JSON: each tool's absolute path (or null), its ``--version`` line, and
whether the Painter Python API docs ship with the Painter install. Checks PATH
first, then the default install folders of Substance 3D Designer (which bundles
sbsrender, sbscooker, sbsupdater and substance3d_baker), the standalone
Substance Automation Toolkit (which adds sbsmutator and the pysbs Python API)
and Substance 3D Painter. Extra ``--root`` folders are searched first.

Never run ``Adobe Substance 3D Painter --help``: Painter ignores it and opens
the full application.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
from pathlib import Path

CLI_TOOLS = ("sbsrender", "sbscooker", "sbsupdater", "sbsmutator", "substance3d_baker", "sbsbaker")
PAINTER_NAMES = {
    "Windows": ["Adobe Substance 3D Painter.exe"],
    "Darwin": ["Adobe Substance 3D Painter.app/Contents/MacOS/Adobe Substance 3D Painter"],
    "Linux": ["Adobe Substance 3D Painter", "substance3dpainter"],
}


def default_roots() -> list[Path]:
    system = platform.system()
    if system == "Windows":
        bases = [Path(os.environ.get("ProgramFiles", r"C:\Program Files"))]
        return [
            b / sub
            for b in bases
            for sub in (
                "Adobe/Adobe Substance 3D Designer",
                "Adobe/Adobe Substance 3D Painter",
                "Adobe/Substance Automation Toolkit",
                "Allegorithmic/Substance Automation Toolkit",
                "Allegorithmic/Substance Designer",
                "Allegorithmic/Substance Painter",
            )
        ]
    if system == "Darwin":
        return [
            Path("/Applications/Adobe Substance 3D Designer.app/Contents/MacOS"),
            Path("/Applications"),
            Path("/Applications/Substance Automation Toolkit"),
        ]
    return [
        Path("/opt/Adobe/Adobe_Substance_3D_Designer"),
        Path("/opt/Adobe/Adobe_Substance_3D_Painter"),
        Path("/opt/Allegorithmic/Substance_Automation_Toolkit"),
    ]


def find_tool(name: str, roots: list[Path]) -> Path | None:
    exe = f"{name}.exe" if platform.system() == "Windows" else name
    hits = [r / exe for r in roots if (r / exe).is_file()]
    if hits:
        return hits[0]
    on_path = shutil.which(name)
    return Path(on_path) if on_path else None


def find_painter(roots: list[Path]) -> Path | None:
    names = PAINTER_NAMES.get(platform.system(), [])
    hits = [r / n for r in roots for n in names if (r / n).exists()]
    return hits[0] if hits else None


def version_of(path: Path) -> str | None:
    try:
        run = subprocess.run([str(path), "--version"], capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    lines = [ln.strip() for ln in (run.stdout + run.stderr).splitlines() if "version" in ln.lower()]
    return lines[0] if lines else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", action="append", default=[], help="extra install folder to search first")
    args = parser.parse_args()

    roots = [Path(r) for r in args.root] + default_roots()
    tools = {name: find_tool(name, roots) for name in CLI_TOOLS}
    painter = find_painter(roots)
    painter_docs = painter.parent / "resources/python-doc/index.html" if painter else None

    report = {
        "platform": platform.system(),
        "tools": {
            name: {"path": str(p) if p else None, "version": version_of(p) if p else None}
            for name, p in tools.items()
        },
        "painter": {
            "path": str(painter) if painter else None,
            "python_docs": str(painter_docs) if painter_docs and painter_docs.is_file() else None,
        },
        "notes": [
            note
            for note, missing in (
                ("sbsmutator and pysbs need the standalone Substance Automation Toolkit", tools["sbsmutator"] is None),
                ("no substance3d_baker; older installs ship sbsbaker with different subcommands", tools["substance3d_baker"] is None),
                ("no sbsrender found: install Substance 3D Designer or the Automation Toolkit", tools["sbsrender"] is None),
            )
            if missing
        ],
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
