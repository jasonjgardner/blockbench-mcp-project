// normal-map.wgsl — height to tangent-space normal (self-contained, no imports).
//
// 3x3 edge kernel (Sobel / Prewitt / Scharr) over the height texture's red channel.
// `wrap` = 1 samples across the border (seamless tiles); 0 clamps to the edge
// (atlases, non-tiling art). A neighbour whose alpha is below `alpha_threshold`
// is treated as off-island and replaced by the centre height, so relief never
// bleeds across transparent UV gutters.
//
// Encoded green follows `convention`: 0 = DirectX (green-down, what Minecraft
// Bedrock `_normal.png` expects), 1 = OpenGL (green-up). X is shared by both.
// Strength multiplies the gradients with z = 1, so higher = stronger relief.
// Transparent texels emit a flat normal (128, 128, 255) with opaque alpha.

struct NormalParams {
  strength: f32,
  operator_type: u32,   // 0 = sobel, 1 = prewitt, 2 = scharr
  wrap: u32,            // 0 = clamp, 1 = wrap
  convention: u32,      // 0 = directx, 1 = opengl
  alpha_threshold: f32, // 0..1; neighbours below this are off-island
}

@group(0) @binding(0) var heightTex: texture_2d<f32>;
@group(0) @binding(1) var normalTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: NormalParams;

fn wrap_or_clamp(coord: vec2i, dims: vec2i) -> vec2i {
  if (params.wrap == 1u) {
    return ((coord % dims) + dims) % dims;
  }
  return clamp(coord, vec2i(0), dims - vec2i(1));
}

/// Height at `coord`, or `centre` when that texel is off-island.
fn tap(coord: vec2i, dims: vec2i, centre: f32) -> f32 {
  let texel = textureLoad(heightTex, wrap_or_clamp(coord, dims), 0);
  return select(centre, texel.r, texel.a >= params.alpha_threshold);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2i(textureDimensions(heightTex, 0));
  if (i32(gid.x) >= dims.x || i32(gid.y) >= dims.y) { return; }

  let c = vec2i(gid.xy);
  let here = textureLoad(heightTex, c, 0);
  if (here.a < params.alpha_threshold) {
    textureStore(normalTex, c, vec4f(0.5, 0.5, 1.0, 1.0));
    return;
  }
  let centre = here.r;

  let s00 = tap(c + vec2i(-1, -1), dims, centre);
  let s01 = tap(c + vec2i( 0, -1), dims, centre);
  let s02 = tap(c + vec2i( 1, -1), dims, centre);
  let s10 = tap(c + vec2i(-1,  0), dims, centre);
  let s12 = tap(c + vec2i( 1,  0), dims, centre);
  let s20 = tap(c + vec2i(-1,  1), dims, centre);
  let s21 = tap(c + vec2i( 0,  1), dims, centre);
  let s22 = tap(c + vec2i( 1,  1), dims, centre);

  // (corner, edge) tap weights per operator.
  var corner = 1.0;
  var edge = 2.0;
  if (params.operator_type == 1u) { edge = 1.0; }
  if (params.operator_type == 2u) { corner = 3.0; edge = 10.0; }

  // dx > 0 when height rises to the right; dy > 0 when it rises upward (toward row 0).
  let dx = -corner * s00 + corner * s02 - edge * s10 + edge * s12 - corner * s20 + corner * s22;
  let dy =  corner * s00 + edge * s01 + corner * s02 - corner * s20 - edge * s21 - corner * s22;

  let nx = -dx * params.strength;
  let ny_gl = -dy * params.strength;
  let ny = select(-ny_gl, ny_gl, params.convention == 1u);
  let normal = normalize(vec3f(nx, ny, 1.0));
  textureStore(normalTex, c, vec4f(normal * 0.5 + 0.5, 1.0));
}
