#!/usr/bin/env python3
"""sat_render.py — render a .sbsar to Blockbench-ready maps with sbsrender.

    python sat_render.py material.sbsar --out DIR [--size 16] [--set Name=value ...]

Wraps ``sbsrender info`` + ``sbsrender render`` and fixes the traps the raw CLI
leaves open:

* creates ``--out`` (sbsrender exits 47 "Result cannot be saved" when the
  output folder does not exist);
* converts ``--size`` in pixels to the log2 ``$outputsize`` base parameter
  (16 -> ``4,4``; ``16x32`` -> ``4,5``);
* forces 8-bit output by default (several graph outputs are 16-bit, which
  Blockbench and Bedrock do not need);
* maps ``--normal-format directx|opengl`` onto ``$normalformat`` when the graph
  exposes it (0 = DirectX, 1 = OpenGL);
* warns about ``--set`` / ``--entry`` identifiers the graph does not expose,
  which sbsrender otherwise ignores silently;
* pulls the JSON render report out of stdout, where it follows GPU log lines
  that also start with ``[``.

Prints JSON: graph URL, exposed inputs, and each written output with its
identifier, usages and file path. Use the usages (``baseColor``, ``normal``,
``roughness``, ``metallic``, ``emissive``, ``height``, ``ambientOcclusion``...)
to decide which file feeds which Blockbench PBR channel.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

INFO_INPUT = re.compile(r"^\s*INPUT\s+(\S+)\s+(\S+)")
INFO_OUTPUT = re.compile(r"^\s*OUTPUT\s+(\S+)\s*(.*)$")
INFO_GRAPH = re.compile(r"^\s*GRAPH-URL\s+(\S+)")
NORMAL_FORMATS = {"directx": 0, "opengl": 1}


def resolve_sbsrender(explicit: str | None) -> str:
    candidates = [explicit, shutil.which("sbsrender"), r"C:\Program Files\Adobe\Adobe Substance 3D Designer\sbsrender.exe"]
    found = [c for c in candidates if c and Path(c).is_file()]
    if not found:
        sys.exit("error: sbsrender not found; pass --sbsrender or run sat_locate.py")
    return found[0]


def log2_size(text: str) -> str:
    dims = [int(v) for v in text.lower().split("x")]
    dims = dims * 2 if len(dims) == 1 else dims
    bad = [d for d in dims if d < 1 or d & (d - 1)]
    if bad or len(dims) != 2:
        sys.exit(f"error: --size must be a power of two or WxH of powers of two, got {text}")
    return ",".join(str(int(math.log2(d))) for d in dims)


def parse_info(text: str) -> list[dict]:
    graphs: list[dict] = []
    for line in text.splitlines():
        graph = INFO_GRAPH.match(line)
        if graph:
            graphs.append({"graph": graph.group(1), "inputs": {}, "outputs": {}})
            continue
        inp = INFO_INPUT.match(line)
        if inp and graphs:
            graphs[-1]["inputs"][inp.group(1)] = inp.group(2)
            continue
        out = INFO_OUTPUT.match(line)
        if out and graphs:
            graphs[-1]["outputs"][out.group(1)] = out.group(2).split()
    return graphs


def extract_report(stdout: str) -> list:
    lines = stdout.splitlines()
    starts = [i for i, ln in enumerate(lines) if ln.strip() == "["]
    if not starts:
        return []
    try:
        return json.loads("\n".join(lines[starts[0]:]))
    except json.JSONDecodeError:
        decoded, _ = json.JSONDecoder().raw_decode("\n".join(lines[starts[0]:]))
        return decoded


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("sbsar", type=Path)
    parser.add_argument("--out", type=Path, required=True, help="output folder (created)")
    parser.add_argument("--size", default="512", help="pixels, power of two: 16, 512, or 16x32")
    parser.add_argument("--seed", type=int, help="$randomseed")
    parser.add_argument("--set", action="append", default=[], metavar="ID=VALUE", help="graph parameter; vectors as 0.5,0.2,0.1")
    parser.add_argument("--entry", action="append", default=[], metavar="ID=PATH", help="image input")
    parser.add_argument("--normal-format", choices=sorted(NORMAL_FORMATS), help="sets $normalformat when exposed")
    parser.add_argument("--graph", help="graph URL when the sbsar holds several (see info)")
    parser.add_argument("--output", action="append", default=[], help="only render these output identifiers")
    parser.add_argument("--name", default="{inputName}_{outputNodeName}", help="sbsrender --output-name pattern")
    parser.add_argument("--format", default="png", help="png, tga, jpg, exr ...")
    parser.add_argument("--bit-depth", default="8", help="8, 16, 16f, 32f")
    parser.add_argument("--preset", help="--use-preset name embedded in the sbsar")
    parser.add_argument("--sbsrender", help="explicit sbsrender path")
    parser.add_argument("--dry-run", action="store_true", help="print the command without rendering")
    args = parser.parse_args()

    if not args.sbsar.is_file():
        sys.exit(f"error: {args.sbsar} not found")
    exe = resolve_sbsrender(args.sbsrender)

    info = subprocess.run([exe, "info", str(args.sbsar)], capture_output=True, text=True)
    graphs = parse_info(info.stdout)
    if not graphs:
        sys.exit(f"error: sbsrender info returned no graphs\n{info.stderr[-2000:]}")
    graph = next((g for g in graphs if g["graph"] == args.graph), graphs[0])
    exposed = graph["inputs"]

    values = [f"$outputsize@{log2_size(args.size)}"]
    values += [f"$randomseed@{args.seed}"] if args.seed is not None else []
    values += [f"$normalformat@{NORMAL_FORMATS[args.normal_format]}"] if args.normal_format and "$normalformat" in exposed else []
    values += [item.replace("=", "@", 1) for item in args.set]
    entries = [item.replace("=", "@", 1) for item in args.entry]

    warnings = [
        f"'{ident}' is not an input of {graph['graph']}; sbsrender will ignore it"
        for ident in (v.split("@", 1)[0] for v in values + entries)
        if ident not in exposed and ident not in graph["outputs"]
    ]
    warnings += (
        [f"--normal-format ignored: {graph['graph']} does not expose $normalformat; check the graph's normal convention"]
        if args.normal_format and "$normalformat" not in exposed
        else []
    )

    args.out.mkdir(parents=True, exist_ok=True)
    cmd = [exe, "render", "--input", str(args.sbsar), "--output-path", str(args.out), "--output-name", args.name,
           "--output-format", args.format, "--output-bit-depth", args.bit_depth]
    cmd += ["--input-graph", args.graph] if args.graph else []
    cmd += [flag for out in args.output for flag in ("--input-graph-output", out)]
    cmd += ["--use-preset", args.preset] if args.preset else []
    cmd += [flag for v in values for flag in ("--set-value", v)]
    cmd += [flag for e in entries for flag in ("--set-entry", e)]

    if args.dry_run:
        print(json.dumps({"command": cmd, "warnings": warnings}, indent=2))
        return

    run = subprocess.run(cmd, capture_output=True, text=True)
    report = extract_report(run.stdout)
    errors = [ln for ln in (run.stdout + run.stderr).splitlines() if "[ERROR]" in ln]
    result = {
        "exit_code": run.returncode,
        "graph": graph["graph"],
        "inputs": exposed,
        "outputs": [
            {"identifier": o.get("identifier"), "usages": o.get("usages", []), "file": o.get("value")}
            for g in report
            for o in g.get("outputs", [])
        ],
        "warnings": warnings,
        "errors": errors,
    }
    print(json.dumps(result, indent=2))
    sys.exit(run.returncode)


if __name__ == "__main__":
    main()
