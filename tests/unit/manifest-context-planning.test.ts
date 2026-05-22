import { describe, expect, it } from 'vitest'
import { planManifestContextRefresh } from '@/features/sync/manifest-context-planning'
import { serializeManifestContext } from '@/features/sync/manifest-context'

function manifestContext(deps: string[] = []) {
  return serializeManifestContext({
    parsedPackageJsonDeps: deps,
    parsedRequirementsTxtDeps: [],
    parsedPyprojectTomlDeps: [],
    parsedGoModDeps: [],
    parsedPomXmlDeps: [],
    parsedGradleDeps: [],
    parsedGemfileDeps: [],
    parsedCargoTomlDeps: [],
    primaryLanguage: 'TypeScript',
  })
}

describe('planManifestContextRefresh', () => {
  it('uses valid cached manifest contexts for every repo while capping network fetches', () => {
    const pushedAt = new Date('2026-05-01T00:00:00Z')
    const staleRepos = Array.from({ length: 50 }, (_, index) => ({
      externalRepoId: `stale-${index}`,
      primaryLanguage: 'TypeScript',
      sourcePushedAt: pushedAt,
      manifestSourcePushedAt: null,
      manifestContext: null,
    }))
    const cachedRepos = [
      {
        externalRepoId: 'cached-nextjs',
        primaryLanguage: 'TypeScript',
        sourcePushedAt: pushedAt,
        manifestSourcePushedAt: pushedAt,
        manifestContext: manifestContext(['next']),
      },
      {
        externalRepoId: 'cached-drizzle',
        primaryLanguage: 'TypeScript',
        sourcePushedAt: pushedAt,
        manifestSourcePushedAt: pushedAt,
        manifestContext: manifestContext(['drizzle-orm']),
      },
    ]

    const plan = planManifestContextRefresh([...staleRepos, ...cachedRepos], 50)

    expect(plan.reposToFetch).toHaveLength(50)
    expect(plan.reposToFetch.map((repo) => repo.externalRepoId)).not.toContain('cached-nextjs')
    expect(plan.reposToFetch.map((repo) => repo.externalRepoId)).not.toContain('cached-drizzle')
    expect(plan.manifestContexts['cached-nextjs'].parsedPackageJsonDeps).toEqual(['next'])
    expect(plan.manifestContexts['cached-drizzle'].parsedPackageJsonDeps).toEqual(['drizzle-orm'])
  })
})
