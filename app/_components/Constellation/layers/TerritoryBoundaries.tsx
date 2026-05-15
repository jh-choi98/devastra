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
    <group renderOrder={-100}>
      {lines.map((g, i) => (
        <lineSegments key={i} geometry={g}>
          <lineBasicMaterial color="#4a5566" transparent opacity={0.1} />
        </lineSegments>
      ))}
    </group>
  )
}
