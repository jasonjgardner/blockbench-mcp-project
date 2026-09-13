#!/usr/bin/env node
/**
 * Build the "expected UV layout" block for a GPT Image 2.5 texture prompt from
 * Blockbench MCP inspection output.
 *
 * Input JSON file shape (paste raw tool results, nothing else is required):
 * {
 *   "textures": [ ...list_textures result... ],          // optional when --atlas-size is given
 *   "cubes":    [ ...one get_cube_uv result per cube... ],
 *   "meshes":   [ { "name": "...", "faces": [ { "key": "...", "uv": [[u,v],...] } ] } ] // optional
 * }
 *
 * Usage:
 *   node uv_layout_prompt.mjs inspection.json [--texture <name|uuid>] [--atlas-size WxH]
 *        [--format json|text] [--min-scale N] [--scale N]
 *
 * Output: a JSON object with the generation canvas, texel scale, and one region per
 * mapped face, in both texel and generated-image pixel coordinates. Embed the
 * `layout` object in the prompt (see references/uv-layout-prompting.md).
 */
import fs from "node:fs";

const MIN_PIXELS = 655_360;
const MAX_PIXELS = 8_294_400;
const MAX_EDGE = 3840;
const MAX_ASPECT = 3;
const MULTIPLE = 16;

const args = process.argv.slice(2);
const inputPath = args.find(arg => !arg.startsWith("--"));
const option = name => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

if (!inputPath) {
  console.error("Usage: node uv_layout_prompt.mjs inspection.json [--texture <name|uuid>] [--atlas-size WxH] [--format json|text] [--min-scale N]");
  process.exit(1);
}

const inspection = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const textureFilter = option("texture");
const format = option("format") ?? "json";
const minScale = Number(option("min-scale") ?? 1);

/** Pick the atlas the regions refer to: explicit size, named texture, or the first listed texture. */
function resolveAtlas() {
  const explicit = option("atlas-size");
  if (explicit) {
    const [width, height] = explicit.toLowerCase().split("x").map(Number);
    return { name: "atlas", frame_size: [width, height], uv_size: [width, height] };
  }
  const textures = Array.isArray(inspection.textures) ? inspection.textures : [];
  const match = textureFilter
    ? textures.find(texture => texture.uuid === textureFilter || texture.name === textureFilter || texture.id === textureFilter)
    : textures[0];
  if (!match) throw new Error("No atlas found. Pass --atlas-size WxH or include list_textures output under \"textures\".");
  return match;
}

const isPowerOfTwo = value => value > 0 && (value & (value - 1)) === 0;

/**
 * Generation size that keeps the atlas aspect and satisfies fal's size constraints.
 * Prefers a power-of-two texel scale (16x for a 64x64 atlas) when it costs at most
 * twice the pixels of the smallest legal canvas, then a multiple of four, then the minimum.
 */
function planCanvas(frameWidth, frameHeight) {
  const aspect = frameWidth / frameHeight;
  const wide = aspect > MAX_ASPECT || aspect < 1 / MAX_ASPECT;
  const forced = option("scale") ? Number(option("scale")) : undefined;
  const candidates = Array.from({ length: 512 }, (_, index) => index + 1)
    .filter(scale => scale >= minScale && (forced === undefined || scale === forced))
    .map(scale => ({ scale, width: frameWidth * scale, height: frameHeight * scale }))
    .filter(({ width, height }) => width % MULTIPLE === 0 && height % MULTIPLE === 0)
    .filter(({ width, height }) => width * height >= MIN_PIXELS && width * height <= MAX_PIXELS)
    .filter(({ width, height }) => width <= MAX_EDGE && height <= MAX_EDGE);
  if (wide || candidates.length === 0) {
    return { error: `Atlas ${frameWidth}x${frameHeight} cannot be generated at its own aspect${forced ? ` with --scale ${forced}` : ""} (fal limits: aspect <= 3:1, ${MIN_PIXELS}-${MAX_PIXELS} px, edge <= ${MAX_EDGE}, multiples of ${MULTIPLE}). Generate a padded canvas and crop, or split the atlas into strips.` };
  }
  const budget = candidates[0].width * candidates[0].height * 2;
  const affordable = candidates.filter(({ width, height }) => width * height <= budget);
  return affordable.find(({ scale }) => isPowerOfTwo(scale))
    ?? affordable.find(({ scale }) => scale % 4 === 0)
    ?? candidates[0];
}

/** Normalize a UV rectangle that may be stored flipped (x1 > x2 means mirrored). */
function normalizeRect([x1, y1, x2, y2]) {
  return {
    rect: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)],
    mirrored_x: x1 > x2,
    mirrored_y: y1 > y2,
  };
}

const atlas = resolveAtlas();
const [frameWidth, frameHeight] = atlas.frame_size;
const [uvWidth, uvHeight] = atlas.uv_size ?? atlas.frame_size;
const canvas = planCanvas(frameWidth, frameHeight);
if (canvas.error) {
  console.error(canvas.error);
  process.exit(2);
}

const texelPerUv = [frameWidth / uvWidth, frameHeight / uvHeight];

/** Convert a logical UV rectangle to texel and generated-pixel rectangles. */
function toRegion(name, uvRect, extra = {}) {
  const { rect, mirrored_x, mirrored_y } = normalizeRect(uvRect);
  const texels = [
    Math.round(rect[0] * texelPerUv[0]), Math.round(rect[1] * texelPerUv[1]),
    Math.round(rect[2] * texelPerUv[0]), Math.round(rect[3] * texelPerUv[1]),
  ];
  const px = texels.map(value => value * canvas.scale);
  return {
    name,
    texels,
    size_texels: [texels[2] - texels[0], texels[3] - texels[1]],
    px,
    ...(mirrored_x ? { mirrored_x } : {}),
    ...(mirrored_y ? { mirrored_y } : {}),
    ...extra,
  };
}

const atlasMatches = face => !textureFilter || face.effective_texture?.uuid === textureFilter || face.effective_texture?.name === textureFilter;

const cubeRegions = (inspection.cubes ?? []).flatMap(cube =>
  Object.entries(cube.faces ?? {})
    .filter(([, face]) => face.texture_status !== "disabled" && atlasMatches(face))
    .map(([direction, face]) => toRegion(`${cube.name}/${direction}`, face.uv, face.rotation ? { rotation: face.rotation } : {}))
    .filter(region => region.size_texels[0] > 0 && region.size_texels[1] > 0)
);

const meshRegions = (inspection.meshes ?? []).flatMap(mesh =>
  (mesh.faces ?? []).map(face => {
    const us = face.uv.map(([u]) => u);
    const vs = face.uv.map(([, v]) => v);
    return toRegion(`${mesh.name}/${face.key}`, [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)], { polygon: true });
  })
);

const regions = [...cubeRegions, ...meshRegions];

/** Merge regions that share the same texel rectangle (mirrored parts, reused faces). */
const shared = Object.values(regions.reduce((groups, region) => {
  const key = region.texels.join(",");
  return { ...groups, [key]: [...(groups[key] ?? []), region.name] };
}, {})).filter(names => names.length > 1);

const layout = {
  atlas: { name: atlas.name, texels: [frameWidth, frameHeight], uv_units: [uvWidth, uvHeight] },
  canvas: { width: canvas.width, height: canvas.height, texel_scale: canvas.scale },
  image_size: { width: canvas.width, height: canvas.height },
  regions,
  shared_regions: shared,
};

if (format === "text") {
  const lines = [
    `Canvas ${canvas.width}x${canvas.height} px = ${frameWidth}x${frameHeight} texel atlas at ${canvas.scale}x (one texel = ${canvas.scale}x${canvas.scale} px block).`,
    ...regions.map(region => `- ${region.name}: px x ${region.px[0]}-${region.px[2]}, y ${region.px[1]}-${region.px[3]} (${region.size_texels[0]}x${region.size_texels[1]} texels)${region.rotation ? `, rotated ${region.rotation}deg` : ""}${region.mirrored_x ? ", mirrored" : ""}`),
    ...(shared.length ? [`Shared pixels: ${shared.map(names => names.join(" = ")).join("; ")}`] : []),
  ];
  console.log(lines.join("\n"));
  process.exit(0);
}

console.log(JSON.stringify(layout, null, 2));
