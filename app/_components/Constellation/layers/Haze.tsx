'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useConstellationState } from '../state'

/**
 * Very faint blue-gray atmospheric haze. Sits between the SkyBackground and
 * the FieldStars in render order, providing the "there is volume between me
 * and the stars" cue without ever competing with the constellation content.
 *
 * Intensity is capped at ~5% peak alpha in the shader — anything more and it
 * reads as a colored wash (which is what the user explicitly rejected for the
 * Milky Way layer).
 */
const HAZE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const HAZE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uMotionEnabled;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    // Soft radial mask — densest near center, fades to nothing at edges.
    float radial = 1.0 - clamp(length(centered) * 0.85, 0.0, 1.0);
    radial = pow(radial, 1.6);

    // Two-octave low-frequency noise to give the haze a non-uniform feel.
    float n1 = noise(vUv * 2.0 + uTime * 0.005 * uMotionEnabled);
    float n2 = noise(vUv * 5.0 - uTime * 0.003 * uMotionEnabled);
    float cloud = mix(n1, n2, 0.4);
    cloud = mix(0.6, 1.0, cloud);

    // Cool blue-gray tint, never warm. Stays in the same family as the
    // boundary color so it reads as "deep atmosphere" not "nebula".
    vec3 hazeColor = vec3(0.32, 0.40, 0.55);
    float alpha = radial * cloud * 0.05; // 5% cap
    gl_FragColor = vec4(hazeColor * alpha, alpha);
  }
`

export function Haze() {
  const { reducedMotion } = useConstellationState()
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotionEnabled: { value: 1.0 },
    },
    vertexShader: HAZE_VERT,
    fragmentShader: HAZE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMotionEnabled.value = reducedMotion ? 0.0 : 1.0
  })

  return (
    <mesh material={material} renderOrder={-950}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
