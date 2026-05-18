export const AIRY_DISK_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  varying float vZ;
  varying float vReveal;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float inv = 1.0 - r;
    float mag = clamp((vIntensity - 0.54) / 1.08, 0.0, 1.0);
    float inv2 = inv * inv;
    float inv4 = inv2 * inv2;
    float inv8 = inv4 * inv4;
    float core = mix(inv8 * inv2, inv8, mag) * mix(0.88, 1.34, mag);
    float innerHalo = inv2 * mix(inv, 1.0, mag * 0.46) * mix(0.34, 0.66, mag);
    float outerHalo = sqrt(inv) * mix(0.08, 0.27, mag);
    float alpha = clamp(core + innerHalo + outerHalo, 0.0, 1.0);
    // Far stars (negative aZ) get a gentle cool-blue shift; near stars stay
    // true-color. Effect amplitude held to ±10% so it never reads as "blue
    // star" - just atmospheric distance.
    float coolShift = clamp(-vZ, 0.0, 0.5);
    vec3 cooled = mix(vColor, vec3(0.65, 0.80, 1.00), coolShift * 0.18);
    // Far stars also lose ~10% alpha; near stars get +10% boost.
    float zAlpha = 1.0 + vZ * 0.20;
    vec3 hotCore = mix(cooled, vec3(1.0), clamp(core, 0.0, 1.0) * mix(0.18, 0.36, mag));
    float energy = mix(0.86, 1.1, mag) + core * mix(0.75, 1.18, mag) + innerHalo * mix(0.1, 0.28, mag);
    gl_FragColor = vec4(hotCore * vIntensity * energy, alpha * zAlpha * vReveal);
  }
`
