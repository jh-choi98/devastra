export const AIRY_DISK_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    // Soft circular core with a slight central concentration
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    // Two-layer falloff: bright core (~0..0.3) + soft halo (0.3..1.0)
    float core = pow(1.0 - r, 6.0) * 1.0;
    float halo = pow(1.0 - r, 1.6) * 0.45;
    float alpha = clamp(core + halo, 0.0, 1.0);
    gl_FragColor = vec4(vColor * vIntensity * (1.0 + core * 0.6), alpha);
  }
`
