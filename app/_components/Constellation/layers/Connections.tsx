'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { mstEdges } from '@/features/constellation/render/mst'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { resolveStarViewBoxPosition } from '@/app/_components/Constellation/star-positions'
import type { TerritoryType } from '@/features/territories/registry'
import type { ConstellationData } from '../types'

interface ConnectionsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function Connections({ data, viewport = 'desktop' }: ConnectionsProps) {
  const geom = useMemo(() => {
    const lit = data.landmarks.filter(l => l.firstUnlockedAt !== null && l.weight >= 5)

    const byCluster = new Map<TerritoryType, typeof lit>()
    for (const lm of lit) {
      const bucket = byCluster.get(lm.territory) ?? []
      bucket.push(lm)
      byCluster.set(lm.territory, bucket)
    }

    const segmentPairs: Array<[THREE.Vector3, THREE.Vector3]> = []
    for (const [territory, landmarks] of Array.from(byCluster)) {
      const vbPositions = landmarks.map(lm =>
        resolveStarViewBoxPosition(lm.tech_key, territory, viewport)
      )
      const edges = mstEdges(vbPositions)
      for (const edge of edges) {
        const a = viewBoxToWorld(edge.a)
        const b = viewBoxToWorld(edge.b)
        segmentPairs.push([
          new THREE.Vector3(a.x, a.y, a.z),
          new THREE.Vector3(b.x, b.y, b.z),
        ])
      }
    }

    const arr = new Float32Array(segmentPairs.length * 6)
    segmentPairs.forEach(([a, b], i) => {
      arr[i * 6 + 0] = a.x; arr[i * 6 + 1] = a.y; arr[i * 6 + 2] = a.z
      arr[i * 6 + 3] = b.x; arr[i * 6 + 4] = b.y; arr[i * 6 + 5] = b.z
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    return g
  }, [data.landmarks, viewport])

  return (
    <lineSegments geometry={geom} renderOrder={5}>
      <lineBasicMaterial color="#5a6c80" transparent opacity={0.22} />
    </lineSegments>
  )
}
