// mer-map.wgsl — packed MER (R = metalness, G = emissive, B = roughness) inferred
// from the albedo, the shaped height and the derived normal (self-contained).
//
// Metalness: HSV heuristic. Bright, desaturated texels (steel, iron, silver) and
//   two hue bands (gold, copper) with enough saturation and value. Binary output;
//   per-colour palette overrides and uniform values are applied on the CPU.
// Emissive: bright AND saturated texels glow (lava, glowstone, neon). An optional
//   over-bright fallback flags luminance above `emissive_overbright` regardless of
//   saturation (set >= 1 to disable). `emissive_softness` blends toward the 3x3
//   mean so the glow outline is anti-aliased instead of stair-stepped.
// Roughness: weighted composite of 5x5 luminance variance (grain), albedo Sobel
//   edge magnitude (detail), inverse saturation (pure hues read glossier), a
//   curvature term from the normal map's divergence (crevices collect dirt and
//   roughen, convex ridges wear smooth) and an optional height influence
//   (positive = recesses rougher). Then scale + bias, clamped.
//
// Sampling follows normal-map.wgsl: `wrap` selects periodic edges, and any
// neighbour whose alpha (heightTex.a) is below `alpha_threshold` is off-island
// and replaced by the centre value. Off-island texels emit (0, 0, 1): no metal,
// no glow, fully rough. Alpha is always 1.

struct MerParams {
  metal_brightness: f32,
  metal_saturation: f32,
  gold_min: f32,
  gold_max: f32,
  copper_min: f32,
  copper_max: f32,
  rough_variance: f32,
  rough_edge: f32,
  rough_saturation: f32,
  rough_curvature: f32,
  rough_height: f32,
  rough_scale: f32,
  rough_bias: f32,
  emissive_brightness: f32,
  emissive_saturation: f32,
  emissive_overbright: f32,
  emissive_softness: f32,
  wrap: u32,             // 0 = clamp, 1 = wrap
  convention: u32,       // 0 = directx, 1 = opengl (sign of the normal's Y for curvature)
  alpha_threshold: f32,  // 0..1; neighbours below this are off-island
  metal_clean: u32,      // 1 = 3x3 majority vote on the metal mask (removes speckle)
}

@group(0) @binding(0) var albedoTex: texture_2d<f32>;
@group(0) @binding(1) var heightTex: texture_2d<f32>;   // r = height, a = island mask
@group(0) @binding(2) var normalTex: texture_2d<f32>;
@group(0) @binding(3) var merTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<uniform> params: MerParams;

fn luminance_bt601(rgb: vec3f) -> f32 {
  return dot(rgb, vec3f(0.299, 0.587, 0.114));
}

fn rgb_to_hsv(rgb: vec3f) -> vec3f {
  let c_max = max(rgb.r, max(rgb.g, rgb.b));
  let c_min = min(rgb.r, min(rgb.g, rgb.b));
  let delta = c_max - c_min;
  var h: f32 = 0.0;
  if (delta > 0.00001) {
    if (c_max == rgb.r) {
      h = ((rgb.g - rgb.b) / delta) % 6.0;
    } else if (c_max == rgb.g) {
      h = (rgb.b - rgb.r) / delta + 2.0;
    } else {
      h = (rgb.r - rgb.g) / delta + 4.0;
    }
    h = h / 6.0;
    if (h < 0.0) { h += 1.0; }
  }
  let s = select(0.0, delta / c_max, c_max > 0.0);
  return vec3f(h, s, c_max);
}

fn wrap_or_clamp(coord: vec2i, dims: vec2i) -> vec2i {
  if (params.wrap == 1u) {
    return ((coord % dims) + dims) % dims;
  }
  return clamp(coord, vec2i(0), dims - vec2i(1));
}

fn on_island(coord: vec2i, dims: vec2i) -> bool {
  return textureLoad(heightTex, wrap_or_clamp(coord, dims), 0).a >= params.alpha_threshold;
}

/// Albedo luminance at `coord`, or `centre` when off-island.
fn luma_tap(coord: vec2i, dims: vec2i, centre: f32) -> f32 {
  let c = wrap_or_clamp(coord, dims);
  let l = luminance_bt601(textureLoad(albedoTex, c, 0).rgb);
  return select(centre, l, on_island(coord, dims));
}

/// Decoded normal XY at `coord`, or `centre` when off-island.
fn normal_tap(coord: vec2i, dims: vec2i, centre: vec2f) -> vec2f {
  let c = wrap_or_clamp(coord, dims);
  let n = textureLoad(normalTex, c, 0).xy * 2.0 - 1.0;
  return select(centre, n, on_island(coord, dims));
}

/// Binary metal classification for one texel: bright desaturated, gold or copper.
fn metal_at(coord: vec2i, dims: vec2i) -> f32 {
  let c = wrap_or_clamp(coord, dims);
  let hsv = rgb_to_hsv(textureLoad(albedoTex, c, 0).rgb);
  let achromatic = smoothstep(params.metal_brightness - 0.1, params.metal_brightness, hsv.z)
                 * (1.0 - smoothstep(params.metal_saturation - 0.05, params.metal_saturation, hsv.y));
  let gold = smoothstep(params.gold_min - 0.01, params.gold_min, hsv.x)
           * (1.0 - smoothstep(params.gold_max, params.gold_max + 0.01, hsv.x))
           * step(0.3, hsv.y) * step(0.5, hsv.z);
  let copper = smoothstep(params.copper_min - 0.01, params.copper_min, hsv.x)
             * (1.0 - smoothstep(params.copper_max, params.copper_max + 0.01, hsv.x))
             * step(0.3, hsv.y) * step(0.4, hsv.z);
  return step(0.5, max(achromatic, max(gold, copper)));
}

/// Raw emissive response for one texel (no softness).
fn emissive_at(coord: vec2i, dims: vec2i) -> f32 {
  let c = wrap_or_clamp(coord, dims);
  let rgb = textureLoad(albedoTex, c, 0).rgb;
  let hsv = rgb_to_hsv(rgb);
  let bright_saturated = smoothstep(params.emissive_brightness - 0.05, params.emissive_brightness, hsv.z)
                       * smoothstep(params.emissive_saturation - 0.05, params.emissive_saturation, hsv.y);
  let over = params.emissive_overbright;
  let exceeds = select(0.0, smoothstep(over - 0.05, over, luminance_bt601(rgb)), over < 1.0);
  return max(bright_saturated, exceeds);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2i(textureDimensions(albedoTex, 0));
  if (i32(gid.x) >= dims.x || i32(gid.y) >= dims.y) { return; }

  let c = vec2i(gid.xy);
  if (!on_island(c, dims)) {
    textureStore(merTex, c, vec4f(0.0, 0.0, 1.0, 1.0));
    return;
  }

  let rgb = textureLoad(albedoTex, c, 0).rgb;
  let hsv = rgb_to_hsv(rgb);
  let centre_luma = luminance_bt601(rgb);

  // --- Metalness -----------------------------------------------------------
  // Optional 3x3 majority vote: a lone metal texel in a dielectric field (or a
  // lone hole in a metal one) is speckle from the threshold, not material.
  var metal = metal_at(c, dims);
  if (params.metal_clean == 1u) {
    var votes = 0.0;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let n = c + vec2i(dx, dy);
        votes += select(metal, metal_at(n, dims), on_island(n, dims));
      }
    }
    metal = step(5.0, votes);
  }

  // --- Emissive ------------------------------------------------------------
  var emissive = emissive_at(c, dims);
  if (params.emissive_softness > 0.0) {
    var sum = 0.0;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let n = c + vec2i(dx, dy);
        sum += select(emissive, emissive_at(n, dims), on_island(n, dims));
      }
    }
    emissive = mix(emissive, sum / 9.0, clamp(params.emissive_softness, 0.0, 1.0));
  }

  // --- Roughness -----------------------------------------------------------
  // 5x5 luminance variance: grain.
  var sum = 0.0;
  var sum_sq = 0.0;
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let l = luma_tap(c + vec2i(dx, dy), dims, centre_luma);
      sum += l;
      sum_sq += l * l;
    }
  }
  let mean = sum / 25.0;
  let variance = max(sum_sq / 25.0 - mean * mean, 0.0);
  let variance_term = clamp(variance * 10.0, 0.0, 1.0);

  // Albedo Sobel edge magnitude: detail.
  let s00 = luma_tap(c + vec2i(-1, -1), dims, centre_luma);
  let s01 = luma_tap(c + vec2i( 0, -1), dims, centre_luma);
  let s02 = luma_tap(c + vec2i( 1, -1), dims, centre_luma);
  let s10 = luma_tap(c + vec2i(-1,  0), dims, centre_luma);
  let s12 = luma_tap(c + vec2i( 1,  0), dims, centre_luma);
  let s20 = luma_tap(c + vec2i(-1,  1), dims, centre_luma);
  let s21 = luma_tap(c + vec2i( 0,  1), dims, centre_luma);
  let s22 = luma_tap(c + vec2i( 1,  1), dims, centre_luma);
  let gx = -s00 + s02 - 2.0 * s10 + 2.0 * s12 - s20 + s22;
  let gy =  s00 + 2.0 * s01 + s02 - s20 - 2.0 * s21 - s22;
  let edge_term = clamp(sqrt(gx * gx + gy * gy) * 2.0, 0.0, 1.0);

  // Inverse saturation: pure hues read glossier.
  let saturation_term = 1.0 - hsv.y * 0.5;

  // Curvature from the normal's divergence. Convex (ridge) is positive with
  // DirectX green; OpenGL flips the Y term. Crevices (negative) roughen.
  let n_c = textureLoad(normalTex, c, 0).xy * 2.0 - 1.0;
  let ysign = select(1.0, -1.0, params.convention == 1u);
  let ddx = normal_tap(c + vec2i(1, 0), dims, n_c).x - normal_tap(c + vec2i(-1, 0), dims, n_c).x;
  let ddy = normal_tap(c + vec2i(0, 1), dims, n_c).y - normal_tap(c + vec2i(0, -1), dims, n_c).y;
  let divergence = 0.5 * (ddx + ysign * ddy);
  let curvature_term = clamp(-divergence * 2.0, -1.0, 1.0);

  var roughness = variance_term * params.rough_variance
                + edge_term * params.rough_edge
                + saturation_term * params.rough_saturation
                + curvature_term * params.rough_curvature;
  roughness = clamp(roughness * params.rough_scale + params.rough_bias, 0.0, 1.0);

  // Height influence: positive pulls recesses rough and peaks glossy.
  let influence = params.rough_height;
  if (influence != 0.0) {
    let h = textureLoad(heightTex, c, 0).r;
    let field = select(h, 1.0 - h, influence >= 0.0);
    roughness = mix(roughness, field, abs(influence));
  }

  textureStore(merTex, c, vec4f(metal, clamp(emissive, 0.0, 1.0), roughness, 1.0));
}
