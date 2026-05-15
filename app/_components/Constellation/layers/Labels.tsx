'use client'
import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { anchorFor } from '@/features/constellation/render/anchors'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { resolveStarViewBoxPosition } from '../star-positions'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/features/territories/registry'

const CLUSTER_LABELS: Record<TerritoryType, string> = {
  frontend_land:      'Frontend',
  backend_fortress:   'Backend',
  data_pipeline_zone: 'Data',
  testing_lab:        'Testing',
  devops_harbor:      'DevOps',
  docs_library:       'Docs',
}

interface LabelsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
}

function techDisplayName(tech_key: string): string {
  return getPublicTech(tech_key)?.displayName ?? tech_key
}

export function Labels({ data, viewport = 'desktop' }: LabelsProps) {
  const persistent = useMemo(
    () => selectPersistentLabels({ landmarks: data.landmarks, territories: data.territories }),
    [data.landmarks, data.territories],
  )

  const persistentLandmarks = useMemo(
    () => data.landmarks.filter(
      l => persistent.persistent.has(l.tech_key) && l.firstUnlockedAt !== null && l.weight >= 5,
    ),
    [data.landmarks, persistent],
  )

  return (
    <group renderOrder={20}>
      {/* Cluster labels — always rendered, one per cluster (ADR-61) */}
      {Object.entries(CLUSTER_LABELS).map(([type, label]) => {
        const a = anchorFor(viewport, type as TerritoryType)
        const w = viewBoxToWorld({ x: a.x, y: a.y + a.spread + 18 })
        return (
          <Html
            key={type}
            position={[w.x, w.y, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <span className="text-[11px] tracking-normal text-sky-200/85 font-sans select-none whitespace-nowrap">
              {label}
            </span>
          </Html>
        )
      })}

      {/* Tech star labels — persistent set only (ADR-63). Others get hover tooltip. */}
      {persistentLandmarks.map(l => {
        const pos = resolveStarViewBoxPosition(l.tech_key, l.territory, viewport)
        const w = viewBoxToWorld({ x: pos.x, y: pos.y - 14 })
        return (
          <Html
            key={l.tech_key}
            position={[w.x, w.y, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <span className="text-[10px] text-slate-200/80 font-sans select-none whitespace-nowrap">
              {techDisplayName(l.tech_key)}
            </span>
          </Html>
        )
      })}
    </group>
  )
}
