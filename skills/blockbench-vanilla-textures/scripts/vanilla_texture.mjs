#!/usr/bin/env node
/**
 * Resolve and download vanilla Minecraft textures from Mojang/bedrock-samples via jsDelivr.
 *
 * Usage:
 *   node vanilla_texture.mjs search <query> [--ref main] [--tree]
 *   node vanilla_texture.mjs fetch <spec> [<spec> ...] --out <dir> [--ref main] [--pbr] [--variant 0]
 *
 * A <spec> is tried in this order:
 *   block:<id> | <id>   Bedrock block id from blocks.json (Java-style ids such as stone_bricks,
 *                       oak_log, red_wool mostly match). Resolves every face.
 *   terrain:<key>       Key in textures/terrain_texture.json (brick, stonebrick, planks, ...).
 *   item:<key>          Key in textures/item_texture.json.
 *   <path>              Path under resource_pack/textures, e.g. blocks/brick, entity/pig/pig.png
 *
 * --out      download directory; files keep the Bedrock layout (<out>/blocks/brick.png)
 * --ref      branch or tag of bedrock-samples (default main; pin a tag such as v1.26.50.4 for repeatable results)
 * --pbr      also download <texture>.texture_set.json and the images it references (MERS, normal, heightmap)
 * --variant  index to use when a terrain key lists several textures (default 0)
 * --carried  for blocks, prefer blocks.json carried_textures (pre-tinted inventory art, e.g. green grass and leaves)
 * --tree     search: also scan the full GitHub file tree (entity, ui, ... textures); one GitHub API call, cached in --out or the OS temp dir
 *
 * Prints a JSON manifest (also written to <out>/vanilla_manifest.json for fetch).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = "Mojang/bedrock-samples";
const IMAGE_EXTENSIONS = [".png", ".tga"];
const FACE_EXPANSION = { side: ["north", "south", "east", "west"] };
const BIOME_TINTED = /^(grass_top|grass_side|leaves_(oak|jungle|acacia|big_oak)|mangrove_leaves|vine|waterlily|tallgrass|fern|double_plant_(grass|fern)_(top|bottom)|water_(still|flow)_grey|reeds|melon_stem|pumpkin_stem|redstone_dust_.*|leaves_(birch|spruce))$/;
const LICENSE = "Mojang AB, all rights reserved. Use is subject to the Minecraft EULA and Usage Guidelines.";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const flag = name => args.includes(`--${name}`);
const valueFlags = new Set(["--out", "--ref", "--variant"]);
const positional = args.filter((arg, index) => !arg.startsWith("--") && !valueFlags.has(args[index - 1]));
const [command, ...specs] = positional;

const ref = option("ref", "main");
const cdnBase = `https://cdn.jsdelivr.net/gh/${REPO}@${ref}/resource_pack`;
const outDir = option("out");
const variant = Number(option("variant", "0"));

/** Parse Mojang's JSON files, which may start with `//` comment lines. */
const parseLenientJson = text => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return parseLenientJson(await response.text());
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) return undefined;
  return Buffer.from(await response.arrayBuffer());
}

/** Read width/height from a PNG IHDR or a TGA header. */
function imageSize(bytes, extension) {
  if (extension === ".png") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  return { width: bytes.readUInt16LE(12), height: bytes.readUInt16LE(14) };
}

const asArray = value => (Array.isArray(value) ? value : [value]);
const entryPath = entry => (typeof entry === "string" ? entry : entry.path);
const stripTextures = texturePath => texturePath.replace(/^textures\//, "").replace(/\.(png|tga)$/i, "");

async function loadIndexes() {
  const [blocks, terrain, items, flipbooks] = await Promise.all([
    fetchJson(`${cdnBase}/blocks.json`),
    fetchJson(`${cdnBase}/textures/terrain_texture.json`),
    fetchJson(`${cdnBase}/textures/item_texture.json`),
    fetchJson(`${cdnBase}/textures/flipbook_textures.json`),
  ]);
  return { blocks, terrain: terrain.texture_data, items: items.texture_data, flipbooks };
}

/** Pick one texture from a terrain/item entry and keep its tint metadata. */
function resolveAtlasEntry(entry) {
  const list = asArray(entry.textures);
  const chosen = list[Math.min(variant, list.length - 1)];
  const tint = typeof chosen === "object" ? chosen.overlay_color ?? chosen.tint_color : undefined;
  const distinct = new Set(list.map(entryPath));
  return { path: stripTextures(entryPath(chosen)), variants: distinct.size, atlas_tint: tint };
}

/** Expand blocks.json `textures` (string or per-face object) to Blockbench face names. */
function blockFaces(textures) {
  if (typeof textures === "string") {
    return Object.fromEntries(["north", "south", "east", "west", "up", "down"].map(face => [face, textures]));
  }
  return Object.fromEntries(
    Object.entries(textures).flatMap(([face, key]) => (FACE_EXPANSION[face] ?? [face]).map(name => [name, key]))
  );
}

function resolveSpec(spec, indexes) {
  const [prefix, rest] = spec.includes(":") ? spec.split(/:(.*)/s) : [undefined, spec];
  const block = indexes.blocks[rest];
  if ((prefix === "block" || !prefix) && block?.textures) {
    const useCarried = flag("carried") && block.carried_textures;
    const faces = blockFaces(useCarried ? block.carried_textures : block.textures);
    const keys = [...new Set(Object.values(faces))];
    const resolved = Object.fromEntries(keys.map(key => [key, indexes.terrain[key] && resolveAtlasEntry(indexes.terrain[key])]));
    return { spec, kind: "block", carried: Boolean(useCarried), has_carried: Boolean(block.carried_textures), faces, atlas_keys: resolved };
  }
  if ((prefix === "terrain" || !prefix) && indexes.terrain[rest]) {
    return { spec, kind: "terrain", atlas_keys: { [rest]: resolveAtlasEntry(indexes.terrain[rest]) } };
  }
  if ((prefix === "item" || !prefix) && indexes.items[rest]) {
    return { spec, kind: "item", atlas_keys: { [rest]: resolveAtlasEntry(indexes.items[rest]) } };
  }
  return { spec, kind: "path", atlas_keys: { [rest]: { path: stripTextures(rest), variants: 1 } } };
}

/** Download `relative` (no extension) as PNG, falling back to TGA. */
async function downloadImage(relative) {
  for (const extension of IMAGE_EXTENSIONS) {
    const url = `${cdnBase}/textures/${relative}${extension}`;
    const bytes = await fetchBytes(url);
    if (!bytes) continue;
    const file = path.join(outDir, `${relative}${extension}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    return { file: path.resolve(file), url, format: extension.slice(1), ...imageSize(bytes, extension) };
  }
  return undefined;
}

/** Download a texture_set.json and every image layer it names (colors given as values are skipped). */
async function downloadTextureSet(relative) {
  const url = `${cdnBase}/textures/${relative}.texture_set.json`;
  const bytes = await fetchBytes(url);
  if (!bytes) return undefined;
  const file = path.join(outDir, `${relative}.texture_set.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  const layers = parseLenientJson(bytes.toString("utf8"))["minecraft:texture_set"] ?? {};
  const folder = path.posix.dirname(relative);
  const imageLayers = Object.entries(layers).filter(([, value]) => typeof value === "string" && !value.startsWith("#"));
  const downloaded = await Promise.all(
    imageLayers.map(async ([layer, name]) => [layer, await downloadImage(`${folder}/${name}`)])
  );
  return { file: path.resolve(file), layers: Object.fromEntries(downloaded.map(([layer, image]) => [layer, image?.file ?? null])) };
}

function describeTexture(relative, image, flipbooks, atlasTint) {
  const name = path.posix.basename(relative);
  const flipbook = flipbooks.find(entry => stripTextures(entry.flipbook_texture) === relative);
  const frames = image.height > image.width && image.height % image.width === 0 ? image.height / image.width : 1;
  const tinted = atlasTint ?? (BIOME_TINTED.test(name) ? "biome" : undefined);
  return {
    texture: relative,
    ...image,
    frames,
    ticks_per_frame: flipbook ? flipbook.ticks_per_frame ?? 1 : undefined,
    tint: tinted,
  };
}

async function runFetch(indexes) {
  const requests = specs.map(spec => resolveSpec(spec, indexes));
  const atlasEntries = requests.flatMap(request => Object.values(request.atlas_keys).filter(Boolean));
  const unique = [...new Map(atlasEntries.map(entry => [entry.path, entry])).values()];
  const textures = await Promise.all(unique.map(async entry => {
    const image = await downloadImage(entry.path);
    if (!image) return { texture: entry.path, error: "not found as .png or .tga" };
    const described = describeTexture(entry.path, image, indexes.flipbooks, entry.atlas_tint);
    const textureSet = flag("pbr") ? await downloadTextureSet(entry.path) : undefined;
    return { ...described, variants: entry.variants, texture_set: textureSet };
  }));
  const manifest = { source: `https://github.com/${REPO}`, ref, license: LICENSE, requests, textures };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "vanilla_manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

async function loadTree() {
  const cacheDir = outDir ?? os.tmpdir();
  const cacheFile = path.join(cacheDir, `bedrock-samples-tree-${ref.replace(/[^\w.-]/g, "_")}.json`);
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  const response = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${ref}?recursive=1`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "blockbench-vanilla-textures" },
  });
  if (!response.ok) throw new Error(`GitHub tree request failed (${response.status}); unauthenticated calls are limited to 60/hour.`);
  const paths = (await response.json()).tree
    .map(entry => entry.path)
    .filter(file => file.startsWith("resource_pack/textures/") && /\.(png|tga)$/.test(file) && !/_(mers|mer|normal|heightmap)\.tga$/.test(file))
    .map(file => file.replace("resource_pack/textures/", ""));
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(paths));
  return paths;
}

async function runSearch(indexes) {
  const query = specs[0].toLowerCase();
  const match = key => key.toLowerCase().includes(query);
  const result = {
    ref,
    blocks: Object.keys(indexes.blocks).filter(match),
    terrain: Object.keys(indexes.terrain).filter(match),
    items: Object.keys(indexes.items).filter(match),
  };
  if (!flag("tree")) return result;
  return { ...result, files: (await loadTree()).filter(match) };
}

const commands = { fetch: runFetch, search: runSearch };

/** Validate arguments before any network call; returns an error message or undefined. */
function usageError() {
  if (!commands[command]) return "Usage: vanilla_texture.mjs <search|fetch> ... (see header comment)";
  if (command === "fetch" && (!outDir || specs.length === 0)) return "fetch needs at least one spec and --out <dir>.";
  if (command === "search" && specs.length === 0) return "search needs a query.";
  return undefined;
}

// Set exitCode instead of calling process.exit(): exiting with open fetch sockets aborts Node on Windows.
const problem = usageError();
if (problem) {
  console.error(problem);
  process.exitCode = 1;
}
if (!problem) {
  try {
    const indexes = await loadIndexes();
    console.log(JSON.stringify(await commands[command](indexes), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
