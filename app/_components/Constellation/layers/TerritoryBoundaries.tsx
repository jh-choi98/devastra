'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { viewBoxToWorld } from '@/features/constellation/render/coords'

interface TerritoryBoundariesProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function TerritoryBoundaries({ viewport = 'desktop' }: TerritoryBoundariesProps) {
  const lines = useMemo(() => {
    const cells = voronoiCells(viewport)
    const segments: THREE.BufferGeometry[] = []
    cells.forEach(cell => {
      const verts = cell.polygon.map(p => viewBoxToWorld(p))
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i]
        const b = verts[(i + 1) % verts.length]
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.Float32BufferAttribute([
          a.x, a.y, a.z,
          b.x, b.y, b.z,
        ], 3))
        segments.push(geom)
      }
    })
    return segments
  }, [viewport])

  return (
    // Depth: sits BEHIND tech stars / connections (renderOrder 2) but in front
    // of background (FieldStars / Haze / SkyBackground). Combined with the
    // boundary's low opacity this places it firmly in the "map layer" depth
    // tier without competing with the lit constellation.
    <group renderOrder={2}>
      {lines.map((g, i) => (
        <lineSegments key={i} geometry={g}>
          <lineBasicMaterial color="#2a3a4d" transparent opacity={0.05} />
        </lineSegments>
      ))}
    </group>
  )
}
