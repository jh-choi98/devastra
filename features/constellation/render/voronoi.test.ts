import { describe, it, expect } from 'vitest'
import { voronoiCells } from './voronoi'

const VIEWPORTS = ['desktop', 'mobile', 'og'] as const

function polygonArea(polygon: Array<{ x: number; y: number }>): number {
  let area = 0
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

describe('voronoi', () => {
  it('cells partition the viewBox — sum of areas equals 700,000', () => {
    for (const vp of VIEWPORTS) {
      const cells = voronoiCells(vp)
      const totalArea = cells.reduce((sum, c) => sum + polygonArea(c.polygon), 0)
      expect(totalArea).toBeCloseTo(700_000, -1) // within ~10 sq units
    }
  })

  it('all 6 cluster types are present in each viewport', () => {
    const ALL_TYPES = [
      'frontend_land', 'backend_fortress', 'data_pipeline_zone',
      'testing_lab', 'devops_harbor', 'docs_library',
    ]
    for (const vp of VIEWPORTS) {
      const types = voronoiCells(vp).map((c) => c.type)
      expect(types.length).toBe(6)
      for (const t of ALL_TYPES) {
        expect(types).toContain(t)
      }
    }
  })

  it('is deterministic — same viewport always yields identical cells', () => {
    for (const vp of VIEWPORTS) {
      const a = voronoiCells(vp)
      const b = voronoiCells(vp)
      expect(a).toStrictEqual(b)
    }
  })
})
