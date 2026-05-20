import { describe, expect, it } from 'vitest'
import {
  labelsOverlap,
  resolveClusterLabelProtectionRects,
  resolveTechLabelLayouts,
} from './label-layout'
import { semanticScaleProfileForCanvas } from './semantic-scale-profile'
import type { ConstellationData } from './types'
import type { TerritoryType } from '@/features/territories/registry'

const TERRITORIES: TerritoryType[] = [
  'frontend_land',
  'backend_fortress',
  'data_pipeline_zone',
  'testing_lab',
  'devops_harbor',
  'docs_library',
]

function makeData(
  landmarks: Array<{ tech_key: string; territory: TerritoryType; weight?: number }>,
): ConstellationData {
  return {
    userId: 'test-user',
    territories: TERRITORIES.map((type) => ({
      type,
      stage: 1,
      totalWeight: 100,
      growth30d: 0,
      stageChangedAt: null,
    })),
    landmarks: landmarks.map((landmark, index) => ({
      tech_key: landmark.tech_key,
      territory: landmark.territory,
      weight: landmark.weight ?? 80 - index,
      firstUnlockedAt: '2026-05-01T00:00:00.000Z',
    })),
  }
}

function expectNoOverlaps(layouts: ReturnType<typeof resolveTechLabelLayouts>) {
  for (let i = 0; i < layouts.length; i += 1) {
    for (let j = i + 1; j < layouts.length; j += 1) {
      expect(
        labelsOverlap(layouts[i].rect, layouts[j].rect, 1),
        `${layouts[i].label} overlaps ${layouts[j].label}`,
      ).toBe(false)
    }
  }
}

function expectClearOfClusterLabels(
  layouts: ReturnType<typeof resolveTechLabelLayouts>,
  viewport: 'desktop' | 'mobile',
  canvasSize: { width: number; height: number },
) {
  const clusterRects = resolveClusterLabelProtectionRects(viewport, canvasSize)

  for (const layout of layouts) {
    for (const rect of clusterRects) {
      expect(
        labelsOverlap(layout.rect, rect, 1),
        `${layout.label} overlaps a cluster label`,
      ).toBe(false)
    }
  }
}

describe('resolveTechLabelLayouts', () => {
  it('separates a known crowded data/devops label group', () => {
    const data = makeData([
      { tech_key: 'ghactions', territory: 'devops_harbor', weight: 120 },
      { tech_key: 'mongodb', territory: 'data_pipeline_zone', weight: 110 },
      { tech_key: 'drizzle', territory: 'data_pipeline_zone', weight: 100 },
    ])

    const layouts = resolveTechLabelLayouts({
      data,
      viewport: 'desktop',
      semanticProfile: semanticScaleProfileForCanvas(1440, 900, 'desktop'),
    })

    expect(layouts.map((layout) => layout.label)).toEqual([
      'GitHub Actions',
      'MongoDB',
      'Drizzle',
    ])
    expectNoOverlaps(layouts)
    expectClearOfClusterLabels(layouts, 'desktop', { width: 1440, height: 900 })
  })

  it('keeps dense mobile labels deterministic and non-overlapping', () => {
    const data = makeData([
      { tech_key: 'typescript', territory: 'frontend_land' },
      { tech_key: 'react', territory: 'frontend_land' },
      { tech_key: 'nextjs', territory: 'frontend_land' },
      { tech_key: 'tailwind', territory: 'frontend_land' },
      { tech_key: 'css', territory: 'frontend_land' },
      { tech_key: 'javascript', territory: 'frontend_land' },
      { tech_key: 'mongodb', territory: 'data_pipeline_zone' },
      { tech_key: 'drizzle', territory: 'data_pipeline_zone' },
      { tech_key: 'ghactions', territory: 'devops_harbor' },
    ])
    const semanticProfile = semanticScaleProfileForCanvas(390, 844, 'mobile')

    const first = resolveTechLabelLayouts({ data, viewport: 'mobile', semanticProfile })
    const second = resolveTechLabelLayouts({ data, viewport: 'mobile', semanticProfile })

    expect(second.map((layout) => layout.position)).toEqual(first.map((layout) => layout.position))
    expectNoOverlaps(first)
    expectClearOfClusterLabels(first, 'mobile', { width: 390, height: 844 })
  })
})
