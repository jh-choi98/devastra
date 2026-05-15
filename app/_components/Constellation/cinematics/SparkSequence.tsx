'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useConstellationState } from '../state'
import { resolveStarViewBoxPosition } from '../star-positions'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { spectralColorFor, spectralHex } from '@/features/constellation/render/palette'
import type { NewlyLitLandmark } from '../hooks/useDataDiff'
import type { Viewport } from '@/features/constellation/render/types'

interface SparkSequenceProps {
  newlyLitLandmarks: NewlyLitLandmark[]
  viewport?: Viewport
}

// Pre-allocated pool — avoids React state changes during per-frame animation.
const POOL_SIZE = 8
const DURATION = 0.6  // seconds

const SPARK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SPARK_FRAG = /* glsl */ `
uniform float uAge;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float dist = length(c) * 2.0;
  float ringCenter = 0.35 + uAge * 0.55;
  float ringWidth = 0.14 * (1.0 - uAge * 0.75);
  float inner = ringCenter - ringWidth;
  float outer = ringCenter + ringWidth;
  float inRing = smoothstep(inner - 0.03, inner, dist) * smoothstep(outer + 0.03, outer, dist);
  float core = max(0.0, smoothstep(0.25, 0.0, dist) * (1.0 - uAge * 3.0));
  gl_FragColor = vec4(uColor, (inRing * 0.85 + core * 0.6) * (1.0 - uAge));
}
`

interface SlotData {
  active: boolean
  age: number
  meshRef: { current: THREE.Mesh | null }
  material: THREE.ShaderMaterial
}

export function SparkSequence({ newlyLitLandmarks, viewport = 'desktop' }: SparkSequenceProps) {
  const { reducedMotion } = useConstellationState()
  const firedKeys = useRef(new Set<string>())

  const pool = useRef<SlotData[]>(
    Array.from({ length: POOL_SIZE }, () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uAge: { value: 1 },
          uColor: { value: new THREE.Color('#f0f4ff') },
        },
        vertexShader: SPARK_VERT,
        fragmentShader: SPARK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      return { active: false, age: 1, meshRef: { current: null }, material: mat }
    }),
  )

  useEffect(() => {
    if (reducedMotion || newlyLitLandmarks.length === 0) return
    newlyLitLandmarks.forEach(l => {
      if (firedKeys.current.has(l.tech_key)) return
      firedKeys.current.add(l.tech_key)
      const slot = pool.current.find(s => !s.active)
      if (!slot) return
      const vb = resolveStarViewBoxPosition(l.tech_key, l.territory, viewport)
      const wp = viewBoxToWorld(vb)
      slot.active = true
      slot.age = 0
      slot.material.uniforms.uAge.value = 0
      slot.material.uniforms.uColor.value.set(spectralHex(spectralColorFor(l.tech_key)))
      if (slot.meshRef.current) {
        slot.meshRef.current.position.set(wp.x, wp.y, 0)
        slot.meshRef.current.visible = true
      }
    })
  }, [newlyLitLandmarks, reducedMotion, viewport])

  useFrame((_, dt) => {
    pool.current.forEach(slot => {
      if (!slot.active) return
      slot.age = Math.min(1, slot.age + dt / DURATION)
      slot.material.uniforms.uAge.value = slot.age
      if (slot.age >= 1) {
        slot.active = false
        if (slot.meshRef.current) slot.meshRef.current.visible = false
      }
    })
  })

  return (
    <group renderOrder={15}>
      {pool.current.map((slot, i) => (
        <mesh
          key={i}
          ref={(m) => { slot.meshRef.current = m }}
          material={slot.material}
          visible={false}
          scale={[0.14, 0.14, 1]}
        >
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  )
}
