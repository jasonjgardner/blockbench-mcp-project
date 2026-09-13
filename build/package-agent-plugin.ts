import { chmod, lstat, mkdir, mkdtemp, realpath, rename, rm, utimes } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import {
  OUTPUT_ROOT,
  PLUGIN_NAME,
  packageSourcePath,
  SKILL_NAMES,
  SOURCE_FILES,
  validatePackage,
} from "./agent-plugin-validation";

const archiveTimestamp = new Date("1980-01-01T00:00:00Z");

/** Reject redirected output paths before writing artifacts or replacing generated folders. */
async function validateOutputPath(path: string, kind: "file" | "directory"): Promise<void> {
  const stats = await lstat(path).catch((error: unknown) => {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  });
  if (!stats) return;
  if (stats.isSymbolicLink() || !(kind === "directory" ? stats.isDirectory() : stats.isFile())) {
    throw new Error(`Refusing to use an unexpected output ${kind}: ${path}`);
  }
}

/** Create the output directory only when its ancestors remain inside this repository. */
async function prepareOutputDirectory(): Promise<void> {
  await Promise.all([dirname(OUTPUT_ROOT), OUTPUT_ROOT].map(path => validateOutputPath(path, "directory")));
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const [repositoryRoot, outputRoot] = await Promise.all([
    realpath(join(import.meta.dir, "..")),
    realpath(OUTPUT_ROOT),
  ]);
  if (outputRoot !== join(repositoryRoot, "artifacts", "agent-plugins")) {
    throw new Error(`Refusing to write outside the repository's artifact directory: ${outputRoot}`);
  }
}

/** Remove only a temporary build directory directly inside the resolved output root. */
async function removeStage(stage: string): Promise<void> {
  const [root, target] = await Promise.all([realpath(OUTPUT_ROOT), realpath(stage)]);
  const name = relative(root, target);
  if (isAbsolute(name) || dirname(name) !== "." || !name.startsWith(".package-")) {
    throw new Error(`Refusing to remove an unexpected staging directory: ${target}`);
  }
  await rm(target, { recursive: true, force: true });
}

/** Stage exactly the reviewed source set with stable timestamps and file modes. */
async function stageSources(stage: string): Promise<void> {
  const results = await Promise.allSettled(SOURCE_FILES.map(async source => {
    const target = join(stage, PLUGIN_NAME, source);
    await mkdir(dirname(target), { recursive: true });
    await Bun.write(target, Bun.file(packageSourcePath(source)));
    await chmod(target, 0o644);
    await utimes(target, archiveTimestamp, archiveTimestamp);
  }));
  const failure = results.find(result => result.status === "rejected");
  if (failure) throw new Error("Could not stage all plugin files", { cause: failure.reason });
}

/**
 * Create a fresh ZIP using built-in Windows compression or the Unix zip command.
 * Explicit argument arrays preserve spaces and include hidden client manifests.
 */
async function compressStage(stage: string, archivePath: string): Promise<void> {
  const files = SOURCE_FILES.map(source => `${PLUGIN_NAME}/${source}`);
  const executable = process.platform === "win32" ? "powershell.exe" : "zip";
  const binary = Bun.which(executable);
  if (!binary) throw new Error(`Packaging requires ${executable} on PATH.`);

  const fileList = join(stage, ".zip-files.json");
  await Bun.write(fileList, JSON.stringify(files));
  const args = process.platform === "win32"
    ? ["-NoProfile", "-NonInteractive", "-File", join(import.meta.dir, "zip-agent-plugin.ps1"),
      "-SourceRoot", stage, "-ArchivePath", archivePath, "-FileList", fileList]
    : ["-X", "-9", "-q", archivePath, ...files];
  const child = Bun.spawn([binary, ...args], {
    cwd: stage,
    env: { ...process.env, TZ: "UTC" },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`${executable} failed (${exitCode}): ${(stderr || stdout).trim()}`);
  }
}

/** Replace the generated plugin directory after verifying both paths stay inside output/. */
async function publishPluginDirectory(stage: string): Promise<void> {
  const root = await realpath(OUTPUT_ROOT);
  const source = await realpath(join(stage, PLUGIN_NAME));
  const target = join(root, PLUGIN_NAME);
  const sourceRelative = relative(root, source);
  if (isAbsolute(sourceRelative) || dirname(dirname(sourceRelative)) !== "."
    || !dirname(sourceRelative).startsWith(".package-") || basename(sourceRelative) !== PLUGIN_NAME) {
    throw new Error(`Refusing to publish an unexpected plugin directory: ${source}`);
  }
  const existing = await lstat(target).catch((error: unknown) => {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    const existingPath = await realpath(target);
    if (existing.isSymbolicLink() || !existing.isDirectory() || dirname(existingPath) !== root
      || basename(existingPath) !== PLUGIN_NAME) {
      throw new Error(`Refusing to replace an unexpected plugin directory: ${target}`);
    }
    await rm(existingPath, { recursive: true });
  }
  await rename(source, target);
}

/** Build a ZIP and SHA-256 sidecar, publishing only after compression succeeds. */
async function buildArchive(version: string): Promise<string> {
  await prepareOutputDirectory();
  const stage = await mkdtemp(join(OUTPUT_ROOT, ".package-"));
  try {
    await stageSources(stage);
    const archiveName = `${PLUGIN_NAME}-${version}.zip`;
    const temporaryArchive = join(stage, archiveName);
    await compressStage(stage, temporaryArchive);
    const bytes = await Bun.file(temporaryArchive).bytes();
    const checksum = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    const archivePath = join(OUTPUT_ROOT, archiveName);
    await Promise.all([archivePath, `${archivePath}.sha256`].map(path => validateOutputPath(path, "file")));
    await publishPluginDirectory(stage);
    await Bun.write(archivePath, bytes);
    await Bun.write(`${archivePath}.sha256`, `${checksum}  ${basename(archivePath)}\n`);
    return archivePath;
  } finally {
    await removeStage(stage);
  }
}

/** Run the package checker or build without loading Blockbench or contacting a server. */
async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: bun run build/package-agent-plugin.ts [--check]\nValidate and package the Codex/Claude plugin using Bun and OS ZIP tools.");
    return;
  }
  if (args.some(arg => arg !== "--check")) throw new Error("Unknown option. Use --help for usage.");
  const version = await validatePackage();
  console.log(`Validated ${PLUGIN_NAME} ${version}: ${SOURCE_FILES.length} files, ${SKILL_NAMES.length} skills.`);
  if (args.includes("--check")) return;
  const archivePath = await buildArchive(version);
  console.log(`Created ${join(OUTPUT_ROOT, PLUGIN_NAME)}\nCreated ${archivePath}\nCreated ${archivePath}.sha256`);
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(`Agent plugin packaging failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
