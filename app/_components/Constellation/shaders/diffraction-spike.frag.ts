export const DIFFRACTION_SPIKE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  varying float vZ;
  varying float vReveal;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    // Cross pattern: bright along the axes, fades with distance.
    float ax = abs(d.x);
    float ay = abs(d.y);
    float horizontalSharp = smoothstep(0.048, 0.0, ay);
    float verticalSharp   = smoothstep(0.048, 0.0, ax);
    float horizontalSoft = smoothstep(0.145, 0.0, ay);
    float verticalSoft   = smoothstep(0.145, 0.0, ax);
    float falloff = max(0.0, 1.0 - length(d) * 1.95);
    falloff *= falloff;
    float spike = ((horizontalSharp + verticalSharp) * 0.76 + (horizontalSoft + verticalSoft) * 0.2) * falloff;
    if (spike < 0.008) discard;
    float mag = clamp((vIntensity - 0.54) / 1.08, 0.0, 1.0);
    // Far stars get spikes that are slightly dimmer + bluer; near get a small
    // boost. Range is bounded so the magnitude curve still dominates.
    float coolShift = clamp(-vZ, 0.0, 0.5);
    vec3 cooled = mix(vColor, vec3(0.65, 0.80, 1.00), coolShift * 0.18);
    float zAlpha = 1.0 + vZ * 0.20;
    vec3 hotCore = mix(cooled, vec3(1.0), clamp(spike, 0.0, 1.0) * mix(0.12, 0.3, mag));
    float alpha = spike * zAlpha * vReveal * mix(0.78, 1.06, mag);
    gl_FragColor = vec4(hotCore * vIntensity * spike * mix(0.88, 1.08, mag), alpha);
  }
`
