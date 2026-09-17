/** Run with `bun test <this file>`; Python 3.10+ with Pillow must be available. */
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = mkdtempSync(join(tmpdir(), "blockbench-flipbook-test-"));
const script = fileURLToPath(new URL("./sheet_to_flipbook.py", import.meta.url));
const python = process.env.PYTHON ?? "python";
const colors = [[255, 0, 0, 255], [0, 255, 0, 128], [0, 0, 255, 0], [255, 255, 0, 64]];

afterAll(() => {
  const target = resolve(workspace);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("blockbench-flipbook-test-")) {
    throw new Error("Refusing cleanup outside the test's temporary directory");
  }
  rmSync(target, { recursive: true, force: true });
});

/** Execute Python without shell interpolation, inheriting any selected Pillow environment. */
function runPython(args, input = "") {
  return Bun.spawnSync([python, ...args], { stdin: Buffer.from(input), env: process.env });
}

/** Create a measured RGBA fixture with colored cells on an opaque magenta gutter. */
function fixture(name, size, rectangles) {
  const path = join(workspace, `${name}.png`);
  const result = runPython(["-c", `
import json, sys
from PIL import Image
spec = json.load(sys.stdin)
image = Image.new("RGBA", tuple(spec["size"]), (255, 0, 255, 255))
for index, (x, y, width, height) in enumerate(spec["rectangles"]):
    image.paste(tuple(spec["colors"][index]), (x, y, x + width, y + height))
image.save(spec["path"])
`], JSON.stringify({ path, size, rectangles, colors }));
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return path;
}

/** Decode artifacts independently of the converter, including APNG composited frames. */
function inspect(path) {
  const result = runPython(["-c", `
import json, sys
from PIL import Image, ImageSequence
with Image.open(sys.argv[1]) as image:
    frames = [{"pixels": list(frame.convert("RGBA").getdata()), "duration": frame.info.get("duration")} for frame in ImageSequence.Iterator(image)]
    print(json.dumps({"size": list(image.size), "mode": image.mode, "frames": frames, "loop": image.info.get("loop")}))
`, path]);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return JSON.parse(result.stdout.toString());
}

/** Invoke the real CLI, returning its paths and status so failure cases can verify no output. */
function convert(name, source, args) {
  const output = join(workspace, `${name}.png`);
  return { output, ...runPython([script, source, output, "--frame-width", "2", "--frame-height", "2", ...args]) };
}

/** Four pixels per 2x2 frame; preserving transparent RGB catches accidental alpha masking. */
function expectedPixels(indices) {
  return indices.flatMap(index => Array.from({ length: 4 }, () => colors[index]));
}

const grid = fixture("grid-source", [4, 4], [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 2, 2], [2, 2, 2, 2]]);

test("grid conversion preserves row-major order, full RGBA values, and frame timing", () => {
  const preview = join(workspace, "grid-preview.apng");
  const result = convert("grid-result", grid, ["--grid", "2", "2", "--ticks-per-frame", "3", "--preview", preview]);
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout.toString());
  expect(report).toMatchObject({ output_size: [2, 8], frame_size: [2, 2], frame_count: 4, source_indices: [0, 1, 2, 3], alpha_extrema: [0, 255], fps: 20 / 3, duration_seconds: 0.6, runtime_metadata_written: false });
  expect(inspect(result.output)).toMatchObject({ size: [2, 8], mode: "RGBA", frames: [{ pixels: expectedPixels([0, 1, 2, 3]), duration: null }] });
  const animation = inspect(preview);
  expect(animation.size).toEqual([2, 2]);
  expect(animation.loop).toBe(0);
  expect(animation.frames.map(frame => frame.duration)).toEqual([150, 150, 150, 150]);
  expect(animation.frames.flatMap(frame => frame.pixels)).toEqual(expectedPixels([0, 1, 2, 3]));
});

test("horizontal conversion and an already vertical strip retain identical pixels", () => {
  const source = fixture("horizontal-source", [8, 2], [[0, 0, 2, 2], [2, 0, 2, 2], [4, 0, 2, 2], [6, 0, 2, 2]]);
  const horizontal = convert("horizontal-result", source, ["--grid", "4", "1"]);
  expect(horizontal.exitCode).toBe(0);
  const vertical = convert("vertical-result", horizontal.output, ["--grid", "1", "4"]);
  expect(vertical.exitCode).toBe(0);
  expect(inspect(vertical.output).frames[0].pixels).toEqual(expectedPixels([0, 1, 2, 3]));
});

test("measured margins and gutters are excluded before per-frame downsampling", () => {
  const source = fixture("gutter-source", [11, 11], [[1, 1, 4, 4], [6, 1, 4, 4], [1, 6, 4, 4], [6, 6, 4, 4]]);
  const result = convert("gutter-result", source, ["--grid", "2", "2", "--crop", "1", "1", "9", "9", "--gap", "1", "1", "--count", "2", "--resample", "lanczos"]);
  expect(result.exitCode).toBe(0);
  expect(inspect(result.output).frames[0].pixels).toEqual(expectedPixels([0, 1]));
  expect(JSON.parse(result.stdout.toString()).source_rectangles).toEqual([[1, 1, 4, 4], [6, 1, 4, 4]]);
});

test("explicit rectangles can reorder and repeat cells without changing frame anchors", async () => {
  const rects = join(workspace, "rectangles.json");
  await Bun.write(rects, JSON.stringify([[2, 2, 2, 2], [0, 0, 2, 2], [2, 0, 2, 2]]));
  const result = convert("rect-result", grid, ["--rects", rects, "--indices", "2,0,1,0"]);
  expect(result.exitCode).toBe(0);
  expect(inspect(result.output).frames[0].pixels).toEqual(expectedPixels([1, 3, 0, 3]));
});

test("alpha snapping is opt-in and does not discard RGB", () => {
  const result = convert("alpha-result", grid, ["--grid", "2", "2", "--alpha-threshold", "128"]);
  expect(result.exitCode).toBe(0);
  expect(inspect(result.output).frames[0].pixels).toEqual(expectedPixels([0, 1, 2, 3]).map(([r, g, b, a]) => [r, g, b, a >= 128 ? 255 : 0]));
});

test("rectangular frames preserve row orientation and requested dimensions", () => {
  const result = convert("rectangle-result", grid, ["--grid", "1", "2", "--frame-width", "4"]);
  expect(result.exitCode).toBe(0);
  const pixels = [0, 1, 2, 3].flatMap(index => [colors[index], colors[index]]);
  expect(inspect(result.output)).toMatchObject({ size: [4, 4], frames: [{ pixels: [...pixels.slice(0, 4), ...pixels.slice(0, 4), ...pixels.slice(4), ...pixels.slice(4)] }] });
});

test.each([
  ["fractional cells", ["--grid", "3", "2"], "whole pixels"],
  ["aspect mismatch", ["--grid", "1", "2"], "aspect ratios differ"],
  ["out-of-bounds crop", ["--grid", "2", "2", "--crop", "1", "0", "4", "4"], "exceeds source"],
  ["missing source cell", ["--grid", "2", "2", "--indices", "4"], "outside the sheet"],
  ["too many frames", ["--grid", "2", "2", "--count", "5"], "exceeds the number"],
  ["negative gap", ["--grid", "2", "2", "--gap", "-1", "0"], "nonnegative"],
  ["zero tick duration", ["--grid", "2", "2", "--ticks-per-frame", "0"], "positive integer"],
  ["ambiguous selection", ["--grid", "2", "2", "--count", "2", "--indices", "0,1"], "not allowed with argument"],
])("rejects %s without writing an output", async (name, args, message) => {
  const result = convert(`invalid-${name}`, grid, args);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain(message);
  expect(await Bun.file(result.output).exists()).toBe(false);
});

test("rejects unequal measured cells and animated input", async () => {
  const rects = join(workspace, "unequal.json");
  await Bun.write(rects, JSON.stringify([[0, 0, 2, 2], [2, 0, 1, 2]]));
  const unequal = convert("unequal-result", grid, ["--rects", rects]);
  expect(unequal.exitCode).not.toBe(0);
  expect(unequal.stderr.toString()).toContain("same dimensions");
  const preview = join(workspace, "input-preview.apng");
  expect(convert("preview-source", grid, ["--grid", "2", "2", "--preview", preview]).exitCode).toBe(0);
  const animated = convert("animated-result", preview, ["--grid", "1", "1"]);
  expect(animated.exitCode).not.toBe(0);
  expect(animated.stderr.toString()).toContain("static sprite sheet");
});

test("protects source images and existing outputs", async () => {
  const original = new Uint8Array(await Bun.file(grid).arrayBuffer());
  const sourceOverwrite = runPython([script, grid, grid, "--grid", "2", "2", "--frame-width", "2", "--frame-height", "2", "--overwrite"]);
  expect(sourceOverwrite.exitCode).not.toBe(0);
  expect(new Uint8Array(await Bun.file(grid).arrayBuffer())).toEqual(original);
  const output = join(workspace, "protected.png");
  await Bun.write(output, "keep existing asset");
  const args = ["--grid", "2", "2"];
  expect(convert("protected", grid, args).exitCode).not.toBe(0);
  expect(await Bun.file(output).text()).toBe("keep existing asset");
  expect(convert("protected", grid, [...args, "--overwrite"]).exitCode).toBe(0);
  expect(inspect(output).size).toEqual([2, 8]);
});
