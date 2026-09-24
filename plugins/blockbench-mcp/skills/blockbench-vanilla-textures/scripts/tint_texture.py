#!/usr/bin/env python3
"""Tint grayscale vanilla textures (grass, leaves, water, vines) or pre-tile them for large faces.

Usage:
  python tint_texture.py <in> <out> --color "#91BD59"            multiply RGB by a tint
  python tint_texture.py <in> <out> --color "#91BD59" --overlay  grass_side-style TGA: alpha is the tint mask
  python tint_texture.py <in> <out> --colormap grass.png --temperature 0.8 --downfall 0.4
  python tint_texture.py <in> <out> --tile 4x3                     repeat the image 4 wide, 3 tall

--overlay    Bedrock *_side.tga overlay files store the tinted region in alpha (255 = tint the gray,
             0 = keep the underlying color). The output is opaque.
--colormap   sample a Java-style biome colormap (textures/colormap/grass.png or foliage.png) instead
             of --color: x = (1 - temperature) * 255, y = (1 - downfall * temperature) * 255.
--tile CxR   tile the (tinted) result C columns by R rows so one UV rectangle can keep 16 px per block.

Animated strips (height = frames * width) are tinted frame-for-frame because the operation is per-pixel.
Requires Pillow: python -m pip install Pillow
"""
import argparse
import sys

from PIL import Image, ImageChops


def parse_hex(value: str) -> tuple[int, int, int]:
    text = value.lstrip("#")
    if len(text) != 6:
        raise argparse.ArgumentTypeError(f"expected #RRGGBB, got {value}")
    return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))


def colormap_color(colormap: str, temperature: float, downfall: float) -> tuple[int, int, int]:
    image = Image.open(colormap).convert("RGB")
    temperature = min(max(temperature, 0.0), 1.0)
    downfall = min(max(downfall, 0.0), 1.0) * temperature
    x = round((1.0 - temperature) * (image.width - 1))
    y = round((1.0 - downfall) * (image.height - 1))
    return image.getpixel((x, y))


def multiply(image: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    rgb = ImageChops.multiply(image.convert("RGB"), Image.new("RGB", image.size, color))
    rgb.putalpha(image.getchannel("A"))
    return rgb


def overlay(image: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    mask = image.getchannel("A")
    base = image.convert("RGB")
    tinted = ImageChops.multiply(base, Image.new("RGB", image.size, color))
    return Image.composite(tinted, base, mask).convert("RGBA")


def tile(image: Image.Image, spec: str) -> Image.Image:
    columns, rows = (int(part) for part in spec.lower().split("x"))
    sheet = Image.new("RGBA", (image.width * columns, image.height * rows))
    for index in range(columns * rows):
        sheet.paste(image, ((index % columns) * image.width, (index // columns) * image.height))
    return sheet


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--color", type=parse_hex)
    parser.add_argument("--colormap")
    parser.add_argument("--temperature", type=float, default=0.8)
    parser.add_argument("--downfall", type=float, default=0.4)
    parser.add_argument("--overlay", action="store_true")
    parser.add_argument("--tile")
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    color = colormap_color(args.colormap, args.temperature, args.downfall) if args.colormap else args.color
    if args.overlay and not color:
        parser.error("--overlay needs --color or --colormap")
    if color:
        image = overlay(image, color) if args.overlay else multiply(image, color)
    if args.tile:
        image = tile(image, args.tile)
    image.save(args.output)
    print(f"{args.output} {image.width}x{image.height}" + (f" tint #{bytes(color).hex()}" if color else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
