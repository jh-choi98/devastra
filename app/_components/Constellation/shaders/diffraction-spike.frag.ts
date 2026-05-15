export const DIFFRACTION_SPIKE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    // Cross pattern: bright along the axes, fades with distance
    float horizontal = exp(-pow(d.y * 18.0, 2.0));
    float vertical   = exp(-pow(d.x * 18.0, 2.0));
    float falloff = max(0.0, 1.0 - length(d) * 1.8);
    float spike = (horizontal + vertical) * falloff;
    if (spike < 0.01) discard;
    gl_FragColor = vec4(vColor * vIntensity * spike * 0.9, spike);
  }
`
