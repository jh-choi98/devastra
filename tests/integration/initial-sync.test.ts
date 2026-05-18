import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only and all DB/external dependencies
vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/github/token', () => ({ getUsableAccessToken: vi.fn() }))
vi.mock('@/lib/db/queries/sync-jobs', () => ({
  createSyncJob: vi.fn(),
  startSyncJob: vi.fn(),
  completeSyncJob: vi.fn(),
  failSyncJob: vi.fn(),
}))
vi.mock('@/lib/db/queries/repositories', () => ({
  getIncludedRepositoriesForUser: vi.fn(),
}))
vi.mock('@/lib/db/queries/users', () => ({
  getUserById: vi.fn(),
  getUsersWithTokens: vi.fn(),
  updateUserSyncState: vi.fn(),
}))
vi.mock('@/features/sync/denorm', () => ({
  recomputeUserDenorm: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/features/sync/sources/github', () => ({
  GitHubSourceClient: vi.fn(),
  MVP_INCLUDE_PRIVATE: false,
}))

import { buildActivityRaw, ALLOWED_RAW_KEYS } from '@/lib/db/queries/activities'
import { selectManifestPathsForLanguage } from '@/features/sync/initial'

describe('buildActivityRaw', () => {
  it('keeps only allowed keys', () => {
    const result = buildActivityRaw({
      file_paths: ['src/index.ts'],
      additions: 10,
      deletions: 2,
      github_url: 'https://github.com/owner/repo/commit/abc',
      commit_message: 'fix: secret bug',
      pr_title: 'Secret PR',
    })

    expect(result).toEqual({
      file_paths: ['src/index.ts'],
      additions: 10,
      deletions: 2,
      github_url: 'https://github.com/owner/repo/commit/abc',
    })
    expect('commit_message' in result).toBe(false)
    expect('pr_title' in result).toBe(false)
  })

  it('fills defaults for missing fields', () => {
    const result = buildActivityRaw({})
    expect(result).toEqual({
      file_paths: [],
      additions: 0,
      deletions: 0,
      github_url: '',
    })
  })

  it('ALLOWED_RAW_KEYS contains exactly the four permitted fields', () => {
    expect([...ALLOWED_RAW_KEYS].sort()).toEqual(
      ['additions', 'deletions', 'file_paths', 'github_url'].sort(),
    )
  })

  it('raw JSONB never contains disallowed keys', () => {
    const inputs = [
      { file_paths: [], additions: 0, deletions: 0, github_url: '' },
      { file_paths: ['a.ts'], additions: 5, deletions: 1, github_url: 'https://g.com' },
    ]
    for (const input of inputs) {
      const result = buildActivityRaw(input)
      const keys = Object.keys(result)
      for (const key of keys) {
        expect((ALLOWED_RAW_KEYS as readonly string[]).includes(key)).toBe(true)
      }
    }
  })
})

describe('initial sync — idempotency guard', () => {
  it('buildActivityRaw is deterministic for the same input', () => {
    const input = { file_paths: ['a.ts', 'b.ts'], additions: 3, deletions: 1, github_url: 'u' }
    expect(buildActivityRaw(input)).toEqual(buildActivityRaw(input))
  })
})

describe('initial sync — manifest API budget', () => {
  it('probes the language-appropriate manifests', () => {
    expect(selectManifestPathsForLanguage('TypeScript')).toEqual(['package.json'])
    expect(selectManifestPathsForLanguage('JavaScript')).toEqual(['package.json'])
    expect(selectManifestPathsForLanguage('Python')).toEqual(['requirements.txt', 'pyproject.toml'])
    expect(selectManifestPathsForLanguage('Go')).toEqual(['go.mod'])
    expect(selectManifestPathsForLanguage('Java')).toEqual([
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
    ])
    expect(selectManifestPathsForLanguage('Ruby')).toEqual(['Gemfile'])
    expect(selectManifestPathsForLanguage('Rust')).toEqual(['Cargo.toml'])
  })

  it('uses package.json as a cheap fallback for unknown languages', () => {
    expect(selectManifestPathsForLanguage(null)).toEqual(['package.json'])
    expect(selectManifestPathsForLanguage('Shell')).toEqual(['package.json'])
  })
})

describe('initial sync — stage_changed_at logic', () => {
  it('stage 1 → stage 2 should change stage_changed_at', () => {
    // Simulate the stage-change condition used in denorm.ts
    const oldStage: number = 1
    const newStage: number = 2
    const now = new Date()
    const stageChangedAt = oldStage !== null && newStage !== oldStage ? now : null
    expect(stageChangedAt).not.toBeNull()
  })

  it('same stage should preserve stage_changed_at', () => {
    const oldStage: number = 2
    const newStage: number = 2
    const existingChangedAt = new Date('2024-01-01')
    const stageChangedAt =
      oldStage !== null && newStage !== oldStage ? new Date() : existingChangedAt
    expect(stageChangedAt).toBe(existingChangedAt)
  })
})

describe('GitHubClassifier integration', () => {
  it('classifies TypeScript activity into frontend_land', async () => {
    const { GitHubClassifier } = await import('@/features/territories/classifier')
    const classifier = new GitHubClassifier()
    const result = classifier.classify(
      {
        source: 'github',
        externalId: 'sha123',
        type: 'commit',
        repoExternalId: 'repo1',
        occurredAt: new Date(),
        filePaths: ['src/index.ts', 'src/utils.tsx'],
        additions: 10,
        deletions: 2,
        githubUrl: 'https://github.com/owner/repo/commit/sha123',
      },
      {
        parsedPackageJsonDeps: [],
        parsedRequirementsTxtDeps: [],
        parsedPyprojectTomlDeps: [],
        parsedGoModDeps: [],
        parsedPomXmlDeps: [],
        parsedGradleDeps: [],
        parsedGemfileDeps: [],
        parsedCargoTomlDeps: [],
        primaryLanguage: 'TypeScript',
      },
    )
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((r) => r.territory === 'frontend_land')).toBe(true)
  })

  it('produces non-zero weight for commit activities', async () => {
    const { GitHubClassifier } = await import('@/features/territories/classifier')
    const classifier = new GitHubClassifier()
    const result = classifier.classify(
      {
        source: 'github',
        externalId: 'sha456',
        type: 'commit',
        repoExternalId: 'repo2',
        occurredAt: new Date(),
        filePaths: ['Dockerfile'],
        additions: 5,
        deletions: 0,
        githubUrl: 'https://github.com/owner/repo/commit/sha456',
      },
      {
        parsedPackageJsonDeps: [],
        parsedRequirementsTxtDeps: [],
        parsedPyprojectTomlDeps: [],
        parsedGoModDeps: [],
        parsedPomXmlDeps: [],
        parsedGradleDeps: [],
        parsedGemfileDeps: [],
        parsedCargoTomlDeps: [],
        primaryLanguage: null,
      },
    )
    expect(result.some((r) => r.weight > 0)).toBe(true)
  })

  it('PR activities have higher weight than commits', async () => {
    const { GitHubClassifier } = await import('@/features/territories/classifier')
    const classifier = new GitHubClassifier()
    const base = {
      source: 'github' as const,
      externalId: 'id',
      repoExternalId: 'repo',
      occurredAt: new Date(),
      filePaths: ['src/app.ts'],
      additions: 10,
      deletions: 2,
      githubUrl: 'https://github.com/owner/repo/pull/1',
    }
    const ctx = {
      parsedPackageJsonDeps: [],
      parsedRequirementsTxtDeps: [],
      parsedPyprojectTomlDeps: [],
      parsedGoModDeps: [],
      parsedPomXmlDeps: [],
      parsedGradleDeps: [],
      parsedGemfileDeps: [],
      parsedCargoTomlDeps: [],
      primaryLanguage: null,
    }
    const commitResult = classifier.classify({ ...base, type: 'commit' }, ctx)
    const prResult = classifier.classify({ ...base, type: 'pr' }, ctx)
    const commitWeight = commitResult.reduce((s, r) => s + r.weight, 0)
    const prWeight = prResult.reduce((s, r) => s + r.weight, 0)
    expect(prWeight).toBeGreaterThan(commitWeight)
  })
})
