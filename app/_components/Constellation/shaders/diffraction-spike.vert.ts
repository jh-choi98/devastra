export const DIFFRACTION_SPIKE_VERT = /* glsl */ `
  attribute float aSpikeLength;
  attribute vec3 aColor;
  attribute float aIntensity;
  attribute float aZ;
  attribute float aReveal;
  uniform float uPointScale;
  uniform float uIntensityScale;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vZ;
  varying float vReveal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Spikes share the same depth modulation as cores (±12%).
    float zScale = 1.0 + aZ * 0.24;
    float revealScale = 0.35 + smoothstep(0.0, 1.0, aReveal) * 0.65;
    gl_PointSize = aSpikeLength * 7.8 * zScale * revealScale * uPointScale;
    vColor = aColor;
    vIntensity = aIntensity * uIntensityScale;
    vZ = aZ;
    vReveal = smoothstep(0.0, 1.0, aReveal);
  }
`
