#!/usr/bin/env node
/**
 * Call fal.ai GPT Image 2.5 (Flare or Sunburst) and save the results to disk.
 *
 * Usage:
 *   node fal_gpt_image.mjs --prompt-file prompt.json --model flare --width 1024 --height 1024 \
 *        [--quality medium] [--background transparent] [--num 1] [--format png] \
 *        [--out ./output] [--label atlas] [--edit-image <url> ...] [--mask <url>] [--dry-run]
 *
 * --model        flare (default, fast) | sunburst (slower, more detail)
 * --prompt-file  file whose whole contents become the prompt (JSON prompts are sent verbatim)
 * --prompt       inline prompt string (alternative to --prompt-file)
 * --size         fal preset (square_hd, square, portrait_4_3, ...) instead of --width/--height
 * --edit-image   one or more public image URLs; switches to the /edit endpoint
 * --dry-run      print the request instead of sending it
 *
 * FAL_KEY is read from the environment, then from a .env file in the working directory.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = name => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const options = name => args.flatMap((arg, index) => (arg === `--${name}` ? [args[index + 1]] : []));

const model = option("model") ?? "flare";
if (!["flare", "sunburst"].includes(model)) {
  console.error(`Unknown model "${model}". Use flare or sunburst.`);
  process.exit(1);
}

const promptFile = option("prompt-file");
const prompt = promptFile ? fs.readFileSync(promptFile, "utf8").trim() : option("prompt");
if (!prompt) {
  console.error("Provide --prompt-file <path> or --prompt <text>.");
  process.exit(1);
}

const editImages = options("edit-image");
const isEdit = editImages.length > 0;
const endpoint = `https://fal.run/openai/gpt-image-2.5/${model}/${isEdit ? "edit" : "text-to-image"}`;

const width = option("width") ? Number(option("width")) : undefined;
const height = option("height") ? Number(option("height")) : undefined;
const imageSize = width && height ? { width, height } : option("size") ?? (isEdit ? "auto" : "square_hd");

const body = {
  prompt,
  image_size: imageSize,
  quality: option("quality") ?? "medium",
  background: option("background") ?? "auto",
  num_images: Number(option("num") ?? 1),
  output_format: option("format") ?? "png",
  ...(isEdit ? { image_urls: editImages } : {}),
  ...(option("mask") ? { mask_url: option("mask") } : {}),
};

if (flag("dry-run")) {
  console.log(JSON.stringify({ endpoint, body }, null, 2));
  process.exit(0);
}

/** Resolve the fal key from the environment or a local .env file. */
function resolveKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  if (!fs.existsSync(".env")) return undefined;
  return fs.readFileSync(".env", "utf8").match(/^FAL_KEY=(.+)$/m)?.[1]?.trim();
}

const key = resolveKey();
if (!key) {
  console.error("FAL_KEY is not set. Export it or add FAL_KEY=... to .env.");
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json = await response.json();
if (!response.ok || !Array.isArray(json.images) || json.images.length === 0) {
  console.error(`fal request failed (${response.status}): ${JSON.stringify(json)}`);
  process.exit(2);
}

const outDir = option("out") ?? "./output";
const label = option("label") ?? `gpt25_${model}`;
fs.mkdirSync(outDir, { recursive: true });
const stamp = Date.now();

const saved = await Promise.all(json.images.map(async (image, index) => {
  const suffix = json.images.length > 1 ? `_${index + 1}` : "";
  const file = path.join(outDir, `${label}_${stamp}${suffix}.${body.output_format}`);
  const bytes = Buffer.from(await (await fetch(image.url)).arrayBuffer());
  fs.writeFileSync(file, bytes);
  return { file, width: image.width, height: image.height, url: image.url };
}));

console.log(JSON.stringify({ endpoint, saved }, null, 2));
