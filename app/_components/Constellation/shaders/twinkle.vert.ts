export const TWINKLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uTwinkleAmplitude;
  uniform float uTwinkleEnabled;
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Twinkle: per-star sinusoid offset by aPhase
    float t = uTime * 0.6 + aPhase * 6.2831853;
    float twinkle = 1.0 + sin(t) * uTwinkleAmplitude * uTwinkleEnabled;

    // Point size scales by aSize; perspective-correct attenuation
    gl_PointSize = aSize * twinkle * 1.5;
    vColor = aColor;
    vIntensity = twinkle;
  }
`
