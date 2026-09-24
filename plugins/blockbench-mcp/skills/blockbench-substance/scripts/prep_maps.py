#!/usr/bin/env python3
"""prep_maps.py — turn Substance outputs into Blockbench / Bedrock texture files.

    python prep_maps.py convert IN.png [IN2.png ...] --out DIR [--size 16] [--flip-green] [--invert]
    python prep_maps.py pack-mer --metallic M --emissive E --roughness R --out name_mer.png [--size 16]
    python prep_maps.py texture-set --color name --mer name_mer [--normal name_normal | --height name_height] --out name.texture_set.json

convert
    Scales 16-bit and float PNG/TGA/TIF to 8-bit correctly (Pillow's plain
    ``convert("L")`` clips 16-bit grayscale to white instead of scaling it),
    optionally resizes, flips the normal green channel (DirectX <-> OpenGL) or
    inverts (glossiness -> roughness). ``--filter box`` (default) averages texels
    when shrinking, which keeps baked AO/curvature from aliasing; use
    ``nearest`` only for already pixel-exact art.

pack-mer
    Packs Bedrock MER: R = metalness, G = emissive, B = roughness. Each channel
    is an image path or a constant 0-255. Colour sources collapse to luminance.
    ``--glossiness`` replaces ``--roughness`` and is inverted. Size defaults to
    the first image source.

texture-set
    Writes a Bedrock ``.texture_set.json`` that ``import_texture_set`` can load.
    Layer values are file names without extension, relative to the JSON file.
    Normal and height are mutually exclusive.

Every subcommand prints a JSON report with the files written, their sizes and
modes. Dependencies: Pillow, numpy.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

FILTERS = {"box": Image.Resampling.BOX, "nearest": Image.Resampling.NEAREST, "lanczos": Image.Resampling.LANCZOS}
TEXTURE_SET_VERSION = "1.16.100"


def parse_size(text: str | None) -> tuple[int, int] | None:
    if not text:
        return None
    dims = [int(v) for v in text.lower().split("x")]
    return (dims[0], dims[0]) if len(dims) == 1 else (dims[0], dims[1])


def load_float(path: Path) -> np.ndarray:
    """Load any image as float32 HxWxC in 0..1, scaling by the real bit depth."""
    img = Image.open(path)
    arr = np.asarray(img)
    if img.mode in ("I;16", "I;16B", "I;16L", "I") or arr.dtype == np.uint16:
        data = arr.astype(np.float32) / 65535.0
    elif arr.dtype in (np.float32, np.float64) or img.mode == "F":
        data = arr.astype(np.float32)
    else:
        data = np.asarray(img.convert("RGBA" if "A" in img.getbands() else "RGB" if len(img.getbands()) >= 3 else "L"))
        data = data.astype(np.float32) / 255.0
    data = data[..., None] if data.ndim == 2 else data
    return np.clip(data, 0.0, 1.0)


def to_image(data: np.ndarray) -> Image.Image:
    channels = data.shape[2]
    raw = np.round(np.clip(data, 0.0, 1.0) * 255.0).astype(np.uint8)
    mode = {1: "L", 3: "RGB", 4: "RGBA"}[channels]
    return Image.fromarray(raw[..., 0] if channels == 1 else raw, mode)


def resize(img: Image.Image, size: tuple[int, int] | None, flt: str) -> Image.Image:
    return img if not size or img.size == size else img.resize(size, FILTERS[flt])


def luminance(data: np.ndarray) -> np.ndarray:
    if data.shape[2] == 1:
        return data[..., 0]
    return data[..., 0] * 0.2126 + data[..., 1] * 0.7152 + data[..., 2] * 0.0722


def describe(path: Path) -> dict:
    img = Image.open(path)
    return {"file": str(path), "size": list(img.size), "mode": img.mode}


def cmd_convert(args: argparse.Namespace) -> list[dict]:
    args.out.mkdir(parents=True, exist_ok=True)
    size = parse_size(args.size)

    def one(src: Path) -> dict:
        data = load_float(src)
        data = 1.0 - data if args.invert else data
        if args.flip_green and data.shape[2] >= 3:
            data = data.copy()
            data[..., 1] = 1.0 - data[..., 1]
        dest = args.out / f"{src.stem}{args.suffix}.png"
        resize(to_image(data), size, args.filter).save(dest)
        return {**describe(dest), "source": str(src)}

    return [one(Path(p)) for p in args.inputs]


def channel(source: str | None, size: tuple[int, int], flt: str, default: float) -> np.ndarray | float:
    """One MER plane: an image (as luminance, resized) or a 0-255 constant."""
    if source is None:
        return default
    path = Path(source)
    if path.is_file():
        gray = to_image(luminance(load_float(path))[..., None])
        return np.asarray(resize(gray, size, flt)).astype(np.float32) / 255.0
    try:
        return float(source) / 255.0
    except ValueError:
        sys.exit(f"error: '{source}' is neither a file nor a 0-255 number")


def cmd_pack_mer(args: argparse.Namespace) -> list[dict]:
    if args.roughness and args.glossiness:
        sys.exit("error: pass --roughness or --glossiness, not both")
    image_sources = [s for s in (args.metallic, args.emissive, args.roughness, args.glossiness) if s and Path(s).is_file()]
    size = parse_size(args.size) or (Image.open(image_sources[0]).size if image_sources else None)
    if size is None:
        sys.exit("error: all channels are constants; pass --size")

    metal = channel(args.metallic, size, args.filter, 0.0)
    emit = channel(args.emissive, size, args.filter, 0.0)
    rough = channel(args.roughness or args.glossiness, size, args.filter, 1.0)
    rough = 1.0 - rough if args.glossiness else rough

    w, h = size
    planes = [np.broadcast_to(np.asarray(c, dtype=np.float32), (h, w)) for c in (metal, emit, rough)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    to_image(np.stack(planes, axis=-1)).save(args.out)
    return [describe(args.out)]


def cmd_texture_set(args: argparse.Namespace) -> list[dict]:
    if args.normal and args.height:
        sys.exit("error: Bedrock texture sets take a normal OR a heightmap layer, not both")
    layers = {
        "color": args.color,
        "metalness_emissive_roughness": args.mer,
        "normal": args.normal,
        "heightmap": args.height,
    }
    doc = {
        "format_version": TEXTURE_SET_VERSION,
        "minecraft:texture_set": {k: v for k, v in layers.items() if v},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    missing = [
        v for v in layers.values()
        if v and not any((args.out.parent / f"{v}{ext}").is_file() for ext in (".png", ".tga", ".jpg"))
    ]
    return [{"file": str(args.out), "texture_set": doc, "missing_layer_files": missing}]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    conv = sub.add_parser("convert", help="8-bit, resize, flip green, invert")
    conv.add_argument("inputs", nargs="+")
    conv.add_argument("--out", type=Path, required=True)
    conv.add_argument("--size", help="16 or WxH")
    conv.add_argument("--filter", choices=sorted(FILTERS), default="box")
    conv.add_argument("--flip-green", action="store_true", help="DirectX <-> OpenGL normal")
    conv.add_argument("--invert", action="store_true", help="e.g. glossiness -> roughness")
    conv.add_argument("--suffix", default="", help="appended to each output stem")
    conv.set_defaults(run=cmd_convert)

    mer = sub.add_parser("pack-mer", help="R metalness, G emissive, B roughness")
    mer.add_argument("--metallic")
    mer.add_argument("--emissive")
    mer.add_argument("--roughness")
    mer.add_argument("--glossiness")
    mer.add_argument("--out", type=Path, required=True)
    mer.add_argument("--size", help="16 or WxH; defaults to the first image source")
    mer.add_argument("--filter", choices=sorted(FILTERS), default="box")
    mer.set_defaults(run=cmd_pack_mer)

    ts = sub.add_parser("texture-set", help="write .texture_set.json")
    ts.add_argument("--color", required=True)
    ts.add_argument("--mer")
    ts.add_argument("--normal")
    ts.add_argument("--height")
    ts.add_argument("--out", type=Path, required=True)
    ts.set_defaults(run=cmd_texture_set)

    args = parser.parse_args()
    print(json.dumps({"command": args.command, "written": args.run(args)}, indent=2))


if __name__ == "__main__":
    main()
