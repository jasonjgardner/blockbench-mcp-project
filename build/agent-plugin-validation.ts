import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const REPOSITORY_ROOT = resolve(import.meta.dir, "..");

/** Shared package identifier used by both client manifests and archive filenames. */
export const PLUGIN_NAME = "blockbench-mcp";

/** Public catalog identifier used in plugin installation commands. */
export const MARKETPLACE_NAME = "blockbench-mcp-project";

/** Complete checked-in plugin directory, ready for Git marketplace installation. */
export const PLUGIN_ROOT = resolve(REPOSITORY_ROOT, "plugins", PLUGIN_NAME);

/** Absolute release directory for the ZIP archive and its SHA-256 sidecar. */
export const OUTPUT_ROOT = resolve(REPOSITORY_ROOT, "artifacts", "agent-plugins");

/** The eight published skills; each name must match its directory and YAML metadata. */
export const SKILL_NAMES = [
  "blockbench-use",
  "blockbench-mcp-overview",
  "blockbench-modeling",
  "blockbench-texturing",
  "blockbench-pbr-materials",
  "blockbench-animation",
  "blockbench-hytale",
  "blockbench-headless",
] as const;

/**
 * Sorted, plugin-relative allowlist for release files. Explicit entries
 * keep desktop bundles, credentials, and unrelated repository files out of archives.
 */
export const SOURCE_FILES: readonly string[] = [
  ".codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".mcp.json",
  "assets/plugin-logo.png",
  "LICENSE",
  "licenses/Apache-2.0.txt",
  "THIRD_PARTY_NOTICES.md",
  "README.md",
  ...SKILL_NAMES.map((name) => `skills/${name}/SKILL.md`),
].toSorted();

/**
 * Map an archive destination to its checked-in plugin source. Git installations
 * and optional ZIP builds use this same complete directory without preparation.
 * @param path - A plugin-relative destination such as skills/blockbench-use/SKILL.md.
 * @returns The absolute source filename or directory inside this repository.
 */
export function packageSourcePath(path: string): string {
  return resolve(PLUGIN_ROOT, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const value: unknown = await Bun.file(path).json();
  if (!isRecord(value)) throw new Error(`${path}: expected a JSON object`);
  return value;
}

function isWithin(root: string, target: string): boolean {
  const remainder = relative(root, target);
  return remainder !== ".." && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

async function rejectSymlinks(target: string): Promise<void> {
  const components = relative(REPOSITORY_ROOT, target).split(sep);
  await Promise.all(components.map(async (_, index) => {
    const path = resolve(REPOSITORY_ROOT, ...components.slice(0, index + 1));
    if ((await lstat(path)).isSymbolicLink()) {
      throw new Error(`Source paths must not contain symlinks: ${path}`);
    }
  }));
}

async function packagedPath(path: string, base = PLUGIN_ROOT): Promise<string> {
  const target = resolve(base, path);
  if (!isWithin(PLUGIN_ROOT, target)) {
    throw new Error(`Out-of-package path: '${path}' from ${base}`);
  }
  const packageRelative = relative(PLUGIN_ROOT, target).split(sep).join("/");
  const source = packageSourcePath(packageRelative);
  await rejectSymlinks(source);
  const [root, resolvedTarget, stats] = await Promise.all([
    realpath(REPOSITORY_ROOT),
    realpath(source),
    lstat(source),
  ]);
  if (!isWithin(root, resolvedTarget)) {
    throw new Error(`Out-of-package path: '${path}' from ${base}`);
  }
  if (stats.isFile() && SOURCE_FILES.includes(packageRelative)) return source;
  if (stats.isDirectory() && (
    packageRelative === "" || SOURCE_FILES.some((name) => name.startsWith(`${packageRelative}/`))
  )) return source;
  throw new Error(`Path is excluded from the archive: '${path}' from ${base}`);
}

async function validateComponentPaths(manifest: Record<string, unknown>, label: string): Promise<void> {
  const componentInterface = "interface" in manifest ? manifest["interface"] : {};
  if (!isRecord(componentInterface)) throw new Error(`${label}: interface must be an object`);
  const components = [
    ...["skills", "mcpServers", "commands", "agents", "hooks"]
      .filter((key) => key in manifest)
      .map((key): readonly [string, unknown] => [key, manifest[key]]),
    ...["composerIcon", "logo", "screenshots"]
      .filter((key) => key in componentInterface)
      .map((key): readonly [string, unknown] => [`interface.${key}`, componentInterface[key]]),
  ];
  await Promise.all(components.map(async ([key, value]) => {
    const paths: unknown = typeof value === "string" ? [value] : value;
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error(`${label}: ${key} must be a relative path or path list`);
    }
    await Promise.all(paths.map(async (path: unknown) => {
      if (typeof path !== "string" || !path.startsWith("./")) {
        throw new Error(`${label}: ${key} paths must start with './'`);
      }
      await packagedPath(path);
    }));
  }));
}

/** Pinned launcher package for the headless server; keep it on a released tag so installs are reproducible. */
export const HEADLESS_PACKAGE = /^github:jasonjgardner\/blockbench-mcp-plugin#v\d+\.\d+\.\d+$/;

/** Confirm the desktop connection is an HTTP loopback URL with an explicit port and endpoint. */
function validateDesktopServer(server: unknown): void {
  if (!isRecord(server) || server["type"] !== "http") {
    throw new Error(".mcp.json: blockbench must use the 'http' transport");
  }
  const rawUrl = server["url"];
  if (typeof rawUrl !== "string") throw new Error(".mcp.json: blockbench.url must be a string");
  const url = URL.parse(rawUrl);
  // Read the written port because URL normalizes an explicit :80 to an empty port.
  const explicitPort = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):([0-9]+)\//i.exec(rawUrl)?.[1];
  if (!url || !explicitPort || Number(explicitPort) === 0 || url.pathname === "/"
    || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new Error(".mcp.json: use an HTTP loopback URL with an explicit port and endpoint");
  }
}

/** Confirm the headless server is a pinned npx stdio launch that always names a sandbox root. */
function validateHeadlessServer(server: unknown): void {
  if (!isRecord(server) || server["type"] !== "stdio" || server["command"] !== "npx") {
    throw new Error(".mcp.json: blockbench-headless must be a 'stdio' server started with 'npx'");
  }
  const args: unknown = server["args"];
  if (!Array.isArray(args) || !args.every((arg): arg is string => typeof arg === "string")) {
    throw new Error(".mcp.json: blockbench-headless.args must be a list of strings");
  }
  if (!args.includes("-y") || !args.some(arg => HEADLESS_PACKAGE.test(arg))) {
    throw new Error(".mcp.json: blockbench-headless must run '-y' with the github:jasonjgardner/blockbench-mcp-plugin#v<version> package");
  }
  const rootIndex = args.indexOf("--root");
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    throw new Error(".mcp.json: blockbench-headless must pass '--root <dir>'; the server refuses to start without a sandbox root");
  }
}

async function validateMcp(): Promise<void> {
  const servers = (await readJson(resolve(PLUGIN_ROOT, ".mcp.json")))["mcpServers"];
  if (!isRecord(servers) || Object.keys(servers).toSorted().join() !== "blockbench,blockbench-headless") {
    throw new Error(".mcp.json: expected exactly the 'blockbench' and 'blockbench-headless' MCP servers");
  }
  validateDesktopServer(servers["blockbench"]);
  validateHeadlessServer(servers["blockbench-headless"]);
}

async function validateSkillNames(): Promise<void> {
  await Promise.all(SKILL_NAMES.map(async (name) => {
    const source = packageSourcePath(`skills/${name}/SKILL.md`);
    const contents = (await Bun.file(source).text()).replace(/\r\n?/g, "\n");
    const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(contents)?.[1];
    if (frontmatter === undefined) throw new Error(`${source}: missing YAML frontmatter`);
    const metadata: unknown = Bun.YAML.parse(frontmatter);
    if (!isRecord(metadata) || metadata["name"] !== name) {
      throw new Error(`${source}: frontmatter name must match directory '${name}'`);
    }
  }));
}

function withoutCodeFences(contents: string): string {
  let fence = "";
  return contents.replace(/\r\n?/g, "\n").split("\n").map((line) => {
    const match = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(line);
    const marker = match?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && match?.[2]?.trim() === "") {
        fence = "";
      }
      return "";
    }
    if (marker) {
      fence = marker;
      return "";
    }
    return line;
  }).join("\n");
}

async function validateMarkdownLinks(): Promise<void> {
  const destination = String.raw`(?:<([^>\n]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?`;
  await Promise.all(SOURCE_FILES.filter((path) => path.endsWith(".md")).map(async (path) => {
    const source = packageSourcePath(path);
    const contents = withoutCodeFences(await Bun.file(source).text());
    const patterns = [
      new RegExp(String.raw`!?\[[^\]\n]*\]\(\s*${destination}\s*\)`, "g"),
      new RegExp(String.raw`^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*${destination}`, "gm"),
    ];
    const links = patterns.flatMap((pattern) => [...contents.matchAll(pattern)]);
    await Promise.all(links.map(async (match) => {
      const target = match[1] ?? match[2] ?? "";
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return;
      const pathname = target.split(/[?#]/, 1)[0];
      if (!pathname) return;
      await packagedPath(decodeURIComponent(pathname), dirname(resolve(PLUGIN_ROOT, path)));
    }));
  }));
}

function marketplaceEntry(catalog: Record<string, unknown>, label: string): Record<string, unknown> {
  const plugins = catalog["plugins"];
  if (catalog["name"] !== MARKETPLACE_NAME || !Array.isArray(plugins) || plugins.length !== 1) {
    throw new Error(`${label}: expected marketplace '${MARKETPLACE_NAME}' with one plugin`);
  }
  const entry: unknown = plugins[0];
  if (!isRecord(entry) || entry["name"] !== PLUGIN_NAME) {
    throw new Error(`${label}: expected plugin '${PLUGIN_NAME}'`);
  }
  return entry;
}

/** Check both catalogs against the actual checked-in plugin before publishing this branch. */
async function validateMarketplaces(): Promise<void> {
  const [codex, claude] = await Promise.all([
    readJson(resolve(REPOSITORY_ROOT, ".agents/plugins/marketplace.json")),
    readJson(resolve(REPOSITORY_ROOT, ".claude-plugin/marketplace.json")),
  ]);
  const codexEntry = marketplaceEntry(codex, "Codex catalog");
  const claudeEntry = marketplaceEntry(claude, "Claude catalog");
  const source = codexEntry["source"];
  const policy = codexEntry["policy"];
  const expectedPath = `./plugins/${PLUGIN_NAME}`;
  if (!isRecord(source) || source["source"] !== "local" || source["path"] !== expectedPath) {
    throw new Error(`Codex catalog must resolve its plugin from ${expectedPath}`);
  }
  if (!isRecord(policy) || policy["installation"] !== "AVAILABLE"
    || policy["authentication"] !== "ON_INSTALL" || codexEntry["category"] !== "Productivity") {
    throw new Error("Codex catalog must declare installation, authentication, and category metadata");
  }
  if (claudeEntry["source"] !== expectedPath) {
    throw new Error(`Claude catalog must resolve its plugin from ${expectedPath}`);
  }
}

/**
 * Validate every allowed source, both client manifests, the desktop and headless MCP
 * servers, skill names, and packaged Markdown destinations before creating release files.
 *
 * @returns The semantic version shared by package.json and both client manifests.
 * @throws When a required file is missing, a path escapes the package or traverses
 * a symlink, or package metadata and document links fail validation.
 */
export async function validatePackage(): Promise<string> {
  await Promise.all(SOURCE_FILES.map(async (path) => {
    const source = await packagedPath(path);
    if (!(await lstat(source)).isFile()) throw new Error(`Required regular source file is missing: ${source}`);
  }));
  const [codex, claude, repositoryPackage] = await Promise.all([
    readJson(resolve(PLUGIN_ROOT, ".codex-plugin", "plugin.json")),
    readJson(resolve(PLUGIN_ROOT, ".claude-plugin", "plugin.json")),
    readJson(resolve(REPOSITORY_ROOT, "package.json")),
  ]);
  const version = repositoryPackage["version"];
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("package.json: version must be a semantic version");
  }
  const manifests: readonly (readonly [string, Record<string, unknown>])[] = [
    ["Codex", codex],
    ["Claude Code", claude],
  ];
  await Promise.all(manifests.map(async ([label, manifest]) => {
    if (manifest["name"] !== PLUGIN_NAME || manifest["version"] !== version) {
      throw new Error(`${label}: expected name '${PLUGIN_NAME}' and version '${version}'`);
    }
    await validateComponentPaths(manifest, label);
  }));
  await Promise.all([
    validateMcp(),
    validateSkillNames(),
    validateMarkdownLinks(),
    validateMarketplaces(),
  ]);
  return version;
}
