export const TWINKLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uTwinkleAmplitude;
  uniform float uTwinkleEnabled;
  uniform float uSizeScale;
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    // Slow drift — barely perceptible position oscillation per star.
    // Period ~45–60s, amplitude ~0.0008 world units (~0.4px). Disabled when
    // reduced motion is active (uTwinkleEnabled doubles as motion gate).
    vec3 driftPos = position;
    float driftT = uTime * 0.018;
    driftPos.x += sin(driftT + aPhase * 6.2831853) * 0.0008 * uTwinkleEnabled;
    driftPos.y += cos(driftT * 0.83 + aPhase * 6.2831853) * 0.0006 * uTwinkleEnabled;

    vec4 mvPosition = modelViewMatrix * vec4(driftPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Twinkle: per-star sinusoid offset by aPhase
    float t = uTime * 0.6 + aPhase * 6.2831853;
    float twinkle = 1.0 + sin(t) * uTwinkleAmplitude * uTwinkleEnabled;

    // Point size scales by aSize; perspective-correct attenuation
    gl_PointSize = aSize * twinkle * 1.65 * uSizeScale;
    vColor = aColor;
    vIntensity = twinkle;
  }
`
