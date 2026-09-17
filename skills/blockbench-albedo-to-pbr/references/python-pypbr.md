# Python runtime: PyPBR + Depth Anything V2

Contents: [Install](#install) · [Run](#run) · [What PyPBR does here](#what-pypbr-does-here) · [PyPBR API notes](#pypbr-api-notes) · [Depth Anything in Python](#depth-anything-in-python) · [Troubleshooting](#troubleshooting)

Tested with Python 3.13, pypbr 0.1.0b5, torch 2.9.1 (CUDA 12.8), torchvision 0.24, Pillow 12, numpy 2.2, transformers 4.57 on Windows 11 with an RTX 3080 Ti.

## Install

```bash
pip install pypbr                 # pulls torch, torchvision, numpy, Pillow
pip install transformers          # only for --height-source depth
```

`pypbr` declares `torch>=1.7`; if a GPU build of torch is already installed, keep it (`pip install --no-deps pypbr` avoids replacing it). Depth Anything runs on CUDA automatically when `torch.cuda.is_available()`; CPU works and takes a few seconds per texture.

## Run

```bash
python scripts/albedo_to_normal.py albedo.png --out ./pbr --wrap --strength 0.5
python scripts/albedo_to_normal.py planks.png --height-source depth --depth-model base --high-pass 32 --seam offset --wrap
python scripts/albedo_to_normal.py atlas.png --height-source file --height-file atlas_painted_height.png --soften 1
python scripts/albedo_to_normal.py albedo.png --material-folder ./pbr/material   # + PyPBR folder (albedo, height, normal, metallic, roughness, emissive)
python scripts/albedo_to_normal.py crate.png --metal 0 --rough-bias 0.2           # non-metal, matte-leaning MER
python scripts/albedo_to_normal.py lamp.png --palette "#ffe26a=-,1,-;#8a8a8a=1,-,0.35"   # glow and steel by palette colour
```

`--depth-device auto|cpu|cuda|mps` (default auto). Model choices map to `depth-anything/Depth-Anything-V2-{Small,Base,Large}-hf` (≈100 MB / 390 MB / 1.3 GB downloads on first use, cached by Hugging Face Hub).

## What PyPBR does here

The script builds a `BasecolorMetallicMaterial` from the albedo, the shaped 8-bit height, the derived normal and the inferred `metallic`, `emissive` and `roughness` channels, with `normal_convention` set to match `--convention`. The packed `_mer.png` is assembled from the same bytes. From that object the material can be taken further with PyPBR's own operations before or after export (the Cook-Torrance BRDF in `pypbr.models` can render a lit preview of the metallic/roughness result):

```python
from pypbr.materials import BasecolorMetallicMaterial
from pypbr.io import load_material_from_folder, save_material_to_folder
from pypbr.utils import NormalConvention

material = load_material_from_folder("./pbr/material", preferred_workflow="metallic")
material.normal_convention = NormalConvention.DIRECTX
material.adjust_normal_strength(1.5)      # rescale XY, renormalise
material.invert_normal()                  # flip green, toggles the convention flag
material.resize((32, 32))                 # resamples every map (antialias on)
material.tile(2)                          # repeat every map
material.compute_height_from_normal()     # Poisson (FFT) integration back to a height
save_material_to_folder(material, "./pbr/material_v2")
maps = material.to_pil()                  # {"albedo": RGB, "normal": RGB, "height": L, ...}
```

Maps are `(C, H, W)` float tensors in 0..1 (normals stored decoded in −1..1, exposed encoded through `material.normal_rgb`). Assigning a PIL image, numpy array or CPU float tensor to any attribute name creates that map.

## PyPBR API notes

- **`compute_normal_from_height` is not used by the script.** In 0.1.0b5 it zero-pads the borders (a false gradient along all four edges) and its central difference has the X sign inverted relative to its own docstring, so a ramp rising to the right comes out red-bright instead of red-dark. Verify with a ramp before trusting a newer version. The script derives the normal with the shared Sobel/Prewitt/Scharr kernels and hands the result to the material.
- **`to_pil()` truncates** (`tensor * 255 → byte`), so a value of `k/255` is safe but anything in between rounds down. The script rounds to bytes itself and writes the primary PNGs with Pillow; the `--material-folder` copies go through `save_to_folder`/`to_pil` and can differ from the primary files by one level on a fraction of a percent of texels.
- **Normal assignment rule.** A 3-channel tensor with any value below 0 is stored as-is; one with `min() >= 0` is treated as encoded 0..1, decoded and renormalised. A perfectly flat map (all `(0, 0, 1)`) therefore must be assigned as an image, which the script does.
- `material.height` is `(1, H, W)`; 16-bit and float PNGs are honoured by `load_material_from_folder` (modes `I;16`, `F`), and `to_pil(maps_mode={"height": "I;16"})` writes 16-bit height when needed.
- `NormalConvention.DIRECTX` only records the convention on the material; nothing flips automatically except `invert_normal()`.

## Depth Anything in Python

```python
from transformers import pipeline
estimator = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="cuda")
result = estimator(pil_image)               # {"predicted_depth": tensor(H, W), "depth": PIL "L"}
```

`predicted_depth` is float relative inverse depth at the input size; `depth` is the same normalised to 0–255 with 255 = nearest. The script feeds the nearest-neighbour upscaled albedo (see height-processing.md) and uses `depth`, then block-averages back and unsharpens. Depth Anything 3 (`depth-anything/DA3-*`) is not in the transformers pipeline yet and needs its own package; V2 is what both runtimes share.

## Troubleshooting

- `error: pypbr is required` → `pip install pypbr`. `torch.FloatTensor` type checks inside PyPBR only accept CPU float32 tensors; the script keeps everything on the CPU.
- Emoji/console errors on Windows → set `PYTHONIOENCODING=utf-8`.
- Very slow depth on CPU with `large` → use `small` or `base`; quality difference on textures is modest.
- Report verdict `fail` with `classification: heightfield` → the albedo argument was a grayscale image (a height map). Pass it with `--height-source file` instead.
