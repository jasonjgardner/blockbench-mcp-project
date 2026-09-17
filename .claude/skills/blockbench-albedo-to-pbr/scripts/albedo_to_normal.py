#!/usr/bin/env python3
"""albedo_to_normal.py — albedo PNG to height + tangent-space normal PNGs with PyPBR.

    python albedo_to_normal.py <albedo.png> [--out DIR] [--name NAME] [options]

Height sources (``--height-source``):
    luminance  BT.601 luma of the albedo (default)
    depth      Depth Anything V2 through ``transformers`` (optional dependency)
    file       an existing grayscale height PNG (``--height-file``)

The height is shaped in float space (depth flatten / high-pass / normalize / seam
heal, density softening, levels), quantised to 8 bits and written as
``<name>_height.png``. The normal is derived from that 8-bit height with a
Sobel / Prewitt / Scharr kernel (edge-clamped or wrapped, alpha-aware for atlas
islands), stored on a PyPBR material and exported as ``<name>_normal.png``.
A packed MER (``<name>_mer.png``: R metalness, G emissive, B roughness) is
inferred from the albedo, the height and the normal's curvature, with uniform
values and per-colour palette overrides applied afterwards. ``--material-folder``
additionally writes the PyPBR material folder (``albedo.png``, ``height.png``,
``normal.png``, ``metallic.png``, ``roughness.png``, ``emissive.png``). A
validation report is printed as JSON.

Dependencies: pypbr (pulls torch, torchvision, numpy, Pillow). Optional:
transformers for ``--height-source depth``.

The kernel maths mirrors ``albedo_to_normal.mjs`` / ``shaders/normal-map.wgsl`` so
both runtimes produce the same maps from the same height.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

try:
    from pypbr.materials import BasecolorMetallicMaterial
    from pypbr.utils.enums import NormalConvention
except ImportError:  # pragma: no cover - dependency guard
    sys.exit("error: pypbr is required (`pip install pypbr`)")

OPERATOR_WEIGHTS = {"sobel": (1.0, 2.0), "prewitt": (1.0, 1.0), "scharr": (3.0, 10.0)}
DEPTH_MODELS = {
    "small": "depth-anything/Depth-Anything-V2-Small-hf",
    "base": "depth-anything/Depth-Anything-V2-Base-hf",
    "large": "depth-anything/Depth-Anything-V2-Large-hf",
}
DEPTH_MIN_INPUT = 1024
DEPTH_MAX_INPUT = 4096
DEPTH_DOWNSCALE_SHARPEN = 0.5
BASE_FACE_TEXELS = 16
MAX_SOFTEN_SIGMA = 8.0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("albedo", help="albedo/base-color PNG")
    parser.add_argument("--out", help="output directory (default: next to the albedo)")
    parser.add_argument("--name", help="output stem (default: albedo file stem)")
    parser.add_argument("--height-source", choices=("luminance", "depth", "file"), default="luminance")
    parser.add_argument("--height-file", help="grayscale height PNG for --height-source file")
    parser.add_argument("--luma", choices=("bt601", "average"), default="bt601")
    parser.add_argument("--invert-height", action="store_true", help="dark reads as high")
    parser.add_argument("--depth-model", choices=tuple(DEPTH_MODELS), default="small")
    parser.add_argument("--depth-device", default="auto", help="auto|cpu|cuda|mps")
    parser.add_argument("--flatten", type=float, help="plane-removal strength 0..1 (depth default 1)")
    parser.add_argument("--high-pass", type=float, default=0.0, help="wrap-aware high-pass radius in texels")
    parser.add_argument("--normalize", dest="normalize", action="store_true", default=None)
    parser.add_argument("--no-normalize", dest="normalize", action="store_false")
    parser.add_argument("--seam", choices=("off", "offset"), default="off")
    parser.add_argument("--seam-amount", type=float, default=0.15)
    parser.add_argument("--soften", type=float, default=0.0, help="density-scaled gaussian multiplier, 0 = off")
    parser.add_argument("--levels", default="0,1,1", help="BLACK,WHITE,GAMMA input levels")
    parser.add_argument("--operator", choices=tuple(OPERATOR_WEIGHTS), default="sobel")
    parser.add_argument("--strength", type=float, default=0.5)
    parser.add_argument("--convention", choices=("directx", "opengl"), default="directx")
    parser.add_argument("--wrap", action="store_true", help="tiling texture: sample across the border")
    parser.add_argument("--alpha-threshold", type=int, default=8, help="0..255; texels below are off-island")
    parser.add_argument("--no-height", action="store_true")
    parser.add_argument("--material-folder", help="also save the PyPBR material folder here")
    mer = parser.add_argument_group("MER inference")
    mer.add_argument("--no-mer", action="store_true", help="skip the packed MER")
    mer.add_argument("--metal", default="auto", help="auto or a uniform 0..1 value")
    mer.add_argument("--emissive", default="auto", help="auto or a uniform 0..1 value")
    mer.add_argument("--roughness", default="auto", help="auto or a uniform 0..1 value")
    mer.add_argument("--metal-brightness", type=float, default=0.6)
    mer.add_argument("--metal-saturation", type=float, default=0.15)
    mer.add_argument("--no-metal-clean", action="store_true", help="skip the 3x3 majority vote that removes metal speckle")
    mer.add_argument("--gold-hue", default="0.11,0.17")
    mer.add_argument("--copper-hue", default="0.03,0.10")
    mer.add_argument("--rough-weights", default="0.4,0.3,0.3", help="VARIANCE,EDGE,SATURATION weights")
    mer.add_argument("--rough-curvature", type=float, default=0.25, help="crevices rougher / ridges smoother, from the normal")
    mer.add_argument("--rough-height", type=float, default=0.0, help="-1..1; positive = recesses rougher")
    mer.add_argument("--rough-scale", type=float, default=1.0)
    mer.add_argument("--rough-bias", type=float, default=0.0)
    mer.add_argument("--emissive-brightness", type=float, default=0.8)
    mer.add_argument("--emissive-saturation", type=float, default=0.5)
    mer.add_argument("--emissive-overbright", type=float, default=1.0, help="luminance above this glows; >= 1 disables")
    mer.add_argument("--emissive-softness", type=float, default=0.0)
    mer.add_argument("--palette", default="", help='per-colour overrides "#RRGGBB=m,e,r;..." ("-" keeps inferred)')
    args = parser.parse_args()
    if args.height_source == "file" and not args.height_file:
        parser.error("--height-file is required with --height-source file")
    return args


# ---------------------------------------------------------------------------
# Height shaping (float tensors, shape (H, W), values 0..1)
# ---------------------------------------------------------------------------


def luminance_height(rgb: torch.Tensor, mode: str, invert: bool) -> torch.Tensor:
    """Height from the stored 8-bit albedo (no sRGB linearisation), like the GPU pass."""
    weights = torch.tensor([0.299, 0.587, 0.114]) if mode == "bt601" else torch.full((3,), 1 / 3)
    height = (rgb * weights.view(3, 1, 1)).sum(0)
    return 1 - height if invert else height


def depth_upscale_factor(width: int, height: int) -> int:
    needed = math.ceil(DEPTH_MIN_INPUT / min(width, height))
    cap = DEPTH_MAX_INPUT // max(width, height)
    return max(1, min(needed, cap))


def box_blur_clamped(field: torch.Tensor) -> torch.Tensor:
    padded = F.pad(field[None, None], (1, 1, 1, 1), mode="replicate")
    return F.avg_pool2d(padded, 3, stride=1)[0, 0]


def sharpen(field: torch.Tensor, amount: float) -> torch.Tensor:
    if amount <= 0:
        return field
    return (field + amount * (field - box_blur_clamped(field))).clamp(0, 1)


def estimate_depth(albedo: Image.Image, model_key: str, device: str) -> tuple[torch.Tensor, int, str]:
    """Depth Anything V2; returns (0..1 field with 1 = nearest at native size, factor, model id)."""
    try:
        from transformers import pipeline
    except ImportError:
        sys.exit("error: --height-source depth needs `pip install transformers`")
    resolved = device
    if device == "auto":
        resolved = "cuda" if torch.cuda.is_available() else "cpu"
    model_id = DEPTH_MODELS[model_key]
    estimator = pipeline("depth-estimation", model=model_id, device=resolved)
    width, height = albedo.size
    factor = depth_upscale_factor(width, height)
    rgb = albedo.convert("RGB")
    upscaled = rgb.resize((width * factor, height * factor), Image.NEAREST) if factor > 1 else rgb
    depth = estimator(upscaled)["depth"]  # PIL "L", 255 = nearest, at the input size
    full = torch.from_numpy(np.asarray(depth, dtype=np.float32) / 255.0)
    if factor == 1:
        return full, factor, model_id
    native = F.avg_pool2d(full[None, None], factor)[0, 0]
    return sharpen(native, DEPTH_DOWNSCALE_SHARPEN), factor, model_id


def fit_plane(field: torch.Tensor) -> tuple[float, float]:
    height, width = field.shape
    xs = torch.arange(width, dtype=torch.float32) - (width - 1) / 2
    ys = torch.arange(height, dtype=torch.float32) - (height - 1) / 2
    gx = float((field * xs).sum() / (xs.pow(2).sum() * height)) if width > 1 else 0.0
    gy = float((field * ys[:, None]).sum() / (ys.pow(2).sum() * width)) if height > 1 else 0.0
    return gx, gy


def blur_wrap(field: torch.Tensor, radius: float) -> torch.Tensor:
    """Wrap-around box blur ×3 (≈ Gaussian), tile-aware on both axes."""
    r = max(1, round(radius))
    kernel = torch.full((1, 1, 1, 2 * r + 1), 1 / (2 * r + 1))
    out = field[None, None]
    for _ in range(3):
        out = F.conv2d(F.pad(out, (r, r, 0, 0), mode="circular"), kernel)
        out = F.conv2d(F.pad(out, (0, 0, r, r), mode="circular"), kernel.transpose(2, 3))
    return out[0, 0]


def edit_depth(field: torch.Tensor, flatten: float, high_pass: float, invert: bool, normalize: bool) -> torch.Tensor:
    """Depth edit chain: flatten, high-pass, invert, normalize."""
    out = field.clone()
    height, width = out.shape
    if flatten > 0:
        gx, gy = fit_plane(out)
        xs = torch.arange(width, dtype=torch.float32) - (width - 1) / 2
        ys = torch.arange(height, dtype=torch.float32) - (height - 1) / 2
        out = out - flatten * (gx * xs[None, :] + gy * ys[:, None])
    if high_pass > 0:
        out = out - blur_wrap(out, high_pass) + 0.5
    if invert:
        out = 1 - out
    if normalize:
        span = float(out.max() - out.min())
        if span > 1e-6:
            out = (out - out.min()) / span
    return out.clamp(0, 1)


def seal_offset(field: torch.Tensor, amount: float) -> torch.Tensor:
    """Wrap-and-heal: shift by half a tile, blend the original back over the centre seam."""
    height, width = field.shape
    half_w, half_h = width // 2, height // 2
    if half_w < 1 or half_h < 1:
        return field
    reach = min(1.0, max(1e-4, amount * 2))
    span_x = max(1, (width - 1) // 2)
    span_y = max(1, (height - 1) // 2)
    xs = torch.arange(width, dtype=torch.float32)
    ys = torch.arange(height, dtype=torch.float32)
    nx = (1 - torch.minimum(xs, width - 1 - xs) / span_x).clamp(0, 1)
    ny = (1 - torch.minimum(ys, height - 1 - ys) / span_y).clamp(0, 1)
    distance = torch.sqrt(nx[None, :] ** 2 + ny[:, None] ** 2).clamp(max=1)
    ramp = (distance / reach).clamp(0, 1)
    t = torch.where(distance >= reach, torch.ones_like(ramp), ramp * ramp * (3 - 2 * ramp))
    shifted = torch.roll(field, shifts=(half_h, half_w), dims=(0, 1))
    # Height-steered blend weight: the taller surface wins the middle of the transition.
    window = 4 * t * (1 - t)
    floor = torch.maximum(field, shifted) - 0.1
    w_a = (field - floor).clamp(min=0)
    w_b = (shifted - floor).clamp(min=0)
    picked = torch.where(w_a + w_b > 0, w_b / (w_a + w_b).clamp(min=1e-9), t)
    w = t + (picked - t) * 0.5 * window
    return shifted * w + field * (1 - w)


def density_sigma(width: int, height: int, softness: float) -> float:
    return min((min(width, height) / BASE_FACE_TEXELS / 4) * softness, MAX_SOFTEN_SIGMA)


def gaussian_blur(field: torch.Tensor, sigma: float, wrap: bool) -> torch.Tensor:
    if sigma <= 0:
        return field
    radius = max(1, math.ceil(sigma * 3))
    taps = torch.arange(-radius, radius + 1, dtype=torch.float32)
    weights = torch.exp(-(taps**2) / (2 * sigma * sigma))
    kernel = (weights / weights.sum()).view(1, 1, 1, -1)
    mode = "circular" if wrap else "replicate"
    out = F.conv2d(F.pad(field[None, None], (radius, radius, 0, 0), mode=mode), kernel)
    out = F.conv2d(F.pad(out, (0, 0, radius, radius), mode=mode), kernel.transpose(2, 3))
    return out[0, 0]


def apply_levels(field: torch.Tensor, black: float, white: float, gamma: float) -> torch.Tensor:
    span = max(white - black, 0.001)
    return ((field - black).clamp(0, span) / span).pow(1 / max(gamma, 0.001))


# ---------------------------------------------------------------------------
# Normal derivation (mirrors shaders/normal-map.wgsl)
# ---------------------------------------------------------------------------


def shift(field: torch.Tensor, dx: int, dy: int, wrap: bool) -> torch.Tensor:
    """Neighbour lookup: value at (x + dx, y + dy), wrapped or edge-clamped."""
    if wrap:
        return torch.roll(field, shifts=(-dy, -dx), dims=(0, 1))
    pad = max(abs(dx), abs(dy), 1)
    padded = F.pad(field[None, None].float(), (pad, pad, pad, pad), mode="replicate")[0, 0]
    height, width = field.shape
    return padded[pad + dy : pad + dy + height, pad + dx : pad + dx + width]


def height_to_normal(
    height8: torch.Tensor,
    island: torch.Tensor,
    operator: str,
    strength: float,
    convention: str,
    wrap: bool,
) -> torch.Tensor:
    """Tangent-space normal in [-1, 1], shape (3, H, W); off-island texels are flat."""
    corner, edge = OPERATOR_WEIGHTS[operator]

    def tap(dx: int, dy: int) -> torch.Tensor:
        neighbour = shift(height8, dx, dy, wrap)
        on_island = shift(island, dx, dy, wrap) > 0.5
        return torch.where(on_island, neighbour, height8)

    s00, s01, s02 = tap(-1, -1), tap(0, -1), tap(1, -1)
    s10, s12 = tap(-1, 0), tap(1, 0)
    s20, s21, s22 = tap(-1, 1), tap(0, 1), tap(1, 1)
    dx = -corner * s00 + corner * s02 - edge * s10 + edge * s12 - corner * s20 + corner * s22
    dy = corner * s00 + edge * s01 + corner * s02 - corner * s20 - edge * s21 - corner * s22
    nx = -dx * strength
    ny = -dy * strength if convention == "opengl" else dy * strength
    normal = F.normalize(torch.stack([nx, ny, torch.ones_like(nx)]), dim=0)
    flat = torch.tensor([0.0, 0.0, 1.0]).view(3, 1, 1).expand_as(normal)
    return torch.where((island > 0.5)[None], normal, flat)


# ---------------------------------------------------------------------------
# MER inference (mirrors shaders/mer-map.wgsl)
# ---------------------------------------------------------------------------


def rgb_to_hsv(rgb: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Per-texel hue (0..1), saturation and value from a (3, H, W) tensor."""
    r, g, b = rgb[0], rgb[1], rgb[2]
    c_max = rgb.max(0).values
    c_min = rgb.min(0).values
    delta = c_max - c_min
    safe = delta.clamp(min=1e-9)
    h_r = torch.remainder((g - b) / safe, 6.0)
    h_g = (b - r) / safe + 2.0
    h_b = (r - g) / safe + 4.0
    h = torch.where(c_max == r, h_r, torch.where(c_max == g, h_g, h_b)) / 6.0
    h = torch.where(h < 0, h + 1.0, h)
    h = torch.where(delta > 1e-5, h, torch.zeros_like(h))
    s = torch.where(c_max > 0, delta / c_max.clamp(min=1e-9), torch.zeros_like(c_max))
    return h, s, c_max


def smoothstep(edge0: float, edge1: float, x: torch.Tensor) -> torch.Tensor:
    t = ((x - edge0) / max(edge1 - edge0, 1e-9)).clamp(0, 1)
    return t * t * (3 - 2 * t)


def island_tap(field: torch.Tensor, island: torch.Tensor, dx: int, dy: int, wrap: bool) -> torch.Tensor:
    """Neighbour value, or the centre value when the neighbour is off-island."""
    return torch.where(shift(island, dx, dy, wrap) > 0.5, shift(field, dx, dy, wrap), field)


def infer_mer(rgb: torch.Tensor, height8: torch.Tensor, normal: torch.Tensor, island: torch.Tensor, args: argparse.Namespace) -> torch.Tensor:
    """Packed MER in 0..1, shape (3, H, W): metalness, emissive, roughness."""
    wrap = args.wrap
    h, s, v = rgb_to_hsv(rgb)
    luma = luminance_height(rgb, "bt601", False)

    gold_min, gold_max = (float(x) for x in args.gold_hue.split(","))
    copper_min, copper_max = (float(x) for x in args.copper_hue.split(","))
    achromatic = smoothstep(args.metal_brightness - 0.1, args.metal_brightness, v) * (1 - smoothstep(args.metal_saturation - 0.05, args.metal_saturation, s))
    gold = smoothstep(gold_min - 0.01, gold_min, h) * (1 - smoothstep(gold_max, gold_max + 0.01, h)) * (s >= 0.3) * (v >= 0.5)
    copper = smoothstep(copper_min - 0.01, copper_min, h) * (1 - smoothstep(copper_max, copper_max + 0.01, h)) * (s >= 0.3) * (v >= 0.4)
    metal = (torch.maximum(achromatic, torch.maximum(gold, copper)) >= 0.5).float()
    if not args.no_metal_clean:
        votes = torch.stack([island_tap(metal, island, dx, dy, wrap) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]).sum(0)
        metal = (votes >= 5).float()

    bright_saturated = smoothstep(args.emissive_brightness - 0.05, args.emissive_brightness, v) * smoothstep(args.emissive_saturation - 0.05, args.emissive_saturation, s)
    over = args.emissive_overbright
    exceeds = smoothstep(over - 0.05, over, luma) if over < 1.0 else torch.zeros_like(luma)
    emissive = torch.maximum(bright_saturated, exceeds)
    if args.emissive_softness > 0:
        taps = [island_tap(emissive, island, dx, dy, wrap) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
        emissive = torch.lerp(emissive, torch.stack(taps).mean(0), min(1.0, args.emissive_softness))

    w_var, w_edge, w_sat = (float(x) for x in args.rough_weights.split(","))
    taps = torch.stack([island_tap(luma, island, dx, dy, wrap) for dy in range(-2, 3) for dx in range(-2, 3)])
    variance = (taps.pow(2).mean(0) - taps.mean(0).pow(2)).clamp(min=0)
    variance_term = (variance * 10).clamp(0, 1)
    l = {(dx, dy): island_tap(luma, island, dx, dy, wrap) for dy in (-1, 0, 1) for dx in (-1, 0, 1)}
    gx = -l[(-1, -1)] + l[(1, -1)] - 2 * l[(-1, 0)] + 2 * l[(1, 0)] - l[(-1, 1)] + l[(1, 1)]
    gy = l[(-1, -1)] + 2 * l[(0, -1)] + l[(1, -1)] - l[(-1, 1)] - 2 * l[(0, 1)] - l[(1, 1)]
    edge_term = (torch.sqrt(gx * gx + gy * gy) * 2).clamp(0, 1)
    saturation_term = 1 - s * 0.5
    nx, ny = normal[0], normal[1]
    ysign = -1.0 if args.convention == "opengl" else 1.0
    ddx = island_tap(nx, island, 1, 0, wrap) - island_tap(nx, island, -1, 0, wrap)
    ddy = island_tap(ny, island, 0, 1, wrap) - island_tap(ny, island, 0, -1, wrap)
    curvature_term = (-(0.5 * (ddx + ysign * ddy)) * 2).clamp(-1, 1)
    roughness = variance_term * w_var + edge_term * w_edge + saturation_term * w_sat + curvature_term * args.rough_curvature
    roughness = (roughness * args.rough_scale + args.rough_bias).clamp(0, 1)
    influence = max(-1.0, min(1.0, args.rough_height))
    if influence != 0:
        field = 1 - height8 if influence > 0 else height8
        roughness = torch.lerp(roughness, field, abs(influence))

    mer = torch.stack([metal, emissive.clamp(0, 1), roughness])
    off = torch.tensor([0.0, 0.0, 1.0]).view(3, 1, 1).expand_as(mer)
    return torch.where((island > 0.5)[None], mer, off)


def uniform_channel(value: str, flag: str) -> float | None:
    """'auto' → None, otherwise a validated 0..1 uniform value."""
    if value == "auto":
        return None
    try:
        parsed = float(value)
    except ValueError:
        sys.exit(f"error: --{flag} must be auto or 0..1")
    if not 0 <= parsed <= 1:
        sys.exit(f"error: --{flag} must be auto or 0..1")
    return parsed


def parse_palette(text: str) -> list[tuple[tuple[int, int, int], list[float | None]]]:
    """Parse '#RRGGBB=m,e,r;...' into [((r, g, b), [m|None, e|None, r|None])]."""
    entries = []
    for raw in (e.strip() for e in text.split(";") if e.strip()):
        try:
            colour, values = raw.split("=")
            colour = colour.strip().lstrip("#")
            parts = [p.strip() for p in values.split(",")]
            if len(colour) != 6 or len(parts) != 3:
                raise ValueError
            rgb = tuple(int(colour[i : i + 2], 16) for i in (0, 2, 4))
            channels = [None if p == "-" else float(p) for p in parts]
        except ValueError:
            sys.exit(f'error: bad --palette entry "{raw}" (expected #RRGGBB=m,e,r)')
        if any(c is not None and not 0 <= c <= 1 for c in channels):
            sys.exit(f'error: palette values in "{raw}" must be - or 0..1')
        entries.append((rgb, channels))
    return entries


def apply_mer_overrides(
    mer8: np.ndarray,
    rgb8: np.ndarray,
    island: np.ndarray,
    uniforms: list[float | None],
    palette: list[tuple[tuple[int, int, int], list[float | None]]],
) -> tuple[np.ndarray, int]:
    """Uniform channel values, then exact-colour palette overrides, on (H, W, 3) MER bytes."""
    out = mer8.copy()
    for channel, value in enumerate(uniforms):
        if value is not None:
            out[..., channel] = np.where(island, round(value * 255), out[..., channel])
    overridden = 0
    for rgb, channels in palette:
        match = island & np.all(rgb8 == np.array(rgb, dtype=np.uint8), axis=-1)
        overridden += int(match.sum())
        for channel, value in enumerate(channels):
            if value is not None:
                out[..., channel] = np.where(match, round(value * 255), out[..., channel])
    return out, overridden


def mer_stats(mer8: np.ndarray, island: np.ndarray) -> dict:
    """Coverage and range statistics for a packed MER over island texels."""
    count = int(island.sum())
    if count == 0:
        return {"islandTexels": 0, "metalPct": 0, "emissivePct": 0, "roughnessMean": 0, "roughnessRange": [0, 0]}
    metal = int((mer8[..., 0][island] >= 128).sum())
    emissive = int((mer8[..., 1][island] >= 128).sum())
    rough = mer8[..., 2][island].astype(np.float32) / 255
    return {
        "islandTexels": count,
        "metalPct": round(metal / count, 4),
        "emissivePct": round(emissive / count, 4),
        "roughnessMean": round(float(rough.mean()), 4),
        "roughnessRange": [round(float(rough.min()), 4), round(float(rough.max()), 4)],
    }


# ---------------------------------------------------------------------------
# Validation (port of the normal-map classifier used by the reference tool)
# ---------------------------------------------------------------------------


def validate_normal_map(rgb8: np.ndarray) -> dict:
    flat_rgb = rgb8.reshape(-1, 3).astype(np.float32)
    total = flat_rgb.shape[0]
    r, g, b = flat_rgb[:, 0], flat_rgb[:, 1], flat_rgb[:, 2]
    grayscale = int(((r == g) & (g == b)).sum())
    flat = int(((np.abs(r - 128) <= 1) & (np.abs(g - 128) <= 1) & (np.abs(b - 255) <= 1)).sum())
    x, y, z = r / 255 * 2 - 1, g / 255 * 2 - 1, b / 255 * 2 - 1
    xy_len = np.hypot(x, y)
    xy_too_long = int((xy_len > 1 + 1 / 255).sum())
    negative_z = int((b < 128).sum())
    normalized = int((np.abs(np.sqrt(x * x + y * y + z * z) - 1) <= 0.1).sum())
    z_zero = int((np.abs(np.sqrt(x * x + y * y + (b / 255) ** 2) - 1) <= 0.1).sum())
    normalized_pct = normalized / total
    if grayscale / total >= 0.95:
        classification = "heightfield"
    elif normalized_pct >= 0.8:
        classification = "standard"
    elif z_zero / total >= 0.8:
        classification = "z-zero"
    else:
        classification = "xy-only"
    bias = [float(x.mean()), float(y.mean())]
    failing = classification != "standard" or xy_too_long / total > 0.05 or negative_z / total > 0.05 or normalized_pct < 0.5
    warning = xy_too_long > 0 or negative_z > 0 or normalized_pct < 0.98 or abs(bias[0]) > 0.1 or abs(bias[1]) > 0.1
    return {
        "classification": classification,
        "total": total,
        "normalizedPct": round(normalized_pct, 4),
        "flatPct": round(flat / total, 4),
        "negativeZCount": negative_z,
        "xyTooLongCount": xy_too_long,
        "meanXYBias": [round(v, 4) for v in bias],
        "verdict": "fail" if failing else "warn" if warning else "ok",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    args = parse_args()
    albedo_path = Path(args.albedo).resolve()
    if not albedo_path.exists():
        sys.exit(f"error: albedo not found: {albedo_path}")
    out_dir = Path(args.out).resolve() if args.out else albedo_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    name = args.name or albedo_path.stem

    albedo = Image.open(albedo_path).convert("RGBA")
    width, height = albedo.size
    rgba = torch.from_numpy(np.asarray(albedo, dtype=np.float32) / 255.0).permute(2, 0, 1)
    rgb, alpha = rgba[:3], rgba[3]
    island = (alpha >= args.alpha_threshold / 255).float()

    is_depth = args.height_source == "depth"
    flatten = args.flatten if args.flatten is not None else (1.0 if is_depth else 0.0)
    normalize = args.normalize if args.normalize is not None else is_depth
    depth_info = None

    if args.height_source == "luminance":
        field = luminance_height(rgb, args.luma, args.invert_height)
    elif args.height_source == "file":
        height_img = Image.open(Path(args.height_file).resolve()).convert("L")
        if height_img.size != (width, height):
            sys.exit(f"error: height file is {height_img.size[0]}x{height_img.size[1]}, albedo is {width}x{height}")
        field = torch.from_numpy(np.asarray(height_img, dtype=np.float32) / 255.0)
    else:
        field, factor, model_id = estimate_depth(albedo, args.depth_model, args.depth_device)
        depth_info = {"model": model_id, "upscaleFactor": factor, "device": args.depth_device}

    invert_after = args.invert_height if args.height_source != "luminance" else False
    field = edit_depth(field, flatten, args.high_pass, invert_after, normalize)
    if args.seam == "offset":
        field = seal_offset(field, min(0.5, max(0.0, args.seam_amount)))
    soften_sigma = density_sigma(width, height, args.soften)
    if soften_sigma > 0.05:
        field = gaussian_blur(field, soften_sigma, args.wrap)
    black, white, gamma = (float(v) for v in args.levels.split(","))
    if (black, white, gamma) != (0.0, 1.0, 1.0):
        field = apply_levels(field, black, white, gamma)

    # Quantise once; the normal is derived from the same 8-bit height that gets written.
    height8 = (field.clamp(0, 1) * 255).round() / 255
    normal = height_to_normal(height8, island, args.operator, args.strength, args.convention, args.wrap)

    # Round to bytes here (PyPBR's to_pil truncates), and build the PyPBR material from
    # those exact bytes so any further PyPBR operation starts from what was written.
    height_bytes = (height8 * 255).round().to(torch.uint8).numpy()
    normal_bytes = ((normal + 1.0) * 0.5 * 255).round().clamp(0, 255).to(torch.uint8).permute(1, 2, 0).numpy()
    height_img = Image.fromarray(height_bytes, mode="L")
    normal_img = Image.fromarray(normal_bytes, mode="RGB")

    convention = NormalConvention.DIRECTX if args.convention == "directx" else NormalConvention.OPENGL
    material = BasecolorMetallicMaterial(albedo=albedo.convert("RGB"), height=height_img, normal_convention=convention)
    decoded = torch.from_numpy(normal_bytes.astype(np.float32)).permute(2, 0, 1) / 255 * 2 - 1
    # A [-1, 1] tensor is stored verbatim; a fully flat map (min == 0) must go in as an image
    # so PyPBR decodes it instead of mistaking it for an already-decoded tensor.
    material.normal = decoded if float(decoded.min()) < 0 else normal_img

    mer_path = None
    mer_report = None
    mer_img = None
    if not args.no_mer:
        uniforms = [uniform_channel(args.metal, "metal"), uniform_channel(args.emissive, "emissive"), uniform_channel(args.roughness, "roughness")]
        palette = parse_palette(args.palette)
        inferred = infer_mer(rgb, height8, decoded, island, args)
        mer8 = (inferred * 255).round().clamp(0, 255).to(torch.uint8).permute(1, 2, 0).numpy()
        rgb8 = (rgb * 255).round().to(torch.uint8).permute(1, 2, 0).numpy()
        island_np = island.numpy() > 0.5
        mer8, overridden = apply_mer_overrides(mer8, rgb8, island_np, uniforms, palette)
        mer_img = Image.fromarray(mer8, mode="RGB")
        # PyPBR keeps the channels separately; the packed PNG is the Bedrock/Blockbench deliverable.
        material.metallic = Image.fromarray(mer8[..., 0], mode="L")
        material.emissive = Image.fromarray(mer8[..., 1], mode="L")
        material.roughness = Image.fromarray(mer8[..., 2], mode="L")
        mer_report = {
            **mer_stats(mer8, island_np),
            "paletteEntries": len(palette),
            "paletteTexels": overridden,
            "uniform": {"metal": uniforms[0], "emissive": uniforms[1], "roughness": uniforms[2]},
        }

    height_path = out_dir / f"{name}_height.png"
    normal_path = out_dir / f"{name}_normal.png"
    if not args.no_height:
        height_img.save(height_path)
    normal_img.save(normal_path)
    if mer_img is not None:
        mer_path = out_dir / f"{name}_mer.png"
        mer_img.save(mer_path)
    if args.material_folder:
        material.save_to_folder(str(Path(args.material_folder).resolve()))

    print(
        json.dumps(
            {
                "albedo": str(albedo_path),
                "size": [width, height],
                "heightSource": args.height_source,
                "depth": depth_info,
                "height": None if args.no_height else str(height_path),
                "normal": str(normal_path),
                "mer": str(mer_path) if mer_path else None,
                "materialFolder": str(Path(args.material_folder).resolve()) if args.material_folder else None,
                "settings": {
                    "operator": args.operator,
                    "strength": args.strength,
                    "convention": args.convention,
                    "wrap": args.wrap,
                    "flatten": flatten,
                    "highPass": args.high_pass,
                    "normalize": normalize,
                    "seam": args.seam,
                    "softenSigma": round(soften_sigma, 3),
                    "levels": [black, white, gamma],
                },
                "report": validate_normal_map(normal_bytes),
                "merReport": mer_report,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
