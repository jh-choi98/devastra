'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { anchorFor } from '@/features/constellation/render/anchors'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { useConstellationState } from '../state'
import type { TerritoryType } from '@/features/territories/registry'

export const CLUSTER_COLORS: Record<TerritoryType, string> = {
  frontend_land:      '#3b82f6',
  backend_fortress:   '#06b6d4',
  data_pipeline_zone: '#10b981',
  testing_lab:        '#a855f7',
  devops_harbor:      '#f97316',
  docs_library:       '#eab308',
}

const AURA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const AURA_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float dist = length(vUv - vec2(0.5)) * 2.0;
  float alpha = max(0.0, 1.0 - dist);
  alpha = pow(alpha, 1.8);
  gl_FragColor = vec4(uColor, alpha * uOpacity);
}
`

interface ClusterAuraProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function ClusterAura({ viewport = 'desktop' }: ClusterAuraProps) {
  const { selected, hovered, cinematic } = useConstellationState()

  // Priority: cinematic/stage-up > drawer-selected. HOVER intentionally does
  // NOT activate the aura — user feedback was that a colored glow on every
  // pointer pass-over felt heavy and broke the atmosphere. Hover feedback is
  // expressed via the cluster label brightening instead (see Labels.tsx).
  void hovered
  const activeCluster: TerritoryType | null = useMemo(() => {
    if (cinematic === 'stage-up') return null // Phase 9 wires cinematicTarget
    if (selected) return selected
    return null
  }, [cinematic, selected])

  const opacityRef = useRef(0)
  const prevClusterRef = useRef<TerritoryType | null>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(CLUSTER_COLORS.frontend_land) },
      uOpacity: { value: 0 },
    },
    vertexShader: AURA_VERT,
    fragmentShader: AURA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  // Radius is single-scaled, not double — the previous double-scale produced
  // a 0.8–1.0 world-unit aura that filled ~half the screen and read as a game
  // UI effect.
  const radiusFor = (spread: number) => (spread / 1000) * 0.55

  const initAnchor = anchorFor(viewport, 'frontend_land')
  const initWorld = viewBoxToWorld({ x: initAnchor.x, y: initAnchor.y })
  const initRadius = radiusFor(initAnchor.spread)

  useFrame((_, dt) => {
    // Max opacity 0.20 (was 0.55). Aura should be felt, not seen.
    const target = activeCluster ? 0.20 : 0
    opacityRef.current += (target - opacityRef.current) * Math.min(1, dt * 5)

    if (activeCluster !== prevClusterRef.current) {
      prevClusterRef.current = activeCluster
      if (activeCluster && meshRef.current) {
        const anchor = anchorFor(viewport, activeCluster)
        const world = viewBoxToWorld({ x: anchor.x, y: anchor.y })
        const radius = radiusFor(anchor.spread)
        meshRef.current.position.set(world.x, world.y, 0)
        meshRef.current.scale.set(radius * 2, radius * 2, 1)
        material.uniforms.uColor.value.set(CLUSTER_COLORS[activeCluster])
      }
    }

    material.uniforms.uOpacity.value = opacityRef.current
  })

  return (
    <mesh
      ref={meshRef}
      material={material}
      position={[initWorld.x, initWorld.y, 0]}
      scale={[initRadius * 2, initRadius * 2, 1]}
      renderOrder={3}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
