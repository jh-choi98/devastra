'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useConstellationState } from '../state'
import { anchorFor } from '@/features/constellation/render/anchors'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { CLUSTER_COLORS } from '../layers/ClusterAura'
import type { TerritoryType } from '@/features/territories/registry'
import type { Viewport } from '@/features/constellation/render/types'

export interface StageUpRippleProps {
  stagedUpClusters: TerritoryType[]
  viewport?: Viewport
}

const RIPPLE_DURATION = 1.5  // seconds

const RIPPLE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const RIPPLE_FRAG = /* glsl */ `
uniform float uAge;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float dist = length(vUv - vec2(0.5)) * 2.0;
  float bandWidth = 0.07 * (1.0 - uAge * 0.65);
  float inner = 0.82 - bandWidth * 0.5;
  float outer = 0.82 + bandWidth * 0.5;
  float ring = smoothstep(inner - 0.02, inner, dist) * smoothstep(outer + 0.02, outer, dist);
  gl_FragColor = vec4(uColor, ring * (1.0 - uAge) * 0.7);
}
`

const POOL_SIZE = 6

interface RippleSlot {
  active: boolean
  age: number
  meshRef: { current: THREE.Mesh | null }
  material: THREE.ShaderMaterial
}

export function StageUpRipple({ stagedUpClusters, viewport = 'desktop' }: StageUpRippleProps) {
  const { startCinematic, reducedMotion } = useConstellationState()
  const firedClusters = useRef(new Set<string>())
  const cinematicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pool = useRef<RippleSlot[]>(
    Array.from({ length: POOL_SIZE }, () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uAge: { value: 1 },
          uColor: { value: new THREE.Color('#3b82f6') },
        },
        vertexShader: RIPPLE_VERT,
        fragmentShader: RIPPLE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      return { active: false, age: 1, meshRef: { current: null }, material: mat }
    }),
  )

  useEffect(() => {
    const newlyStagedUp = stagedUpClusters.filter(t => !firedClusters.current.has(t))
    if (newlyStagedUp.length === 0) return

    newlyStagedUp.forEach(t => firedClusters.current.add(t))

    if (reducedMotion) {
      startCinematic('stage-up')
      cinematicTimerRef.current = setTimeout(() => startCinematic('idle'), 200)
      return
    }

    startCinematic('stage-up')

    // Stagger ripples 0.3s apart per cluster
    newlyStagedUp.forEach((type, i) => {
      setTimeout(() => {
        const slot = pool.current.find(s => !s.active)
        if (!slot) return
        const anchor = anchorFor(viewport, type)
        const world = viewBoxToWorld({ x: anchor.x, y: anchor.y })
        const radius = (anchor.spread / 1000) * 2
        slot.active = true
        slot.age = 0
        slot.material.uniforms.uAge.value = 0
        slot.material.uniforms.uColor.value.set(CLUSTER_COLORS[type])
        if (slot.meshRef.current) {
          slot.meshRef.current.position.set(world.x, world.y, 0)
          slot.meshRef.current.scale.setScalar(radius * 2)
          slot.meshRef.current.visible = true
        }
      }, i * 300)
    })

    const totalDur = (RIPPLE_DURATION + 0.2) * 1000 + (newlyStagedUp.length - 1) * 300
    if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current)
    cinematicTimerRef.current = setTimeout(() => startCinematic('idle'), totalDur)

    return () => {
      if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current)
    }
  }, [stagedUpClusters, startCinematic, reducedMotion, viewport])

  useFrame((_, dt) => {
    pool.current.forEach(slot => {
      if (!slot.active) return
      slot.age = Math.min(1, slot.age + dt / RIPPLE_DURATION)
      slot.material.uniforms.uAge.value = slot.age
      if (slot.age >= 1) {
        slot.active = false
        if (slot.meshRef.current) slot.meshRef.current.visible = false
      }
    })
  })

  return (
    <group renderOrder={12}>
      {pool.current.map((slot, i) => (
        <mesh
          key={i}
          ref={(m) => { slot.meshRef.current = m }}
          material={slot.material}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  )
}
