export const TWINKLE_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    // Soft circular point (no hard pixel edges)
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float inv = 1.0 - r;
    float core = pow(inv, 5.0) * 0.28;
    float halo = pow(inv, 1.45);
    float alpha = clamp(core + halo * 0.92, 0.0, 1.0);
    // Field stars are background — keep them 10% dimmer than the tech stars
    // so the lit constellation reads as the foreground.
    gl_FragColor = vec4(vColor * vIntensity * (0.9 + core), alpha * 0.88 * uOpacity);
  }
`
