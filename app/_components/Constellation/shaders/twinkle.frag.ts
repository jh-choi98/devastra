export const TWINKLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    // Soft circular point (no hard pixel edges)
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float alpha = pow(1.0 - r, 1.6);
    gl_FragColor = vec4(vColor * vIntensity, alpha);
  }
`
