// height-map.wgsl — albedo luminance to height (self-contained, no imports).
//
// Height is read straight from the 8-bit albedo as stored (no sRGB linearisation):
// pixel-art luminance steps are the relief the artist painted, and linearising them
// crushes the darks. `mode` picks BT.601 luma (default) or a plain channel average.
// The albedo alpha is carried through in `.a` so the normal pass can treat
// transparent atlas gutters as "outside the island".

struct HeightParams {
  mode: u32,    // 0 = bt601, 1 = average
  invert: u32,  // 1 = dark is high
}

@group(0) @binding(0) var albedoTex: texture_2d<f32>;
@group(0) @binding(1) var heightTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: HeightParams;

fn luminance_bt601(rgb: vec3f) -> f32 {
  return dot(rgb, vec3f(0.299, 0.587, 0.114));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(albedoTex, 0);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }

  let coord = vec2i(gid.xy);
  let texel = textureLoad(albedoTex, coord, 0);
  var height = select(luminance_bt601(texel.rgb), (texel.r + texel.g + texel.b) / 3.0, params.mode == 1u);
  height = select(height, 1.0 - height, params.invert == 1u);
  textureStore(heightTex, coord, vec4f(height, height, height, texel.a));
}
