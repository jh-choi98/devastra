import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all server/DB dependencies before importing anything that uses them
vi.mock('@/lib/db/client', () => ({ db: {} }))

import { TERRITORIES } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import { buildClusterDrawerLitStars, type ActivityAttributionRow } from '@/lib/db/queries/drawer'

// ── Pure unit: registry + catalog parity ────────────────────────────────────

describe('cluster-drawer — cluster name resolution', () => {
  it('resolves frontend_land to "Frontend"', () => {
    expect(TERRITORIES['frontend_land'].name).toBe('Frontend')
  })

  it('resolves all 6 territory types without throwing', () => {
    const types = [
      'frontend_land',
      'backend_fortress',
      'data_pipeline_zone',
      'testing_lab',
      'devops_harbor',
      'docs_library',
    ] as const
    for (const type of types) {
      expect(TERRITORIES[type].name).toBeTruthy()
      expect(TERRITORIES[type].color).toMatch(/^#/)
    }
  })
})

describe('cluster-drawer — displayName resolution', () => {
  it('resolves react displayName from public catalog', () => {
    expect(getPublicTech('react')?.displayName).toBe('React')
  })

  it('resolves nextjs displayName from public catalog', () => {
    expect(getPublicTech('nextjs')?.displayName).toBe('Next.js')
  })
})

// ── Brightness ordering logic ────────────────────────────────────────────────

function computeBrightnessDescriptor(
  stars: Array<{ tech_key: string; weight: number }>,
  techKey: string,
): 'brightest' | 'bright' | 'dim' {
  const sorted = [...stars].sort((a, b) => b.weight - a.weight)
  const idx = sorted.findIndex((s) => s.tech_key === techKey)
  if (idx === 0) return 'brightest'
  const topWeight = sorted[0]?.weight ?? 0
  const weight = sorted[idx]?.weight ?? 0
  return weight >= topWeight * 0.5 ? 'bright' : 'dim'
}

describe('cluster-drawer — brightness ordering', () => {
  const stars = [
    { tech_key: 'react', weight: 80 },
    { tech_key: 'nextjs', weight: 50 },
    { tech_key: 'css', weight: 10 },
  ]

  it('highest-weight star is brightest', () => {
    expect(computeBrightnessDescriptor(stars, 'react')).toBe('brightest')
  })

  it('star with weight ≥ 50% of top is bright', () => {
    // nextjs=50 / react=80 = 62.5% ≥ 50%
    expect(computeBrightnessDescriptor(stars, 'nextjs')).toBe('bright')
  })

  it('star with weight < 50% of top is dim', () => {
    // css=10 / react=80 = 12.5% < 50%
    expect(computeBrightnessDescriptor(stars, 'css')).toBe('dim')
  })
})

// ── Visitor drawer data derivation ──────────────────────────────────────────

function buildVisitorLitStars(
  landmarks: Array<{
    tech_key: string
    territory: string
    weight: number
    firstUnlockedAt: string | null
  }>,
  territoryType: string,
) {
  const UNLOCK_WEIGHT = 5
  return landmarks
    .filter((l) => l.territory === territoryType && l.weight >= UNLOCK_WEIGHT)
    .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
    .map((lm) => ({
      tech_key: lm.tech_key,
      displayName: getPublicTech(lm.tech_key)?.displayName ?? lm.tech_key,
      weight: lm.weight,
      firstUnlockedAt: lm.firstUnlockedAt,
    }))
}

describe('cluster-drawer — visitor drawer data derivation', () => {
  const landmarks = [
    {
      tech_key: 'react',
      territory: 'frontend_land',
      weight: 80,
      firstUnlockedAt: '2026-04-01T00:00:00Z',
    },
    {
      tech_key: 'nextjs',
      territory: 'frontend_land',
      weight: 50,
      firstUnlockedAt: '2026-03-01T00:00:00Z',
    },
    { tech_key: 'css', territory: 'frontend_land', weight: 3, firstUnlockedAt: null }, // below unlock threshold
    {
      tech_key: 'docker',
      territory: 'devops_harbor',
      weight: 20,
      firstUnlockedAt: '2026-04-15T00:00:00Z',
    },
  ]

  it('returns 2 lit stars for frontend_land (above unlock threshold)', () => {
    const stars = buildVisitorLitStars(landmarks, 'frontend_land')
    expect(stars).toHaveLength(2)
  })

  it('excludes stars below unlock threshold', () => {
    const stars = buildVisitorLitStars(landmarks, 'frontend_land')
    expect(stars.every((s) => s.weight >= 5)).toBe(true)
  })

  it('sorts by weight DESC', () => {
    const stars = buildVisitorLitStars(landmarks, 'frontend_land')
    expect(stars[0].tech_key).toBe('react')
    expect(stars[1].tech_key).toBe('nextjs')
  })

  it('resolves correct displayNames', () => {
    const stars = buildVisitorLitStars(landmarks, 'frontend_land')
    expect(stars[0].displayName).toBe('React')
    expect(stars[1].displayName).toBe('Next.js')
  })

  it('does not include stars from other clusters', () => {
    const stars = buildVisitorLitStars(landmarks, 'frontend_land')
    expect(stars.find((s) => s.tech_key === 'docker')).toBeUndefined()
  })
})

describe('cluster-drawer — star-specific attribution', () => {
  const catalogMap = new Map([
    [
      'cpp',
      {
        displayName: 'C++',
        rules: [{ kind: 'ext' as const, extensions: ['.cpp'] }],
      },
    ],
    [
      'go',
      {
        displayName: 'Go',
        rules: [{ kind: 'ext' as const, extensions: ['.go'] }],
      },
    ],
  ])

  const litLandmarks = [
    { techKey: 'cpp', weight: '36', firstUnlockedAt: new Date('2026-01-01T00:00:00Z') },
    { techKey: 'go', weight: '12', firstUnlockedAt: new Date('2026-01-02T00:00:00Z') },
  ]

  const rowsByTechKey = new Map<string, ActivityAttributionRow[]>([
    [
      'cpp',
      [
        {
          techKey: 'cpp',
          repoId: 'repo-cpp',
          type: 'commit',
          repoOwner: 'jh-choi98',
          repoName: 'cpp-practice',
          cnt: 36,
        },
      ],
    ],
    [
      'go',
      [
        {
          techKey: 'go',
          repoId: 'repo-go',
          type: 'commit',
          repoOwner: 'jh-choi98',
          repoName: 'qr-backend-mini-project',
          cnt: 9,
        },
      ],
    ],
  ])

  it('does not reuse cluster-wide contributing repos across different stars', () => {
    const stars = buildClusterDrawerLitStars(litLandmarks, catalogMap, rowsByTechKey)
    const cpp = stars.find((star) => star.tech_key === 'cpp')

    expect(cpp?.contributingRepos.map((repo) => repo.name)).toEqual(['cpp-practice'])
    expect(cpp?.topContributingRepo?.name).toBe('cpp-practice')
    expect(cpp?.activity).toEqual({ commits: 36, prs: 0, issues: 0 })
  })
})
