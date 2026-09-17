# Node.js runtime: vgpu + Dawn WebGPU + transformers.js

Contents: [Install](#install) · [Run](#run) · [How the script uses vgpu](#how-the-script-uses-vgpu) · [Shaders](#shaders) · [Depth Anything in Node](#depth-anything-in-node) · [Troubleshooting](#troubleshooting)

Tested with Node 23.6, vgpu 0.5.0 (`@vgpu/adapter-node` → `webgpu` 0.4.0 Dawn prebuilt), pngjs 7.0.0, @huggingface/transformers 4.2.0 on Windows 11 (D3D12 adapter, RTX 3080 Ti).

## Install

The script is an ES module that imports `vgpu/node` and `pngjs`, so it must resolve them from a `node_modules` on its path. Either run it inside a project that has them, or create a small one next to your textures:

```bash
mkdir pbr-tools && cd pbr-tools && npm init -y
npm install vgpu pngjs                       # Dawn arrives through @vgpu/adapter-node → webgpu
npm install @huggingface/transformers        # only for --height-source depth
npx vgpu doctor                              # JSON verdict: adapter found, render probe ok
```

`vgpu` resolves a Dawn binary for the host (win32/x64, linux, darwin prebuilds; a downloadable prebuild as fallback). Machines without a GPU need the portable CPU renderer once: `npx vgpu install-software-renderer`, then pass `--gpu software`. `--gpu auto` (default) prefers hardware.

Copy or reference the whole `scripts/` folder; the script loads `shaders/height-map.wgsl` and `shaders/normal-map.wgsl` relative to its own location.

## Run

```bash
node scripts/albedo_to_normal.mjs albedo.png --out ./pbr --wrap --strength 0.5
node scripts/albedo_to_normal.mjs planks.png --height-source depth --depth-model base --high-pass 32 --seam offset --wrap
node scripts/albedo_to_normal.mjs atlas.png --height-source file --height-file atlas_h.png --soften 1
node scripts/albedo_to_normal.mjs albedo.png --height-source depth --depth-device webgpu --depth-dtype fp16
```

`--depth-device cpu` (default) runs ONNX Runtime on the CPU; `webgpu` runs the model on Dawn as well (`fp16` there halves the download). Model ids: `onnx-community/depth-anything-v2-{small,base,large}` (fp32 ≈ 100 MB / 390 MB / 1.3 GB; fp16 half), cached under `~/.cache/huggingface` on first use.

## How the script uses vgpu

```js
import { compute, init, texture } from "vgpu/node";

const gpu = await init({ adapter: "auto" });            // NodeGpu: gpu.gpu is the raw GPUDevice, gpu.adapter = {name, type}
const albedoTex = texture(gpu, { kind: "2d", size: [w, h], format: "rgba8unorm", usage: ["texture_binding", "copy_dst"] });
gpu.gpu.queue.writeTexture({ texture: albedoTex.gpu }, rgba, { bytesPerRow: w * 4, rowsPerImage: h }, [w, h]);
const heightTex = texture(gpu, { kind: "2d", size: [w, h], format: "rgba8unorm", usage: ["storage_binding", "copy_src"] });

const pass = compute(gpu, wgslSource, { label: "height-map", set: { albedoTex, heightTex, params: { mode: 0, invert: 0 } } });
pass.dispatch(Math.ceil(w / 8), Math.ceil(h / 8));      // workgroup_size(8, 8)
const bytes = await heightTex.read({ mipLevel: 0, region: "all" });   // tightly packed RGBA
gpu.dispose();                                          // stops Dawn polling so the process exits
```

- Bindings are set by their WGSL names; a uniform struct is set as a nested object with its member names. Every declared binding must be set or the dispatch fails with `VGPU-R1-BINDING-NEVER-SET`.
- `texture()` adds no usage flags implicitly: sampled inputs need `texture_binding`, uploads need `copy_dst`, compute outputs need `storage_binding`, readback needs `copy_src`.
- `Texture.read()` submits, copies to a staging buffer, maps it and strips row padding; `readFloats()` exists for float formats.
- `initFromDevice(rawDevice)` wraps a device created elsewhere (for example ONNX Runtime Web's WebGPU device) so vgpu and the model can share buffers zero-copy; the script keeps the two separate for simplicity.
- Uniform structs follow WGSL host-shareable layout; `npx vgpu check shaders/normal-map.wgsl` prints the reflected bindings and validates the source before a run.

## Shaders

Both files are self-contained (no `import`), so `readFileSync` is enough; shaders that import from `@vgpu/wgsl-std` would need `resolveShader()` from `@vgpu/wgsl/runtime` first.

- `height-map.wgsl`: `albedoTex → heightTex`, BT.601 or average luma, optional invert, albedo alpha carried in `.a`.
- `normal-map.wgsl`: `heightTex → normalTex`, Sobel/Prewitt/Scharr with strength, `wrap` or clamp sampling, `alpha_threshold` island clamping, DirectX/OpenGL green. Transparent texels emit `(0.5, 0.5, 1, 1)`.
- `mer-map.wgsl`: `albedoTex + heightTex + normalTex → merTex`, HSV metal heuristic, brightness×saturation emissive with optional softness, roughness from variance, albedo edges, saturation, normal divergence (curvature) and height influence. Transparent texels emit `(0, 0, 1, 1)`.

The CPU shaping (depth flatten/high-pass/normalize, seam, soften, levels) and the MER overrides (uniform values, palette) live in the script; the GPU passes are the luminance extraction, the normal kernel and the MER inference.

## Depth Anything in Node

```js
import { pipeline, RawImage } from "@huggingface/transformers";
const estimator = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", { dtype: "fp32", device: "cpu" });
const { depth } = await estimator(new RawImage(rgbaClamped, width, height, 4));   // depth: RawImage, 1 channel, Uint8Array 0–255, 255 = nearest
```

`RawImage` accepts a `Uint8ClampedArray` with 4 channels straight from `pngjs`; the processor drops alpha. Output is bilinearly interpolated back to the input size by the pipeline. On the tested machine a 1024×1024 estimate took about 1 s on CPU (fp32, small) and the 16× texture round trip (upscaled to 1024) about 2.5 s including model load.

## Troubleshooting

- `VGPU-NODE-SOFTWARE-RENDERER-MISSING` → `npx vgpu install-software-renderer` (only when asking for `--gpu software`).
- `Cannot find package 'vgpu'` → the script is outside a project with the dependencies; see Install. ESM ignores `NODE_PATH`.
- Dawn download blocked or old glibc on Linux → `npx vgpu doctor` names the fix (`npx vgpu install-dawn`).
- `--height-source depth needs npm install @huggingface/transformers` → install it in the same project.
- Process hangs after output → `gpu.dispose()` was skipped; the script always calls it in `finally`.
