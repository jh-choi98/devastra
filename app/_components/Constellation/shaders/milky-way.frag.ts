export const MILKY_WAY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uTexture;
  uniform float uWarpAmount;
  uniform float uBreathePeriod;
  uniform float uBreatheAmplitude;
  uniform float uMotionEnabled;
  varying vec2 vUv;

  // Simple 2D hash + noise (cheap; for a higher-quality noise use a simplex implementation)
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // Very subtle UV warp animated over time
    vec2 warpUv = vUv;
    warpUv.x += (noise(vUv * 3.0 + uTime * 0.02) - 0.5) * uWarpAmount * uMotionEnabled;
    warpUv.y += (noise(vUv * 3.0 - uTime * 0.02) - 0.5) * uWarpAmount * uMotionEnabled;

    vec4 tex = texture2D(uTexture, warpUv);

    // Opacity breathing — slow ±uBreatheAmplitude swing over uBreathePeriod seconds
    float breathe = 1.0 + sin(uTime * 6.2831853 / uBreathePeriod) * uBreatheAmplitude * uMotionEnabled;

    // Slight film grain
    float grain = (hash(vUv * 1000.0 + uTime * 0.1) - 0.5) * 0.04;

    // Subtle vignette
    vec2 centered = (vUv - 0.5) * 2.0;
    float vignette = 1.0 - dot(centered, centered) * 0.18;

    vec3 col = tex.rgb * breathe * vignette + vec3(grain);
    float alpha = tex.a;
    gl_FragColor = vec4(col, alpha);
  }
`
