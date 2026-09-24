#!/usr/bin/env python3
"""Repack measured sprite cells into a vertical RGBA PNG without changing anchors.

Requires Python 3.10+ and Pillow. Coordinates are source-image pixels, with an
upper-left origin. Crop each frame before resizing so filters cannot mix frames.
The JSON report on stdout records the actual output-to-source mapping.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from None

# Source rectangle expressed as x, y, width, height (not right/bottom edges).
Rectangle = tuple[int, int, int, int]


def positive_int(value: str) -> int:
    """Parse a positive pixel dimension, grid extent, frame count, or tick count."""
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def parse_indices(value: str) -> list[int]:
    """Read zero-based source-cell indices; repeats deliberately duplicate frames."""
    try:
        indices = [int(part.strip()) for part in value.split(",")]
    except ValueError:
        raise argparse.ArgumentTypeError("use comma-separated integer indices") from None
    if not indices or min(indices) < 0:
        raise argparse.ArgumentTypeError("indices must be nonnegative integers")
    return indices


def rectangle(value: object, size: tuple[int, int]) -> Rectangle:
    """Validate an XYWH rectangle without permitting Pillow's silent out-of-bounds padding."""
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise ValueError("each rectangle must be [x, y, width, height]")
    if not all(type(component) is int for component in value):
        raise ValueError("rectangle coordinates and dimensions must be integers")
    x, y, width, height = value
    if x < 0 or y < 0 or width <= 0 or height <= 0:
        raise ValueError("rectangle origins must be nonnegative and dimensions positive")
    if x + width > size[0] or y + height > size[1]:
        raise ValueError(f"rectangle {value} exceeds source image {size}")
    return x, y, width, height


def source_rectangles(args: argparse.Namespace, size: tuple[int, int]) -> list[Rectangle]:
    """Resolve measured cells, rejecting partial cells, stray padding, and mismatched sizes."""
    if args.rects is not None:
        if args.crop is not None or args.gap != [0, 0]:
            raise ValueError("--crop and --gap apply only to --grid")
        raw = json.loads(args.rects.read_text(encoding="utf-8-sig"))
        if not isinstance(raw, list) or not raw:
            raise ValueError("--rects must contain a nonempty JSON array of XYWH rectangles")
        rectangles = [rectangle(value, size) for value in raw]
        if len({rect[2:] for rect in rectangles}) != 1:
            raise ValueError("all measured frame rectangles must have the same dimensions")
        return rectangles

    columns, rows = args.grid
    region = args.crop
    if region is None:
        region = [0, 0, *size]
    x, y, width, height = rectangle(region, size)
    gap_x, gap_y = args.gap
    if gap_x < 0 or gap_y < 0:
        raise ValueError("grid gaps must be nonnegative")
    usable_width = width - (columns - 1) * gap_x
    usable_height = height - (rows - 1) * gap_y
    if usable_width <= 0 or usable_height <= 0:
        raise ValueError("grid gaps leave no room for frames")
    if usable_width % columns or usable_height % rows:
        raise ValueError("grid does not divide into whole pixels; measure --crop/--gap or use --rects")
    cell_width, cell_height = usable_width // columns, usable_height // rows
    return [
        (x + column * (cell_width + gap_x), y + row * (cell_height + gap_y), cell_width, cell_height)
        for row in range(rows)
        for column in range(columns)
    ]


def extract_frame(source: Image.Image, rect: Rectangle, args: argparse.Namespace) -> Image.Image:
    """Crop a full cell and resize proportionally, preserving RGBA unless alpha snapping is requested."""
    x, y, width, height = rect
    if width * args.frame_height != height * args.frame_width:
        raise ValueError("source cell and target frame aspect ratios differ; do not stretch animation frames")
    frame = source.crop((x, y, x + width, y + height))
    resampling = {"nearest": Image.Resampling.NEAREST, "lanczos": Image.Resampling.LANCZOS}
    frame = frame.resize((args.frame_width, args.frame_height), resampling[args.resample])
    if args.alpha_threshold is not None:
        table = [255 * int(alpha >= args.alpha_threshold) for alpha in range(256)]
        frame.putalpha(frame.getchannel("A").point(table))
    return frame


def validate_destinations(args: argparse.Namespace) -> None:
    """Protect source artifacts and require an explicit flag to replace generated files."""
    outputs = [args.output]
    if args.preview is not None:
        outputs.append(args.preview)
    resolved = [path.resolve() for path in outputs]
    inputs = {args.source.resolve()}
    if args.rects is not None:
        inputs.add(args.rects.resolve())
    if len(set(resolved)) != len(resolved) or inputs.intersection(resolved):
        raise ValueError("source, rectangle manifest, output, and preview must have distinct paths")
    if args.output.suffix.lower() != ".png":
        raise ValueError("the flipbook output must use a .png filename")
    if args.preview is not None and args.preview.suffix.lower() != ".apng":
        raise ValueError("the preview must use .apng to distinguish it from the static strip")
    existing = [str(path) for path in outputs if path.exists()]
    if existing and not args.overwrite:
        raise ValueError(f"output already exists: {', '.join(existing)}; use --overwrite to replace it")
    if any(path.is_dir() for path in outputs):
        raise ValueError("output paths must be files")


def convert(args: argparse.Namespace) -> dict[str, object]:
    """Write a static vertical strip and optional APNG, returning dimensions and source mapping."""
    validate_destinations(args)
    with Image.open(args.source) as loaded:
        if getattr(loaded, "n_frames", 1) != 1:
            raise ValueError("source must be a static sprite sheet, not an animated image")
        source = loaded.convert("RGBA")
    rectangles = source_rectangles(args, source.size)
    indices = args.indices
    if indices is None:
        count = args.count
        if count is None:
            count = len(rectangles)
        if count > len(rectangles):
            raise ValueError("--count exceeds the number of source cells")
        indices = list(range(count))
    if max(indices) >= len(rectangles):
        raise ValueError("a requested source index is outside the sheet")
    output_size = (args.frame_width, args.frame_height * len(indices))
    if Image.MAX_IMAGE_PIXELS is not None and output_size[0] * output_size[1] > Image.MAX_IMAGE_PIXELS:
        raise ValueError("output exceeds Pillow's pixel safety limit; reduce dimensions or split the animation")
    frames = [extract_frame(source, rectangles[index], args) for index in indices]
    strip = Image.new("RGBA", output_size)
    for index, frame in enumerate(frames):
        # No alpha mask: masking here would apply alpha twice to translucent pixels.
        strip.paste(frame, (0, index * args.frame_height))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    strip.save(args.output, format="PNG")
    if args.preview is not None:
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(
            args.preview, format="PNG", save_all=True, append_images=frames[1:],
            duration=args.ticks_per_frame * 50, loop=0, disposal=0, blend=0,
        )
    return {
        "source": str(args.source.resolve()),
        "source_size": list(source.size),
        "output": str(args.output.resolve()),
        "output_size": list(strip.size),
        "frame_size": [args.frame_width, args.frame_height],
        "frame_count": len(frames),
        "source_indices": indices,
        "source_rectangles": [list(rectangles[index]) for index in indices],
        "resample": args.resample,
        "alpha_extrema": list(strip.getchannel("A").getextrema()),
        "ticks_per_frame": args.ticks_per_frame,
        "fps": 20 / args.ticks_per_frame,
        "duration_seconds": len(frames) * args.ticks_per_frame / 20,
        "runtime_metadata_written": False,
    }


def main() -> None:
    """Parse the measured layout; emit a JSON report or an actionable nonzero CLI error."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    layout = parser.add_mutually_exclusive_group(required=True)
    layout.add_argument("--grid", nargs=2, type=positive_int, metavar=("COLUMNS", "ROWS"))
    layout.add_argument("--rects", type=Path, help="JSON array of equal-size [x,y,width,height] source cells")
    parser.add_argument("--crop", nargs=4, type=int, metavar=("X", "Y", "W", "H"), help="outer grid bounds")
    parser.add_argument("--gap", nargs=2, type=int, default=[0, 0], metavar=("X", "Y"))
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--count", type=positive_int, help="use the first N cells; omit trailing unused cells")
    selection.add_argument("--indices", type=parse_indices, help="source cell indices, e.g. 0,1,2,1")
    parser.add_argument("--frame-width", type=positive_int, required=True)
    parser.add_argument("--frame-height", type=positive_int, required=True)
    parser.add_argument("--resample", choices=("nearest", "lanczos"), default="nearest")
    parser.add_argument("--alpha-threshold", type=int, choices=range(256), metavar="0..255")
    parser.add_argument("--ticks-per-frame", type=positive_int, default=2, help="preview/report timing; default 2 = 10 FPS")
    parser.add_argument("--preview", type=Path, help="optional APNG for loop inspection; not the game texture")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        report = convert(args)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
