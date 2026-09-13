#!/usr/bin/env python3
"""Downscale a generated GPT Image canvas to the real atlas size with nearest-neighbor sampling.

Usage:
    python resize_to_atlas.py generated.png atlas.png --width 64 --height 64
        [--crop X Y W H] [--alpha-threshold 128] [--sample center|average]

--crop            crop rectangle in generated-image pixels before resizing (for padded canvases)
--alpha-threshold binarize alpha so pixel-art textures have no half-transparent fringe
--sample          center: nearest-neighbor (default, crisp pixel art); average: box filter
                  (better for high-resolution painterly atlases)

Requires Pillow (pip install pillow).
"""
import argparse
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: pip install pillow")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source")
    parser.add_argument("destination")
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--crop", type=int, nargs=4, metavar=("X", "Y", "W", "H"))
    parser.add_argument("--alpha-threshold", type=int, default=None)
    parser.add_argument("--sample", choices=("center", "average"), default="center")
    return parser.parse_args()


def binarize_alpha(image: Image.Image, threshold: int) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= threshold else 0)
    image.putalpha(alpha)
    return image


def sample_centers(image: Image.Image, width: int, height: int) -> Image.Image:
    """Nearest-neighbor downscale that reads the center of each texel block, not its corner."""
    source = image.load()
    result = Image.new("RGBA", (width, height))
    target = result.load()
    scale_x = image.width / width
    scale_y = image.height / height
    for y in range(height):
        sy = min(int((y + 0.5) * scale_y), image.height - 1)
        for x in range(width):
            sx = min(int((x + 0.5) * scale_x), image.width - 1)
            target[x, y] = source[sx, sy]
    return result


def main() -> None:
    args = parse_args()
    image = Image.open(args.source).convert("RGBA")
    if args.crop:
        x, y, w, h = args.crop
        image = image.crop((x, y, x + w, y + h))
    resized = (
        sample_centers(image, args.width, args.height)
        if args.sample == "center"
        else image.resize((args.width, args.height), resample=Image.BOX)
    )
    if args.alpha_threshold is not None:
        resized = binarize_alpha(resized, args.alpha_threshold)
    resized.save(args.destination)
    print(f"Saved {args.destination} ({resized.width}x{resized.height})")


if __name__ == "__main__":
    main()
