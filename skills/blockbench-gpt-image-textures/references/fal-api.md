# fal.ai GPT Image 2.5 API reference

Contents: endpoints · auth · parameters · image sizes · transparency · response · pricing · recipes (curl, Node, Python) · edit endpoint · gotchas. Checked against fal.ai model pages on 2026-09-13.

## Endpoints

| Variant | Text-to-image | Edit (reference images + optional mask) |
|---|---|---|
| Flare | `openai/gpt-image-2.5/flare/text-to-image` | `openai/gpt-image-2.5/flare/edit` |
| Sunburst | `openai/gpt-image-2.5/sunburst/text-to-image` | `openai/gpt-image-2.5/sunburst/edit` |

Base URL: `https://fal.run/<endpoint>`. Sync API: one POST returns image URLs, no polling.

fal describes Flare as the default model, "fast, high-quality generation with natural lighting, rich textures, and support for complex layouts including transparent backgrounds", and Sunburst as "precision-focused ... extra fidelity on intricate detail, in exchange for longer generation times".

## Auth

```
Authorization: Key <FAL_KEY>
```

`Key`, not `Bearer`. Keys come from https://fal.ai/dashboard/keys. Keep the key in the `FAL_KEY` environment variable or a `.env` line; never in a prompt file or a committed script.

## Parameters (text-to-image)

| Param | Required | Values | Default |
|---|---|---|---|
| `prompt` | yes | string (JSON text is fine) | |
| `image_size` | no | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, `auto`, or `{width, height}` | `landscape_4_3` |
| `quality` | no | `auto`, `low`, `medium`, `high`, `xhigh`, `max` | `high` on fal; this skill's script defaults to `medium` |
| `background` | no | `auto`, `transparent`, `opaque` | `auto` |
| `num_images` | no | integer ≥ 1 | `1` |
| `output_format` | no | `png`, `jpeg`, `webp` | `png` |
| `output_compression` | no | 0–100, JPEG/WebP only | |
| `sync_mode` | no | boolean; return a base64 data URI instead of a hosted URL | `false` |

## Parameters (edit)

Same as above plus:

| Param | Required | Notes |
|---|---|---|
| `image_urls` | yes | up to 16 public image URLs |
| `mask_url` | no | black/white image; white = repaint, black = keep |
| `image_size` | no | default `auto` (matches the first reference) |

Edit "changes only what's asked, keeping subject, composition, and background intact" per fal. Reference URLs must be direct, public image URLs: a previous fal output URL, fal storage (`fal.storage.upload` in the JS client, `fal_client.upload_file` in Python), or any public host.

## Custom image sizes

`image_size: {"width": W, "height": H}` must satisfy all of:

- both dimensions multiples of 16
- 655,360 ≤ W × H ≤ 8,294,400
- max edge 3840 px
- aspect ratio ≤ 3:1

Consequence for textures: a 64×64 atlas needs a 16× canvas (1024×1024); a 32×32 tile needs 32× (1024×1024); a 64×32 atlas needs 20× (1280×640). `scripts/uv_layout_prompt.mjs` computes this. Atlases wider than 3:1 (long strips) need a padded canvas and a crop afterwards.

Presets: `square_hd` = 1024×1024, `square` = 512×512 is below the minimum and is upscaled by fal, `landscape_4_3` = 1536×1024 (approx.), `portrait_16_9` = 1024×1536 range. Prefer explicit `{width, height}` so the texel scale is an integer.

## Transparency

`background: "transparent"` is a real parameter on GPT Image 2.5 (it was silently ignored on GPT Image 2). Flare documents transparent output. Sunburst exposes the parameter but its model page does not advertise transparency; check the PNG's alpha channel before depending on it. Use `output_format: "png"` or `"webp"` with transparent backgrounds; JPEG discards alpha.

If alpha is missing, chain a background remover (`fal-ai/imageutils/rembg` or `fal-ai/birefnet`) with the output URL as `image_url`, or paint the gutters transparent in Blockbench with the eraser tool.

## Response

```json
{
  "images": [
    { "url": "https://v3b.fal.media/files/.../out.png", "content_type": "image/png",
      "file_name": "out.png", "width": 1024, "height": 1024 }
  ]
}
```

Download immediately; fal file URLs expire. The URL can be fed back to `/edit` as `image_urls` while it is live.

## Pricing (fal, token-based, from the model pages)

Text tokens $5 / 1M in, $10 / 1M out. Image tokens $8 / 1M in, $30 / 1M out.

Flare, 1024×1024, per image:

| quality | approx. cost |
|---|---|
| low | $0.006 |
| medium | $0.013 |
| high | $0.053 |
| xhigh | $0.094 |
| max | $0.21 |

Sunburst at `high`: 1024×768 ≈ $0.036, 1920×1080 ≈ $0.040, 3840×2160 ≈ $0.10. Longer prompts raise cost slightly; quality is the main lever. Check https://fal.ai/pricing and the dashboard for current numbers.

## Recipes

### curl (text-to-image)

```bash
cat > body.json << 'EOF'
{ "prompt": "<JSON prompt text>", "image_size": {"width": 1024, "height": 1024},
  "quality": "medium", "background": "transparent", "num_images": 1, "output_format": "png" }
EOF
curl -s -X POST "https://fal.run/openai/gpt-image-2.5/flare/text-to-image" \
  -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" -d @body.json
```

### Node (fetch)

```javascript
const res = await fetch("https://fal.run/openai/gpt-image-2.5/sunburst/text-to-image", {
  method: "POST",
  headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, image_size: { width: 1024, height: 1024 }, quality: "medium", background: "transparent" }),
});
const { images } = await res.json();
```

`scripts/fal_gpt_image.mjs` wraps this with argument parsing, `.env` lookup, edit support and file saving.

### Python (requests)

```python
import os, requests
r = requests.post("https://fal.run/openai/gpt-image-2.5/flare/text-to-image",
    headers={"Authorization": f"Key {os.environ['FAL_KEY']}"},
    json={"prompt": prompt, "image_size": {"width": 1024, "height": 1024},
          "quality": "medium", "background": "transparent"})
url = r.json()["images"][0]["url"]
open("out.png", "wb").write(requests.get(url).content)
```

### Edit with a UV template as reference

Render or export the native template texture (or `capture_screenshot` of the UV editor), host it, then:

```json
{ "prompt": "Paint this texture sheet. <same JSON prompt with the layout block>. Keep every region exactly where the colored template places it.",
  "image_urls": ["https://.../template.png"], "image_size": "auto", "quality": "medium", "background": "transparent" }
```

POST to `https://fal.run/openai/gpt-image-2.5/flare/edit`. A mask (`mask_url`, white = repaint) confines a fix to one region on later rounds.

## Gotchas

- `quality` defaults to `high` on fal; set it explicitly or drafts cost 4× more than needed.
- `image_size: "auto"` on text-to-image lets the model choose; always pass explicit dimensions for atlases.
- `num_images` scales cost linearly; 2 candidates at `medium` is cheaper than 1 at `high` and usually more useful.
- `sync_mode: true` returns a data URI that can be passed straight to Blockbench `create_texture` `data`, skipping the download, but it can exceed tool payload limits for large canvases.
- The API returns full-canvas images; nothing enforces the layout. Verify against Blockbench UV data.

Links: https://fal.ai/models/openai/gpt-image-2.5/flare/text-to-image · https://fal.ai/models/openai/gpt-image-2.5/sunburst/text-to-image · https://fal.ai/models/openai/gpt-image-2.5/flare/edit · https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit · https://fal.ai/dashboard
