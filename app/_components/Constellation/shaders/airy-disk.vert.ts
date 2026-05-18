export const AIRY_DISK_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aIntensity;
  attribute float aZ;
  attribute float aReveal;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vZ;
  varying float vReveal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // aZ ∈ [-0.5, 0.5] — deterministic per-tech_key depth offset.
    // Modulates point size by ±12% — subtle depth without overriding the
    // weight-driven magnitude curve.
    float zScale = 1.0 + aZ * 0.24;
    float revealScale = 0.35 + smoothstep(0.0, 1.0, aReveal) * 0.65;
    gl_PointSize = aSize * 5.9 * zScale * revealScale;
    vColor = aColor;
    vIntensity = aIntensity;
    vZ = aZ;
    vReveal = smoothstep(0.0, 1.0, aReveal);
  }
`
