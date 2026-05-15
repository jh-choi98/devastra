export const AIRY_DISK_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aIntensity;
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // gl_PointSize is in fragment space — scale aSize from viewBox units
    gl_PointSize = aSize * 12.0;
    vColor = aColor;
    vIntensity = aIntensity;
  }
`
