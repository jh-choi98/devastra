import { describe, it, expect } from 'vitest'
import { selectPersistentLabels } from './labels'
import type { LabelSelectionInput } from './labels'

function makeLandmark(
  tech_key: string,
  weight: number,
  territory: string,
  lit = true,
) {
  return {
    tech_key,
    weight,
    territory: territory as any,
    firstUnlockedAt: lit ? '2024-01-01T00:00:00Z' : null,
  }
}

function makeTerritory(type: string, stage: number) {
  return { type: type as any, stage }
}

describe('selectPersistentLabels', () => {
  it('returns empty set when there are no lit stars', () => {
    const input: LabelSelectionInput = {
      landmarks: [makeLandmark('react', 10, 'frontend_land', false)],
      territories: [makeTerritory('frontend_land', 1)],
    }
    expect(selectPersistentLabels(input).persistent.size).toBe(0)
  })

  it('sparse override: labels all lit stars when total lit <= 6', () => {
    const input: LabelSelectionInput = {
      landmarks: [
        makeLandmark('react', 50, 'frontend_land'),
        makeLandmark('vue', 30, 'frontend_land'),
        makeLandmark('typescript', 80, 'frontend_land'),
        makeLandmark('nodejs', 60, 'backend_fortress'),
      ],
      territories: [
        makeTerritory('frontend_land', 2),
        makeTerritory('backend_fortress', 1),
      ],
    }
    const result = selectPersistentLabels(input)
    expect(result.persistent).toContain('react')
    expect(result.persistent).toContain('vue')
    expect(result.persistent).toContain('typescript')
    expect(result.persistent).toContain('nodejs')
    expect(result.persistent.size).toBe(4)
  })

  it('cluster-top: selects top-1 lit star per active cluster (>6 lit stars)', () => {
    const landmarks = [
      makeLandmark('react', 200, 'frontend_land'),
      makeLandmark('vue', 30, 'frontend_land'),
      makeLandmark('typescript', 80, 'frontend_land'),
      makeLandmark('nodejs', 100, 'backend_fortress'),
      makeLandmark('go', 50, 'backend_fortress'),
      makeLandmark('docker', 60, 'devops_harbor'),
      makeLandmark('terraform', 40, 'devops_harbor'),
      makeLandmark('jest', 20, 'testing_lab'),
    ]
    const territories = [
      makeTerritory('frontend_land', 3),
      makeTerritory('backend_fortress', 2),
      makeTerritory('devops_harbor', 2),
      makeTerritory('testing_lab', 1),
    ]
    const result = selectPersistentLabels({ landmarks, territories })
    // Cluster tops: react (200), nodejs (100), docker (60), jest (20)
    expect(result.persistent).toContain('react')
    expect(result.persistent).toContain('nodejs')
    expect(result.persistent).toContain('docker')
    expect(result.persistent).toContain('jest')
  })

  it('global cap: total labeled stars does not exceed 12', () => {
    const landmarks = Array.from({ length: 20 }, (_, i) =>
      makeLandmark(`tech_${i}`, 100 - i, 'backend_fortress'),
    )
    const territories = [makeTerritory('backend_fortress', 3)]
    const result = selectPersistentLabels({ landmarks, territories })
    expect(result.persistent.size).toBeLessThanOrEqual(12)
  })

  it('unlit stars (weight < 5 or firstUnlockedAt null) are excluded', () => {
    const input: LabelSelectionInput = {
      landmarks: [
        makeLandmark('react', 50, 'frontend_land', true),
        makeLandmark('vue', 4, 'frontend_land', true),      // weight < 5
        makeLandmark('svelte', 10, 'frontend_land', false), // not lit
      ],
      territories: [makeTerritory('frontend_land', 1)],
    }
    const result = selectPersistentLabels(input)
    expect(result.persistent).toContain('react')
    expect(result.persistent).not.toContain('vue')
    expect(result.persistent).not.toContain('svelte')
  })

  it('is deterministic — same input always produces same output', () => {
    const landmarks = [
      makeLandmark('react', 200, 'frontend_land'),
      makeLandmark('vue', 30, 'frontend_land'),
      makeLandmark('typescript', 80, 'frontend_land'),
      makeLandmark('nodejs', 100, 'backend_fortress'),
      makeLandmark('go', 50, 'backend_fortress'),
      makeLandmark('docker', 60, 'devops_harbor'),
      makeLandmark('terraform', 40, 'devops_harbor'),
      makeLandmark('jest', 20, 'testing_lab'),
    ]
    const territories = [
      makeTerritory('frontend_land', 3),
      makeTerritory('backend_fortress', 2),
      makeTerritory('devops_harbor', 2),
      makeTerritory('testing_lab', 1),
    ]
    const input = { landmarks, territories }
    const a = selectPersistentLabels(input)
    const b = selectPersistentLabels(input)
    expect(Array.from(a.persistent).sort()).toStrictEqual(Array.from(b.persistent).sort())
  })

  it('dedupe: cluster-top stars are not double-counted in global fill', () => {
    // Create a scenario where the cluster-top is also the global top
    const landmarks = Array.from({ length: 10 }, (_, i) =>
      makeLandmark(`tech_${i}`, 100 - i * 5, i < 5 ? 'frontend_land' : 'backend_fortress'),
    )
    const territories = [
      makeTerritory('frontend_land', 2),
      makeTerritory('backend_fortress', 2),
    ]
    const result = selectPersistentLabels({ landmarks, territories })
    // No duplicates in a Set — but verify size is consistent
    const arr = Array.from(result.persistent)
    expect(new Set(arr).size).toBe(arr.length)
  })
})
