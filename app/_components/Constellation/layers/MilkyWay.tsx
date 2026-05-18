'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { MILKY_WAY_FRAG } from '../shaders/milky-way.frag'
import { useConstellationState } from '../state'

const MILKY_WAY_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

export function MilkyWay() {
  const { reducedMotion } = useConstellationState()
  const texture = useTexture('/textures/milky-way.webp')

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTexture: { value: texture },
      uWarpAmount: { value: 0.003 },       // very subtle UV noise warp
      uBreathePeriod: { value: 45.0 },     // 45 second cycle (within 30-60s spec)
      uBreatheAmplitude: { value: 0.05 },  // ±5%
      uMotionEnabled: { value: 1.0 },
      // Texture comes from a Pexels JPG — too bright at full strength.
      // 0.35 is the dimmest setting that still reads as "dust lane".
      uIntensity: { value: 0.35 },
    },
    vertexShader: MILKY_WAY_VERT,
    fragmentShader: MILKY_WAY_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [texture])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMotionEnabled.value = reducedMotion ? 0.0 : 1.0
  })

  return (
    <mesh material={material} renderOrder={-900}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
