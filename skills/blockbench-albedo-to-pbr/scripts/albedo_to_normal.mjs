#!/usr/bin/env node
/**
 * albedo_to_normal.mjs — albedo PNG to height + tangent-space normal PNGs, on the
 * GPU through vgpu (Dawn-backed WebGPU in Node).
 *
 *   node albedo_to_normal.mjs <albedo.png> [--out DIR] [--name NAME] [options]
 *
 * Height sources (`--height-source`):
 *   luminance  BT.601 luma of the albedo, computed by shaders/height-map.wgsl (default)
 *   depth      Depth Anything V2 via @huggingface/transformers (optional dependency)
 *   file       an existing grayscale height PNG (`--height-file`)
 *
 * The height is shaped on the CPU (depth flatten / high-pass / normalize / seam
 * heal, density softening, levels), quantised to 8 bits, written as
 * `<name>_height.png`, then turned into `<name>_normal.png` by
 * shaders/normal-map.wgsl. shaders/mer-map.wgsl then infers a packed MER
 * (`<name>_mer.png`: R metalness, G emissive, B roughness) from the albedo, the
 * height and the normal's curvature; uniform values and per-colour palette
 * overrides are applied on the CPU. A validation report is printed as JSON.
 *
 * Dependencies: vgpu (pulls the `webgpu` Dawn binding), pngjs. Optional:
 * @huggingface/transformers for `--height-source depth`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PNG } from "pngjs";
import { compute, init, texture } from "vgpu/node";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OPERATORS = { sobel: 0, prewitt: 1, scharr: 2 };
const CONVENTIONS = { directx: 0, opengl: 1 };
const DEPTH_MODELS = {
  small: "onnx-community/depth-anything-v2-small",
  base: "onnx-community/depth-anything-v2-base",
  large: "onnx-community/depth-anything-v2-large",
};
const DEPTH_MIN_INPUT = 1024;
const DEPTH_MAX_INPUT = 4096;
const DEPTH_DOWNSCALE_SHARPEN = 0.5;
const BASE_FACE_TEXELS = 16;
const MAX_SOFTEN_SIGMA = 8;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    name: { type: "string" },
    "height-source": { type: "string", default: "luminance" },
    "height-file": { type: "string" },
    luma: { type: "string", default: "bt601" },
    "invert-height": { type: "boolean", default: false },
    "depth-model": { type: "string", default: "small" },
    "depth-device": { type: "string", default: "cpu" },
    "depth-dtype": { type: "string", default: "fp32" },
    flatten: { type: "string" },
    "high-pass": { type: "string", default: "0" },
    normalize: { type: "boolean" },
    "no-normalize": { type: "boolean", default: false },
    seam: { type: "string", default: "off" },
    "seam-amount": { type: "string", default: "0.15" },
    soften: { type: "string", default: "0" },
    levels: { type: "string", default: "0,1,1" },
    operator: { type: "string", default: "sobel" },
    strength: { type: "string", default: "0.5" },
    convention: { type: "string", default: "directx" },
    wrap: { type: "boolean", default: false },
    "alpha-threshold": { type: "string", default: "8" },
    "no-height": { type: "boolean", default: false },
    "no-mer": { type: "boolean", default: false },
    metal: { type: "string", default: "auto" },
    emissive: { type: "string", default: "auto" },
    roughness: { type: "string", default: "auto" },
    "metal-brightness": { type: "string", default: "0.6" },
    "metal-saturation": { type: "string", default: "0.15" },
    "no-metal-clean": { type: "boolean", default: false },
    "gold-hue": { type: "string", default: "0.11,0.17" },
    "copper-hue": { type: "string", default: "0.03,0.10" },
    "rough-weights": { type: "string", default: "0.4,0.3,0.3" },
    "rough-curvature": { type: "string", default: "0.25" },
    "rough-height": { type: "string", default: "0" },
    "rough-scale": { type: "string", default: "1" },
    "rough-bias": { type: "string", default: "0" },
    "emissive-brightness": { type: "string", default: "0.8" },
    "emissive-saturation": { type: "string", default: "0.5" },
    "emissive-overbright": { type: "string", default: "1" },
    "emissive-softness": { type: "string", default: "0" },
    palette: { type: "string", default: "" },
    gpu: { type: "string", default: "auto" },
    help: { type: "boolean", default: false },
  },
});

if (opts.help || positionals.length !== 1) {
  console.error(`usage: node albedo_to_normal.mjs <albedo.png> [--out DIR] [--name NAME]
  --height-source luminance|depth|file   --height-file PATH
  --luma bt601|average   --invert-height
  --depth-model small|base|large   --depth-device cpu|webgpu   --depth-dtype fp32|fp16|q8
  --flatten 0..1 (depth default 1)   --high-pass TEXELS   --normalize|--no-normalize
  --seam off|offset   --seam-amount 0..0.5
  --soften MULT (density-scaled gaussian, 0 = off)   --levels BLACK,WHITE,GAMMA
  --operator sobel|prewitt|scharr   --strength F   --convention directx|opengl
  --wrap (tiling texture)   --alpha-threshold 0..255   --no-height   --gpu auto|hardware|software
  MER: --no-mer   --metal auto|0..1   --emissive auto|0..1   --roughness auto|0..1
       --metal-brightness 0.6 --metal-saturation 0.15 --gold-hue 0.11,0.17 --copper-hue 0.03,0.10 --no-metal-clean
       --rough-weights VAR,EDGE,SAT   --rough-curvature W   --rough-height -1..1   --rough-scale F --rough-bias F
       --emissive-brightness 0.8 --emissive-saturation 0.5 --emissive-overbright 1 --emissive-softness 0..1
       --palette "#RRGGBB=m,e,r;#RRGGBB=-,-,0.9"   (per-colour overrides; '-' keeps the inferred value)`);
  process.exit(positionals.length === 1 ? 0 : 2);
}

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fail = (message) => {
  console.error(`error: ${message}`);
  process.exit(1);
};

if (!(opts["height-source"] in { luminance: 1, depth: 1, file: 1 })) fail("unknown --height-source");
if (!(opts.operator in OPERATORS)) fail("unknown --operator");
if (!(opts.convention in CONVENTIONS)) fail("unknown --convention");
if (!(opts["depth-model"] in DEPTH_MODELS)) fail("unknown --depth-model");
if (opts["height-source"] === "file" && !opts["height-file"]) fail("--height-file is required with --height-source file");

// ---------------------------------------------------------------------------
// PNG helpers
// ---------------------------------------------------------------------------

/** Decode a PNG into tightly packed RGBA bytes. */
const readPng = (path) => {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, rgba: new Uint8Array(png.data) };
};

/** Encode tightly packed RGBA bytes as a PNG file. */
const writePng = (path, width, height, rgba) => {
  const png = new PNG({ width, height });
  png.data.set(rgba);
  writeFileSync(path, PNG.sync.write(png));
};

/** Expand a 0..1 float field to opaque grayscale RGBA bytes. */
const grayToRgba = (field, alpha) => {
  const out = new Uint8Array(field.length * 4);
  field.forEach((value, i) => {
    const byte = Math.round(Math.min(1, Math.max(0, value)) * 255);
    out.set([byte, byte, byte, alpha ? alpha[i] : 255], i * 4);
  });
  return out;
};

// ---------------------------------------------------------------------------
// Height shaping (pure CPU, mirrors the Python script)
// ---------------------------------------------------------------------------

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const wrapIndex = (value, size) => ((value % size) + size) % size;

/** Integer nearest-neighbour factor lifting the short side to DEPTH_MIN_INPUT. */
const depthUpscaleFactor = (width, height) => {
  const needed = Math.ceil(DEPTH_MIN_INPUT / Math.min(width, height));
  const cap = Math.floor(DEPTH_MAX_INPUT / Math.max(width, height));
  return Math.max(1, Math.min(needed, cap));
};

/** Nearest-neighbour RGBA upscale by an integer factor. */
const nnUpscaleRgba = (rgba, width, height, factor) => {
  const outW = width * factor;
  const out = new Uint8ClampedArray(outW * height * factor * 4);
  for (let y = 0; y < height * factor; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < outW; x++) {
      out.set(rgba.subarray((sy * width + Math.floor(x / factor)) * 4, (sy * width + Math.floor(x / factor)) * 4 + 4), (y * outW + x) * 4);
    }
  }
  return out;
};

/** Exact k×k block average of a single channel; `width`/`height` are the SOURCE dims. */
const downsampleArea = (gray, width, height, factor) => {
  const outW = width / factor;
  const outH = height / factor;
  const out = new Float32Array(outW * outH);
  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) sum += gray[(oy * factor + dy) * width + ox * factor + dx];
      }
      out[oy * outW + ox] = sum / (factor * factor);
    }
  }
  return out;
};

/** Radius-1 box blur, edge-clamped. */
const boxBlurClamped = (field, width, height) => {
  const out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) sum += field[clamp(y + dy, 0, height - 1) * width + clamp(x + dx, 0, width - 1)];
      }
      out[y * width + x] = sum / 9;
    }
  }
  return out;
};

/** Unsharp mask: `field + amount * (field - blur(field))`. */
const sharpen = (field, width, height, amount) => {
  if (amount <= 0) return field;
  const blurred = boxBlurClamped(field, width, height);
  return field.map((value, i) => clamp(value + amount * (value - blurred[i]), 0, 1));
};

/** Least-squares plane slopes over centred pixel coordinates. */
const fitPlane = (field, width, height) => {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  let sxv = 0;
  let syv = 0;
  let sxx = 0;
  let syy = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = field[y * width + x];
      sxv += value * (x - cx);
      syv += value * (y - cy);
      sxx += (x - cx) ** 2;
      syy += (y - cy) ** 2;
    }
  }
  return { gx: sxx > 0 ? sxv / sxx : 0, gy: syy > 0 ? syv / syy : 0 };
};

/** One separable box-blur pass with wrapped sampling. */
const boxBlurWrapAxis = (field, width, height, radius, horizontal) => {
  const out = new Float32Array(field.length);
  const len = horizontal ? width : height;
  const lines = horizontal ? height : width;
  const window = 2 * radius + 1;
  for (let line = 0; line < lines; line++) {
    const idx = (i) => (horizontal ? line * width + wrapIndex(i, len) : wrapIndex(i, len) * width + line);
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += field[idx(i)];
    for (let i = 0; i < len; i++) {
      out[idx(i)] = sum / window;
      sum += field[idx(i + radius + 1)] - field[idx(i - radius)];
    }
  }
  return out;
};

/** Wrap-around box blur ×3 (≈ Gaussian), tile-aware on both axes. */
const blurWrap = (field, width, height, radius) => {
  const r = Math.max(1, Math.round(radius));
  return [0, 1, 2].reduce((acc) => boxBlurWrapAxis(boxBlurWrapAxis(acc, width, height, r, true), width, height, r, false), field);
};

/** Depth edit chain: flatten, high-pass, invert, normalize. */
const editDepth = (field, width, height, { flatten, highPass, invert, normalize }) => {
  let out = Float32Array.from(field);
  if (flatten > 0) {
    const { gx, gy } = fitPlane(out, width, height);
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    out = out.map((value, i) => value - flatten * (gx * ((i % width) - cx) + gy * (Math.floor(i / width) - cy)));
  }
  if (highPass > 0) {
    const low = blurWrap(out, width, height, highPass);
    out = out.map((value, i) => value - low[i] + 0.5);
  }
  if (invert) out = out.map((value) => 1 - value);
  if (normalize) {
    const min = out.reduce((a, b) => Math.min(a, b), Infinity);
    const max = out.reduce((a, b) => Math.max(a, b), -Infinity);
    if (max - min > 1e-6) out = out.map((value) => (value - min) / (max - min));
  }
  return out.map((value) => clamp(value, 0, 1));
};

/** Blend weight of B in a two-way blend, letting the taller surface win the middle. */
const blendWeight = (t, hA, hB, bias) => {
  const window = 4 * t * (1 - t);
  if (bias <= 0 || window <= 0) return t;
  const floor = Math.max(hA, hB) - 0.1;
  const wA = Math.max(hA - floor, 0);
  const wB = Math.max(hB - floor, 0);
  const picked = wA + wB > 0 ? wB / (wA + wB) : t;
  return t + (picked - t) * bias * window;
};

const smoothstep = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/** Wrap-and-heal seam blend: shift by half a tile and blend the original back over the centre seam. */
const sealOffset = (field, width, height, amount) => {
  const halfW = width >> 1;
  const halfH = height >> 1;
  if (halfW < 1 || halfH < 1) return field;
  const reach = clamp(amount * 2, 1e-4, 1);
  const spanX = Math.max(1, Math.floor((width - 1) / 2));
  const spanY = Math.max(1, Math.floor((height - 1) / 2));
  const out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    const ny = clamp(1 - Math.min(y, height - 1 - y) / spanY, 0, 1);
    for (let x = 0; x < width; x++) {
      const nx = clamp(1 - Math.min(x, width - 1 - x) / spanX, 0, 1);
      const here = y * width + x;
      const shifted = ((y + halfH) % height) * width + ((x + halfW) % width);
      const distance = Math.min(1, Math.hypot(nx, ny));
      const t = distance >= reach ? 1 : smoothstep(distance / reach);
      const w = blendWeight(t, field[here], field[shifted], 0.5);
      out[here] = field[shifted] * w + field[here] * (1 - w);
    }
  }
  return out;
};

/** Softening sigma proportional to texel density (≈ shortSide/16/4 texels), capped. */
const densitySigma = (width, height, softness) => Math.min((Math.min(width, height) / BASE_FACE_TEXELS / 4) * softness, MAX_SOFTEN_SIGMA);

/** Separable Gaussian blur with periodic (wrap) or clamped edges. */
const gaussianBlur = (field, width, height, sigma, wrap) => {
  if (sigma <= 0) return field;
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = Float64Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  const total = kernel.reduce((a, b) => a + b, 0);
  const weights = kernel.map((w) => w / total);
  const at = (value, size) => (wrap ? wrapIndex(value, size) : clamp(value, 0, size - 1));
  const tmp = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) acc += field[y * width + at(x + k, width)] * weights[k + radius];
      tmp[y * width + x] = acc;
    }
  }
  const out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) acc += tmp[at(y + k, height) * width + x] * weights[k + radius];
      out[y * width + x] = acc;
    }
  }
  return out;
};

/** Input levels: black/white points then gamma. */
const applyLevels = (field, black, white, gamma) => {
  const range = Math.max(white - black, 0.001);
  return field.map((value) => clamp(value - black, 0, range) / range).map((value) => Math.pow(value, 1 / Math.max(gamma, 0.001)));
};

// ---------------------------------------------------------------------------
// Height sources
// ---------------------------------------------------------------------------

/** Depth Anything V2 through transformers.js; returns 0..1 with 1 = nearest, at native size. */
const estimateDepth = async (rgba, width, height) => {
  let transformers;
  try {
    transformers = await import("@huggingface/transformers");
  } catch {
    fail("--height-source depth needs `npm install @huggingface/transformers`");
  }
  const { pipeline, RawImage } = transformers;
  const estimator = await pipeline("depth-estimation", DEPTH_MODELS[opts["depth-model"]], {
    dtype: opts["depth-dtype"],
    device: opts["depth-device"],
  });
  const factor = depthUpscaleFactor(width, height);
  const inputW = width * factor;
  const inputH = height * factor;
  const input = factor > 1 ? nnUpscaleRgba(rgba, width, height, factor) : new Uint8ClampedArray(rgba);
  const result = await estimator(new RawImage(input, inputW, inputH, 4));
  const { depth } = Array.isArray(result) ? result[0] : result;
  const full = Float32Array.from(depth.data, (byte) => byte / 255);
  const native = factor > 1 ? sharpen(downsampleArea(full, inputW, inputH, factor), width, height, DEPTH_DOWNSCALE_SHARPEN) : full;
  return { field: native, factor, model: DEPTH_MODELS[opts["depth-model"]] };
};

/** Grayscale PNG (red channel) as a 0..1 field; must match the albedo size. */
const loadHeightFile = (path, width, height) => {
  const png = readPng(resolve(path));
  if (png.width !== width || png.height !== height) fail(`height file is ${png.width}x${png.height}, albedo is ${width}x${height}`);
  return Float32Array.from({ length: width * height }, (_, i) => png.rgba[i * 4] / 255);
};

// ---------------------------------------------------------------------------
// MER overrides (CPU): uniform channel values and per-colour palette entries
// ---------------------------------------------------------------------------

/** `auto` → null, otherwise a 0..1 uniform value for the channel. */
const uniformChannel = (value, flag) => {
  if (value === "auto") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) fail(`--${flag} must be auto or 0..1`);
  return parsed;
};

/** Parse `#RRGGBB=m,e,r;...` into [{ rgb: [r, g, b], values: [m|null, e|null, r|null] }]. */
const parsePalette = (text) =>
  text
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = /^#?([0-9a-f]{6})\s*=\s*([^,]+),([^,]+),([^,]+)$/i.exec(entry);
      if (!match) fail(`bad --palette entry "${entry}" (expected #RRGGBB=m,e,r)`);
      const rgb = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16));
      const values = match.slice(2, 5).map((raw) => {
        if (raw.trim() === "-") return null;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) fail(`palette value "${raw}" must be - or 0..1`);
        return parsed;
      });
      return { rgb, values };
    });

/** Uniform channel values, then exact-colour palette overrides, on inferred MER bytes. */
const applyMerOverrides = (mer, rgba, alpha, threshold, uniforms, palette) => {
  const out = Uint8Array.from(mer);
  const lookup = new Map(palette.map(({ rgb, values }) => [rgb.join(","), values]));
  let overridden = 0;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] < threshold) continue;
    uniforms.forEach((value, channel) => {
      if (value !== null) out[i * 4 + channel] = Math.round(value * 255);
    });
    const entry = lookup.get(`${rgba[i * 4]},${rgba[i * 4 + 1]},${rgba[i * 4 + 2]}`);
    if (!entry) continue;
    overridden++;
    entry.forEach((value, channel) => {
      if (value !== null) out[i * 4 + channel] = Math.round(value * 255);
    });
  }
  return { bytes: out, overridden };
};

/** Coverage and range statistics for a packed MER over island texels. */
const merStats = (mer, alpha, threshold) => {
  let count = 0;
  let metal = 0;
  let emissive = 0;
  let roughSum = 0;
  let roughMin = 255;
  let roughMax = 0;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] < threshold) continue;
    count++;
    if (mer[i * 4] >= 128) metal++;
    if (mer[i * 4 + 1] >= 128) emissive++;
    const rough = mer[i * 4 + 2];
    roughSum += rough;
    roughMin = Math.min(roughMin, rough);
    roughMax = Math.max(roughMax, rough);
  }
  const pct = (n) => (count ? Number((n / count).toFixed(4)) : 0);
  return {
    islandTexels: count,
    metalPct: pct(metal),
    emissivePct: pct(emissive),
    roughnessMean: count ? Number((roughSum / count / 255).toFixed(4)) : 0,
    roughnessRange: count ? [Number((roughMin / 255).toFixed(4)), Number((roughMax / 255).toFixed(4))] : [0, 0],
  };
};

// ---------------------------------------------------------------------------
// GPU passes
// ---------------------------------------------------------------------------

const wgsl = (name) => readFileSync(join(SCRIPT_DIR, "shaders", name), "utf8");
const pair = (text, fallback) => text.split(",").map((value, i) => num(value, fallback[i]));

const uploadTexture = (gpu, width, height, rgba, usage) => {
  const tex = texture(gpu, { kind: "2d", size: [width, height], format: "rgba8unorm", usage });
  gpu.gpu.queue.writeTexture({ texture: tex.gpu }, rgba, { bytesPerRow: width * 4, rowsPerImage: height }, [width, height]);
  return tex;
};

/** Run height-map.wgsl over the albedo; returns the 0..1 field. */
const luminanceHeightGpu = async (gpu, rgba, width, height) => {
  const albedoTex = uploadTexture(gpu, width, height, rgba, ["texture_binding", "copy_dst"]);
  const heightTex = texture(gpu, { kind: "2d", size: [width, height], format: "rgba8unorm", usage: ["storage_binding", "copy_src"] });
  const pass = compute(gpu, wgsl("height-map.wgsl"), {
    label: "height-map",
    set: { albedoTex, heightTex, params: { mode: opts.luma === "average" ? 1 : 0, invert: opts["invert-height"] ? 1 : 0 } },
  });
  pass.dispatch(Math.ceil(width / 8), Math.ceil(height / 8));
  const bytes = await heightTex.read({ mipLevel: 0, region: "all" });
  albedoTex.destroy();
  heightTex.destroy();
  return Float32Array.from({ length: width * height }, (_, i) => bytes[i * 4] / 255);
};

/** Run normal-map.wgsl over the quantised height (+ alpha mask); returns RGBA bytes. */
const normalFromHeightGpu = async (gpu, heightRgba, width, height) => {
  const heightTex = uploadTexture(gpu, width, height, heightRgba, ["texture_binding", "copy_dst"]);
  const normalTex = texture(gpu, { kind: "2d", size: [width, height], format: "rgba8unorm", usage: ["storage_binding", "copy_src"] });
  const pass = compute(gpu, wgsl("normal-map.wgsl"), {
    label: "normal-map",
    set: {
      heightTex,
      normalTex,
      params: {
        strength: num(opts.strength, 0.5),
        operator_type: OPERATORS[opts.operator],
        wrap: opts.wrap ? 1 : 0,
        convention: CONVENTIONS[opts.convention],
        alpha_threshold: clamp(num(opts["alpha-threshold"], 8), 0, 255) / 255,
      },
    },
  });
  pass.dispatch(Math.ceil(width / 8), Math.ceil(height / 8));
  const bytes = await normalTex.read({ mipLevel: 0, region: "all" });
  heightTex.destroy();
  normalTex.destroy();
  return bytes;
};

/** Run mer-map.wgsl over albedo + height (with island alpha) + normal; returns inferred RGBA bytes. */
const merFromMapsGpu = async (gpu, rgba, heightRgba, normalRgba, width, height) => {
  const usage = ["texture_binding", "copy_dst"];
  const albedoTex = uploadTexture(gpu, width, height, rgba, usage);
  const heightTex = uploadTexture(gpu, width, height, heightRgba, usage);
  const normalTex = uploadTexture(gpu, width, height, normalRgba, usage);
  const merTex = texture(gpu, { kind: "2d", size: [width, height], format: "rgba8unorm", usage: ["storage_binding", "copy_src"] });
  const [goldMin, goldMax] = pair(opts["gold-hue"], [0.11, 0.17]);
  const [copperMin, copperMax] = pair(opts["copper-hue"], [0.03, 0.1]);
  const [roughVariance, roughEdge, roughSaturation] = pair(opts["rough-weights"], [0.4, 0.3, 0.3]);
  const pass = compute(gpu, wgsl("mer-map.wgsl"), {
    label: "mer-map",
    set: {
      albedoTex,
      heightTex,
      normalTex,
      merTex,
      params: {
        metal_brightness: num(opts["metal-brightness"], 0.6),
        metal_saturation: num(opts["metal-saturation"], 0.15),
        gold_min: goldMin,
        gold_max: goldMax,
        copper_min: copperMin,
        copper_max: copperMax,
        rough_variance: roughVariance,
        rough_edge: roughEdge,
        rough_saturation: roughSaturation,
        rough_curvature: num(opts["rough-curvature"], 0.25),
        rough_height: clamp(num(opts["rough-height"], 0), -1, 1),
        rough_scale: num(opts["rough-scale"], 1),
        rough_bias: num(opts["rough-bias"], 0),
        emissive_brightness: num(opts["emissive-brightness"], 0.8),
        emissive_saturation: num(opts["emissive-saturation"], 0.5),
        emissive_overbright: num(opts["emissive-overbright"], 1),
        emissive_softness: clamp(num(opts["emissive-softness"], 0), 0, 1),
        wrap: opts.wrap ? 1 : 0,
        convention: CONVENTIONS[opts.convention],
        alpha_threshold: clamp(num(opts["alpha-threshold"], 8), 0, 255) / 255,
        metal_clean: opts["no-metal-clean"] ? 0 : 1,
      },
    },
  });
  pass.dispatch(Math.ceil(width / 8), Math.ceil(height / 8));
  const bytes = await merTex.read({ mipLevel: 0, region: "all" });
  [albedoTex, heightTex, normalTex, merTex].forEach((tex) => tex.destroy());
  return bytes;
};

// ---------------------------------------------------------------------------
// Validation (port of the normal-map classifier used by the reference tool)
// ---------------------------------------------------------------------------

const validateNormalMap = (bytes) => {
  const total = bytes.length / 4;
  let normalized = 0;
  let zZero = 0;
  let xyTooLong = 0;
  let negativeZ = 0;
  let flat = 0;
  let grayscale = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    const [r, g, b] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    if (r === g && g === b) grayscale++;
    if (Math.abs(r - 128) <= 1 && Math.abs(g - 128) <= 1 && Math.abs(b - 255) <= 1) flat++;
    const x = (r / 255) * 2 - 1;
    const y = (g / 255) * 2 - 1;
    const z = (b / 255) * 2 - 1;
    sumX += x;
    sumY += y;
    if (Math.hypot(x, y) > 1 + 1 / 255) xyTooLong++;
    if (b < 128) negativeZ++;
    if (Math.abs(Math.hypot(x, y, z) - 1) <= 0.1) normalized++;
    if (Math.abs(Math.hypot(x, y, b / 255) - 1) <= 0.1) zZero++;
  }
  const normalizedPct = normalized / total;
  const classification =
    grayscale / total >= 0.95 ? "heightfield" : normalizedPct >= 0.8 ? "standard" : zZero / total >= 0.8 ? "z-zero" : "xy-only";
  const meanXYBias = [sumX / total, sumY / total];
  const failing = classification !== "standard" || xyTooLong / total > 0.05 || negativeZ / total > 0.05 || normalizedPct < 0.5;
  const warning = xyTooLong > 0 || negativeZ > 0 || normalizedPct < 0.98 || Math.abs(meanXYBias[0]) > 0.1 || Math.abs(meanXYBias[1]) > 0.1;
  return {
    classification,
    total,
    normalizedPct: Number(normalizedPct.toFixed(4)),
    flatPct: Number((flat / total).toFixed(4)),
    negativeZCount: negativeZ,
    xyTooLongCount: xyTooLong,
    meanXYBias: meanXYBias.map((v) => Number(v.toFixed(4))),
    verdict: failing ? "fail" : warning ? "warn" : "ok",
  };
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const albedoPath = resolve(positionals[0]);
if (!existsSync(albedoPath)) fail(`albedo not found: ${albedoPath}`);
const { width, height, rgba } = readPng(albedoPath);
const outDir = resolve(opts.out ?? dirname(albedoPath));
const name = opts.name ?? basename(albedoPath, extname(albedoPath));
mkdirSync(outDir, { recursive: true });

const alpha = Uint8Array.from({ length: width * height }, (_, i) => rgba[i * 4 + 3]);
const source = opts["height-source"];
const isDepth = source === "depth";
const flatten = num(opts.flatten, isDepth ? 1 : 0);
const normalize = opts.normalize ?? (isDepth && !opts["no-normalize"]);

const gpu = await init({ adapter: opts.gpu });
try {
  let field;
  let depthInfo = null;
  if (source === "luminance") field = await luminanceHeightGpu(gpu, rgba, width, height);
  if (source === "file") field = loadHeightFile(opts["height-file"], width, height);
  if (isDepth) {
    const estimate = await estimateDepth(rgba, width, height);
    field = estimate.field;
    depthInfo = { model: estimate.model, upscaleFactor: estimate.factor, device: opts["depth-device"], dtype: opts["depth-dtype"] };
  }

  field = editDepth(field, width, height, {
    flatten,
    highPass: num(opts["high-pass"], 0),
    invert: isDepth || source === "file" ? opts["invert-height"] : false,
    normalize,
  });
  if (opts.seam === "offset") field = sealOffset(field, width, height, clamp(num(opts["seam-amount"], 0.15), 0, 0.5));
  const softenSigma = densitySigma(width, height, num(opts.soften, 0));
  if (softenSigma > 0.05) field = gaussianBlur(field, width, height, softenSigma, opts.wrap);
  const [black, white, gamma] = opts.levels.split(",").map((v, i) => num(v, [0, 1, 1][i]));
  if (black !== 0 || white !== 1 || gamma !== 1) field = applyLevels(field, black, white, gamma);

  const heightRgba = grayToRgba(field, alpha);
  const heightPath = join(outDir, `${name}_height.png`);
  if (!opts["no-height"]) writePng(heightPath, width, height, grayToRgba(field));

  const normalRgba = await normalFromHeightGpu(gpu, heightRgba, width, height);
  const normalPath = join(outDir, `${name}_normal.png`);
  writePng(normalPath, width, height, normalRgba);

  let merPath = null;
  let merReport = null;
  if (!opts["no-mer"]) {
    const threshold = clamp(num(opts["alpha-threshold"], 8), 0, 255);
    const uniforms = [uniformChannel(opts.metal, "metal"), uniformChannel(opts.emissive, "emissive"), uniformChannel(opts.roughness, "roughness")];
    const palette = parsePalette(opts.palette);
    const inferred = await merFromMapsGpu(gpu, rgba, heightRgba, normalRgba, width, height);
    const { bytes: merRgba, overridden } = applyMerOverrides(inferred, rgba, alpha, threshold, uniforms, palette);
    merPath = join(outDir, `${name}_mer.png`);
    writePng(merPath, width, height, merRgba);
    merReport = {
      ...merStats(merRgba, alpha, threshold),
      paletteEntries: palette.length,
      paletteTexels: overridden,
      uniform: { metal: uniforms[0], emissive: uniforms[1], roughness: uniforms[2] },
    };
  }

  console.log(
    JSON.stringify(
      {
        albedo: albedoPath,
        size: [width, height],
        adapter: gpu.adapter,
        heightSource: source,
        depth: depthInfo,
        height: opts["no-height"] ? null : heightPath,
        normal: normalPath,
        mer: merPath,
        settings: {
          operator: opts.operator,
          strength: num(opts.strength, 0.5),
          convention: opts.convention,
          wrap: opts.wrap,
          flatten,
          highPass: num(opts["high-pass"], 0),
          normalize,
          seam: opts.seam,
          softenSigma: Number(softenSigma.toFixed(3)),
          levels: [black, white, gamma],
        },
        report: validateNormalMap(normalRgba),
        merReport,
      },
      null,
      2,
    ),
  );
} finally {
  gpu.dispose();
}
