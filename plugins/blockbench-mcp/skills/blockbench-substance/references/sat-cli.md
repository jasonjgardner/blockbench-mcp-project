# Substance Automation Toolkit command lines

Official reference: <https://adobedocs.github.io/substance-automation-toolkit/pysbs/sat_commandlines/sat_commandlines.html>. Verified locally against SAT tools 16.0.6 as bundled with Substance 3D Designer. Run any tool with `--help`, or `<tool> <subcommand> --help`, for the exact flags of the installed version.

## Contents

- [Which tool does what](#which-tool-does-what)
- [Shell and path rules](#shell-and-path-rules)
- [sbsrender](#sbsrender)
- [sbscooker](#sbscooker)
- [sbsmutator](#sbsmutator)
- [sbsupdater](#sbsupdater)
- [Exit codes and failure signs](#exit-codes-and-failure-signs)

## Which tool does what

| Tool | Input → output | Ships with |
|---|---|---|
| `sbsrender` | `.sbsar` → image maps | Designer, SAT |
| `sbscooker` | `.sbs` source graph → `.sbsar` | Designer, SAT |
| `sbsupdater` | old `.sbs` → current `.sbs` format | Designer, SAT |
| `sbsmutator` | edit/instantiate/export/inspect `.sbs` | SAT only |
| `substance3d_baker` | 3D scene → mesh maps. See [baker.md](baker.md) | Designer, SAT |
| `pysbs` Python API | author `.sbs` programmatically | SAT only |

Designer's install folder (`C:\Program Files\Adobe\Adobe Substance 3D Designer\` on Windows) holds the four bundled executables and is not on PATH by default. `scripts/sat_locate.py` finds them.

## Shell and path rules

- Pass **native Windows paths** (`C:/Program Files/...` or `C:\...`) to the executables. From Git Bash, `/c/Program Files/...` passed as an *argument* (for example inside `--alias sbs://...`) fails with `Fail to add alias`.
- Quote `$`-prefixed identifiers in POSIX shells and PowerShell: `--set-value '$outputsize@4,4'`. Unquoted, the shell expands `$outputsize` to nothing.
- Vector values are comma-separated with no spaces: `--set-value 'Tint@0.8,0.2,0.1,1'`.
- The Vulkan/GPU device log is printed on **stdout** as `[timestamp] [info] ...` lines before the JSON report. Do not `json.loads` stdout directly: start at the first line that is exactly `[` (as `sat_render.py` does) or pass `--no-report`.

## sbsrender

`sbsrender info <file.sbsar>` lists graphs, inputs and outputs:

```
GRAPH-URL pkg://Autumn_Leaves/Autumn_Leaves
  INPUT $normalformat INTEGER1
  INPUT $outputsize INTEGER2
  INPUT Season FLOAT1
  OUTPUT Diffuse diffuse
  OUTPUT Normal normal
```

`OUTPUT <identifier> <usage...>`: the usage (`baseColor`, `normal`, `roughness`, `metallic`, `emissive`, `height`, `ambientOcclusion`, `opacity`, or legacy `diffuse`/`specular`/`glossiness`) tells you which PBR channel a map feeds.

`sbsrender render` flags used most:

| Flag | Notes |
|---|---|
| `--input <file.sbsar>` | Or a bare path. |
| `--input-graph <url>` | Pick one graph when the sbsar has several. |
| `--input-graph-output <id>` | Render only this output; repeatable. `--input-graph-output-usage <usage>` selects by usage. |
| `--output-path <dir>` | **Must already exist**, otherwise every output fails with `Result cannot be saved` and exit code 47. |
| `--output-name <pattern>` | Always set it explicitly. Patterns: `{inputName}`, `{inputGraphUrl}`, `{outputNodeName}`, `{outputIndex}`, `{outputUsages}`, `{outputLabel}`, `{outputGroup}`, `{colorspace}`, and `{inputPath}` in `--output-path` only. |
| `--output-format` | `png` (default), `tga`, `jpg`, `tif`, `exr`, `dds`, `webp`, `psd`, `hdr`, `bmp`. |
| `--output-bit-depth` | `8`, `16`, `16f`, `32f`. Graph outputs default to their own depth, and height/displacement are often 16-bit. Use `8` for Blockbench. |
| `--set-value <id>@<value>` | Numeric/string parameter. Unknown identifiers are **ignored silently**. Check against `info`. |
| `--set-entry <id>@<path>` | Image input (for example a Blockbench-exported texture or a baked AO map). |
| `--use-preset <name>` | Preset embedded in the sbsar. |
| `--png-format-compression` | `default`, `best_speed`, `best_compression`, `none`. |
| `--engine`, `--gpu <n>`, `--gpu-list`, `--cpu-count`, `--memory-budget` | Runtime selection; the default picks a GPU engine. |
| `--ocio <config>`, `--output-colorspace`, `--set-entry-colorspace`, `--set-output-colorspace` | Colour management. Legacy (sRGB PNG) is fine for Blockbench. |

Base parameters, set with `--set-value`:

| Parameter | Value | Meaning |
|---|---|---|
| `$outputsize` | `<log2 w>,<log2 h>` | **log2**, not pixels: `4,4` = 16×16, `9,9` = 512×512, `4,5` = 16×32. Verified: `4,4` writes 16×16 PNGs. |
| `$randomseed` | int | Variation. Rendering is deterministic for a fixed seed. |
| `$normalformat` | `0` DirectX, `1` OpenGL | Only exists when the graph exposes it, and the graph decides what it does. One tested legacy graph inverted **red**, not green. Compare both renders before trusting it; otherwise flip green with `prep_maps.py convert --flip-green`. |
| `$tiling`, `$pixelsize`, `$format` | | Rarely needed. |

Examples:

```bash
# All outputs at 16x16, 8-bit, deterministic
mkdir -p out
sbsrender render --input mat.sbsar --output-path out --output-name '{inputName}_{outputNodeName}' \
  --output-bit-depth 8 --set-value '$outputsize@4,4' --set-value '$randomseed@7'

# Feed a Blockbench texture into an image input, render only basecolor
sbsrender render mat.sbsar --set-entry 'input_color@C:/work/pedestal.png' \
  --input-graph-output basecolor --output-path out
```

## sbscooker

Cooks `.sbs` → `.sbsar` for `sbsrender`.

```bash
sbscooker --inputs graph.sbs --output-path out            # writes out/graph.sbsar
sbscooker --inputs graph.sbs --alias 'mylib://C:/libs/mylib' --output-path out
```

| Flag | Notes |
|---|---|
| `--inputs <.sbs>` | Repeatable. |
| `--output-path`, `--output-name` | Default name `{inputName}`. Patterns also `{inputPath}`, `{udim}`. |
| `--alias <name>://<path>` | Resolves custom package aliases. Designer's bundled cooker finds the built-in `sbs://` library on its own. Only add aliases for your own libraries. |
| `--merge` | One sbsar from all inputs. |
| `--expose-output-size`, `--expose-random-seed` | Default yes; keep them so `$outputsize`/`$randomseed` stay settable. |
| `--expose-pixel-size` | Default no. |
| `--compression-mode` | `0` auto, `1` best, `2` none. |
| `--size-limit <exp>` | Max node size as log2. |
| `--no-optimization`, `--full`, `--merge-graph`, `--merge-data`, `--reordering`, `--crc` | Optimisation switches; defaults are fine. |

Failure `Error 6 ... package sbs://xxx.sbs could not be found` means a dependency alias is missing or a path was mangled (see shell rules).

## sbsmutator

SAT only (not in Designer). Subcommands: `info`, `edit` (aliases: `graph-parameters-editor`; `instantiate` = `edit --instantiate`; `specialization` = instantiate with name `{inputName}_specialized`), `export`, `update`.

```bash
# What does this .sbs expose?
sbsmutator info --input foo.sbs --print-inputs --print-outputs --print-input-parameters --print-presets

# Bake a Blockbench texture into a graph's image input and overwrite the file
sbsmutator edit --input foo.sbs --connect-image 'input1@path@C:/work/pedestal.png' \
  --output-path '{inputPath}' --output-name '{inputName}'

# Specialise: new default values, hide parameters, drop unused outputs
sbsmutator specialization --input foo.sbs --set-default-value 'Roughness@0.8' \
  --hide-parameters --remove-output emissive --output-path out
```

SAT is not installed on every machine, so confirm value syntax for `--set-default-value` and `--switch-to-constant` with `sbsmutator edit --help` before scripting them. Other edit flags: `--connect-input`, `--switch-to-constant`, `--set-bit-depth`, `--remove-preset`, `--remove-all-presets`, `--insert-sbsprs`, `--output-graph-name/-label/-description/-category/-tags/-icon/-physical-size`. Export: `--build-archive`, `--preserve-alias`. Globals: `--alias`, `--no-dependency`, `--output-merge`, `--presets-path`.

## sbsupdater

```bash
sbsupdater update --input old.sbs --output-path out          # one file
sbsupdater update --input C:/graphs --recursive --output-path out
```

Run it before `sbscooker` when a downloaded `.sbs` was authored in an older Designer and cooking reports version errors.

## Exit codes and failure signs

| Symptom | Cause |
|---|---|
| exit 47, `Result cannot be saved to ...` | `--output-path` folder missing. |
| Output looks default-valued | `--set-value` identifier misspelt, ignored silently. |
| `Fail to add alias` | MSYS-style path (`/c/...`) in the alias. |
| exit 6, `Cannot open the package` | Missing dependency alias. |
| 16-bit PNGs appear white in a viewer or after `PIL.convert("L")` | Values not scaled from 16 to 8 bit. Use `--output-bit-depth 8` or `prep_maps.py convert`. |
