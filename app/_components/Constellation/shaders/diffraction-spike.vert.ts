export const DIFFRACTION_SPIKE_VERT = /* glsl */ `
  attribute float aSpikeLength;
  attribute vec3 aColor;
  attribute float aIntensity;
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSpikeLength * 12.0;
    vColor = aColor;
    vIntensity = aIntensity;
  }
`
