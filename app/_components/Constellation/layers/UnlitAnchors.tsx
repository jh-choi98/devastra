'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { getAllPublicTech } from '@/features/territories/tech-catalog-public'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { resolveStarViewBoxPosition } from '@/app/_components/Constellation/star-positions'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/features/territories/registry'

interface UnlitAnchorsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
  opacity?: number
}

const UNLIT_VERT = /* glsl */ `
  attribute float aSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize;
  }
`

const UNLIT_FRAG = /* glsl */ `
  uniform float uOpacity;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float alpha = pow(1.0 - r, 1.4) * 0.10 * uOpacity; // 10% peak alpha before sparse boost
    gl_FragColor = vec4(vec3(0.78, 0.84, 0.94), alpha);
  }
`

/**
 * Faint, label-less dots at every catalog tech_key position that is NOT yet lit.
 * Gives empty / sparse clusters the visual weight of a "real constellation"
 * without claiming the user has activated anything.
 *
 * Opacity is hard-capped at 10% inside the shader so these never compete with
 * lit tech stars or labels.
 */
export function UnlitAnchors({ data, viewport = 'desktop', opacity = 1 }: UnlitAnchorsProps) {
  const positions = useMemo(() => {
    const litSet = new Set(
      data.landmarks
        .filter((l) => l.firstUnlockedAt !== null && l.weight >= 5)
        .map((l) => l.tech_key),
    )
    const catalog = getAllPublicTech()
    const result: { x: number; y: number; z: number }[] = []
    for (const entry of catalog) {
      if (litSet.has(entry.tech_key)) continue
      const vb = resolveStarViewBoxPosition(
        entry.tech_key,
        entry.territory as TerritoryType,
        viewport,
      )
      const w = viewBoxToWorld(vb)
      result.push(w)
    }
    return result
  }, [data.landmarks, viewport])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(positions.length * 3)
    const sizes = new Float32Array(positions.length)
    positions.forEach((p, i) => {
      arr[i * 3 + 0] = p.x
      arr[i * 3 + 1] = p.y
      arr[i * 3 + 2] = p.z
      sizes[i] = 3.0 // small dot
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    return g
  }, [positions])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uOpacity: { value: opacity },
        },
        vertexShader: UNLIT_VERT,
        fragmentShader: UNLIT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [opacity],
  )

  if (positions.length === 0) return null
  return <points args={[geom, material]} renderOrder={4} />
}
