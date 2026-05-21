import { describe, expect, it } from 'vitest'
import { circlePathCommands, ogPixelScale, resolveOgTechLabelLayouts } from './ConstellationImage'
import type { OgLandmarkInput, OgTechLabelLayout, OgTerritoryInput } from './ConstellationImage'
import type { TerritoryType } from '@/features/territories/registry'

const TERRITORY_TYPES: TerritoryType[] = [
  'frontend_land',
  'backend_fortress',
  'data_pipeline_zone',
  'testing_lab',
  'devops_harbor',
  'docs_library',
]

const TERRITORIES: OgTerritoryInput[] = TERRITORY_TYPES.map((type) => ({
  type,
  stage: 2,
  growth30d: 0,
  totalWeight: 100,
}))

function litLandmark(tech_key: string, territory: TerritoryType, weight: number): OgLandmarkInput {
  return {
    tech_key,
    territory,
    weight,
    firstUnlockedAt: '2026-05-01T00:00:00.000Z',
  }
}

function rectsOverlap(
  a: OgTechLabelLayout['rect'],
  b: OgTechLabelLayout['rect'],
  padding: number,
): boolean {
  const ax = a.x - padding
  const ay = a.y - padding
  const aw = a.width + padding * 2
  const ah = a.height + padding * 2
  const bx = b.x - padding
  const by = b.y - padding
  const bw = b.width + padding * 2
  const bh = b.height + padding * 2
  const x = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx))
  const y = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by))
  return x * y > 0
}

function expectNoLabelOverlaps(layouts: OgTechLabelLayout[]): void {
  for (let i = 0; i < layouts.length; i += 1) {
    for (let j = i + 1; j < layouts.length; j += 1) {
      expect(
        rectsOverlap(layouts[i].rect, layouts[j].rect, 1),
        `${layouts[i].label} overlaps ${layouts[j].label}`,
      ).toBe(false)
    }
  }
}

describe('ConstellationImage ogPixelScale', () => {
  it('keeps standard social-card renders at 1x', () => {
    expect(ogPixelScale(1200, 630)).toBe(1)
  })

  it('detects high-resolution renders from dimensions', () => {
    expect(ogPixelScale(2400, 1260)).toBe(2)
  })
})

describe('ConstellationImage circlePathCommands', () => {
  it('packs multiple circle glyphs into one SVG path string', () => {
    const path = circlePathCommands([
      { x: 10, y: 20, r: 2 },
      { x: 30.25, y: 40.5, r: 1.25 },
    ])

    expect(path).toBe(
      'M 10 20 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 M 30.25 40.5 m -1.25 0 a 1.25 1.25 0 1 0 2.5 0 a 1.25 1.25 0 1 0 -2.5 0',
    )
  })

  it('omits non-positive radius glyphs', () => {
    expect(
      circlePathCommands([
        { x: 10, y: 20, r: 0 },
        { x: 30, y: 40, r: -1 },
      ]),
    ).toBe('')
  })
})

describe('ConstellationImage resolveOgTechLabelLayouts', () => {
  it('separates a crowded frontend label group in the high-resolution share render', () => {
    const layouts = resolveOgTechLabelLayouts({
      territories: TERRITORIES,
      landmarks: [
        litLandmark('javascript', 'frontend_land', 180),
        litLandmark('webpack', 'frontend_land', 170),
        litLandmark('astro', 'frontend_land', 160),
        litLandmark('typescript', 'frontend_land', 150),
        litLandmark('vite', 'frontend_land', 140),
        litLandmark('css', 'frontend_land', 130),
      ],
      width: 2400,
      height: 1260,
      pixelScale: 2,
    })

    expect(layouts.map((layout) => layout.tech_key)).toEqual([
      'javascript',
      'webpack',
      'astro',
      'typescript',
      'vite',
      'css',
    ])
    expectNoLabelOverlaps(layouts)
  })

  it('keeps standard and high-resolution share labels in the same composition', () => {
    const landmarks = [
      litLandmark('javascript', 'frontend_land', 180),
      litLandmark('webpack', 'frontend_land', 170),
      litLandmark('astro', 'frontend_land', 160),
      litLandmark('typescript', 'frontend_land', 150),
    ]
    const standard = resolveOgTechLabelLayouts({
      territories: TERRITORIES,
      landmarks,
      width: 1200,
      height: 630,
      pixelScale: 1,
    })
    const highResolution = resolveOgTechLabelLayouts({
      territories: TERRITORIES,
      landmarks,
      width: 2400,
      height: 1260,
      pixelScale: 2,
    })

    expect(highResolution.map((layout) => layout.position)).toEqual(
      standard.map((layout) => layout.position),
    )
  })
})
