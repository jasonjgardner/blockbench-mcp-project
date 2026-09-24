# Vanilla Texture Names, Tints and Animation

## Contents

1. Resolution order
2. Java block IDs that differ in Bedrock
3. Texture file names that differ from Java
4. Biome-tinted textures
5. Animated (flipbook) textures
6. Other texture folders

## 1. Resolution order

`vanilla_texture.mjs fetch <spec>` tries, in order: a Bedrock **block ID** in `resource_pack/blocks.json` (per-face texture keys), a key in `textures/terrain_texture.json`, a key in `textures/item_texture.json`, then a literal path under `resource_pack/textures/`. `blocks.json` now uses mostly Java-style IDs (`stone_bricks`, `oak_log`, `red_wool`, `deepslate_bricks`, `smooth_stone`), so try the Java ID first. Use `search <text>` when unsure, adding `--tree` for entities, UI, paintings and other files without an index.

Terrain keys can list variants. For example, `stonebrick` lists plain, mossy, cracked and carved textures. The manifest's `variants` count shows this, and `--variant N` picks one. Prefer the block ID when one exists, because it names the intended variant directly.

## 2. Java block IDs that differ in Bedrock

Pass the Bedrock ID on the right (all verified against `blocks.json`).

| Java ID | Bedrock ID |
|---|---|
| `bricks` | `brick_block` |
| `grass_block` | `grass` |
| `dirt_path` | `grass_path` |
| `terracotta` | `hardened_clay` |
| `nether_bricks` / `red_nether_bricks` | `nether_brick` / `red_nether_brick` |
| `end_stone_bricks` | `end_bricks` |
| `sea_lantern` | `seaLantern` |
| `snow_block` | `snow` |
| `jack_o_lantern` | `lit_pumpkin` |
| `melon` | `melon_block` |
| `oak_door` / `oak_trapdoor` | `wooden_door` / `trapdoor` |
| `magma_block` | `magma` |
| `rooted_dirt` | `dirt_with_roots` |

## 3. Texture file names that differ from Java

Block IDs usually resolve these automatically. The table helps when writing Java resource-pack paths or searching by file name.

| Java `textures/block/…` | Bedrock `textures/blocks/…` |
|---|---|
| `bricks` | `brick` |
| `stone_bricks`, `mossy_stone_bricks`, `cracked_stone_bricks`, `chiseled_stone_bricks` | `stonebrick`, `stonebrick_mossy`, `stonebrick_cracked`, `stonebrick_carved` |
| `oak_planks` (and other woods) | `planks_oak`, `planks_spruce`, `planks_birch`, `planks_jungle`, `planks_acacia`, `planks_big_oak` (dark oak). Newer woods keep Java names (`cherry_planks`) |
| `oak_log`, `oak_log_top` | `log_oak`, `log_oak_top` (dark oak: `log_big_oak`) |
| `oak_leaves` | `leaves_oak.tga` (grayscale; see tints) |
| `grass_block_top`, `grass_block_side` | `grass_top`, `grass_side.tga` (tint mask), pre-tinted `grass_carried`, `grass_side_carried` |
| `cobblestone`, `mossy_cobblestone` | `cobblestone`, `cobblestone_mossy` |
| `sandstone`, `_top`, `_bottom`, `cut_sandstone`, `chiseled_sandstone` | `sandstone_normal`, `sandstone_top`, `sandstone_bottom`, `sandstone_smooth`, `sandstone_carved` |
| `smooth_stone` | `stone_slab_top` |
| `red_wool` (16 colors) | `wool_colored_red`. Light gray is `silver` for wool, concrete, glass and stained terracotta |
| `red_concrete` | `concrete_red` |
| `terracotta`, `red_terracotta` | `hardened_clay`, `hardened_clay_stained_red` |
| `white_glazed_terracotta` | `glazed_terracotta_white` |
| `red_stained_glass` | `glass_red` |
| `nether_bricks`, `end_stone_bricks` | `nether_brick`, `end_bricks` |
| `prismarine`, `prismarine_bricks`, `dark_prismarine` | `prismarine_rough` (animated), `prismarine_bricks`, `prismarine_dark` |
| `andesite`, `polished_andesite` (also granite/diorite) | `stone_andesite`, `stone_andesite_smooth` |
| `podzol_top` | `dirt_podzol_top` |
| `furnace_front` | `furnace_front_off` |
| `water_still`, `lava_still` | `water_still_grey` (grayscale, animated), `lava_still` |
| `deepslate_bricks` | `deepslate/deepslate_bricks` (subfolder) |
| `chain` | `chain1`, `chain2` |

Other subfolders: `blocks/candles/`, `blocks/deepslate/`, `blocks/huge_fungus/`.

## 4. Biome-tinted textures

Minecraft multiplies some grayscale textures by a biome color at runtime. Imported directly, they look gray. The manifest's `tint` field is `"biome"` for known grayscale files, or holds the atlas `overlay_color` / `tint_color`. Treat the atlas colors as Bedrock defaults, not biome truth.

| Texture | Handling |
|---|---|
| `grass_top`, `tallgrass`, `fern`, `double_plant_grass_*`, `vine`, `reeds` (sugar cane) | Multiply by the grass color |
| `leaves_oak`, `leaves_jungle`, `leaves_acacia`, `leaves_big_oak`, `mangrove_leaves` | Multiply by the foliage color. Use `--carried` or a `*_carried` file for pre-tinted green |
| `leaves_birch`, `leaves_spruce` | Fixed Java tints: birch `#80A755`, spruce `#619961` |
| `grass_side.tga`, `grass_side_snowed.tga` | **Alpha is a tint mask, not transparency.** Dirt pixels have alpha 0. Use `tint_texture.py --overlay`, or fetch the pre-composited `blocks/grass_side_carried` |
| `water_still_grey`, `water_flow_grey` | Multiply by water color (Java default `#3F76E4`) |
| `waterlily` | Atlas `tint_color` `#208030` |

Plains colors (Java): grass `#91BD59`, foliage `#77AB2F`. For other biomes, fetch `colormap/grass` or `colormap/foliage` and sample it with `tint_texture.py --colormap <file> --temperature T --downfall D`, which uses Java's lookup: `x = (1-T)*255`, `y = (1-D*T)*255`. Common values: plains 0.8/0.4, forest 0.7/0.8, jungle 0.95/0.9, taiga 0.25/0.8, desert or savanna 2.0/0.0 (clamped to 1.0).

## 5. Animated (flipbook) textures

When `height` is a multiple of `width`, the manifest reports `frames`. It also reports `ticks_per_frame` from `flipbook_textures.json`, where the value is known. Examples:

| Texture | Frames | Ticks/frame |
|---|---|---|
| `water_still_grey` | 32 (16×512) | 2 |
| `water_flow_grey` | 32 (32×1024) | 1 |
| `lava_still` | 32 (16×512) | 16 |
| `sea_lantern` | 5 (16×80) | 5 |
| `prismarine_rough` | 4 (16×64) | 300 |
| `magma` | 3 (16×48) | 10 |
| `lantern` | 3 (16×48) | 8 |

Map UVs to one frame (16×16), not the whole strip. For Java packs, write a `.png.mcmeta` with `{"animation":{"frametime":T}}`. For Bedrock blocks, add a `flipbook_textures.json` entry. For Blockbench preview and export details, follow [flipbook textures](../../blockbench-flipbook-textures/SKILL.md) and its Minecraft reference.

## 6. Other texture folders

| Folder | Notes |
|---|---|
| `items/` | Indexed by `item_texture.json`; `item:<key>` |
| `entity/` | No index. Use `search <name> --tree`. Entity skins match the vanilla `.geo.json` box UV, so use them on a matching model or as material swatches |
| `colormap/` | `grass`, `foliage`, `birch`, `evergreen`, `swamp_*`, `dry_foliage` |
| `painting/`, `particle/`, `environment/`, `ui/`, `gui/`, `trims/`, `models/` | Fetch by path |

`*_mers.tga`, `*_normal.tga` and `*_heightmap.tga` belong to a `texture_set.json`. Fetch them with `--pbr` instead of individually.
