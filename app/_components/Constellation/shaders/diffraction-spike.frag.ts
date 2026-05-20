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
    float mag = clamp((vIntensity - 0.38) / 1.55, 0.0, 1.0);
    float sharpWidth = mix(0.038, 0.054, mag);
    float softWidth = mix(0.118, 0.17, mag);
    float horizontalSharp = smoothstep(sharpWidth, 0.0, ay);
    float verticalSharp   = smoothstep(sharpWidth, 0.0, ax);
    float horizontalSoft = smoothstep(softWidth, 0.0, ay);
    float verticalSoft   = smoothstep(softWidth, 0.0, ax);
    float falloff = max(0.0, 1.0 - length(d) * 1.95);
    falloff *= falloff;
    float spike = ((horizontalSharp + verticalSharp) * 0.78 + (horizontalSoft + verticalSoft) * 0.22) * falloff * mix(0.82, 1.18, mag);
    if (spike < 0.006) discard;
    // Far stars get spikes that are slightly dimmer + bluer; near get a small
    // boost. Range is bounded so the magnitude curve still dominates.
    float coolShift = clamp(-vZ, 0.0, 0.5);
    vec3 cooled = mix(vColor, vec3(0.65, 0.80, 1.00), coolShift * 0.18);
    float zAlpha = 1.0 + vZ * 0.20;
    vec3 hotCore = mix(cooled, vec3(1.0), clamp(spike, 0.0, 1.0) * mix(0.12, 0.3, mag));
    float alpha = spike * zAlpha * vReveal * mix(0.72, 1.18, mag);
    gl_FragColor = vec4(hotCore * vIntensity * spike * mix(0.84, 1.16, mag), alpha);
  }
`
