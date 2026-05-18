import { describe, expect, it } from 'vitest'
import {
  getValidatedCachedManifestContext,
  serializeManifestContext,
} from '@/features/sync/manifest-cache'

describe('manifest cache', () => {
  it('reuses cached dependency names only when source pushed_at matches', () => {
    const pushedAt = new Date('2026-05-17T00:00:00.000Z')
    const context = getValidatedCachedManifestContext({
      id: 'repo-id',
      primaryLanguage: 'TypeScript',
      sourcePushedAt: pushedAt,
      manifestSourcePushedAt: pushedAt,
      manifestContext: {
        parsedPackageJsonDeps: ['react', 'next'],
        parsedRequirementsTxtDeps: [],
        parsedPyprojectTomlDeps: [],
        parsedGoModDeps: [],
        parsedPomXmlDeps: [],
        parsedGradleDeps: [],
        parsedGemfileDeps: [],
        parsedCargoTomlDeps: [],
      },
    })

    expect(context?.parsedPackageJsonDeps).toEqual(['react', 'next'])
    expect(context?.primaryLanguage).toBe('TypeScript')
  })

  it('rejects cached dependency names when the repository has been pushed since validation', () => {
    const context = getValidatedCachedManifestContext({
      id: 'repo-id',
      primaryLanguage: 'Go',
      sourcePushedAt: '2026-05-17T00:00:01.000Z',
      manifestSourcePushedAt: '2026-05-17T00:00:00.000Z',
      manifestContext: {
        parsedPackageJsonDeps: [],
        parsedRequirementsTxtDeps: [],
        parsedPyprojectTomlDeps: [],
        parsedGoModDeps: ['github.com/gin-gonic/gin'],
        parsedPomXmlDeps: [],
        parsedGradleDeps: [],
        parsedGemfileDeps: [],
        parsedCargoTomlDeps: [],
      },
    })

    expect(context).toBeNull()
  })

  it('serializes dependency names without storing manifest contents', () => {
    const cache = serializeManifestContext({
      parsedPackageJsonDeps: ['react'],
      parsedRequirementsTxtDeps: [],
      parsedPyprojectTomlDeps: [],
      parsedGoModDeps: ['github.com/gin-gonic/gin'],
      parsedPomXmlDeps: [],
      parsedGradleDeps: [],
      parsedGemfileDeps: [],
      parsedCargoTomlDeps: [],
      primaryLanguage: 'TypeScript',
    })

    expect(cache).toEqual({
      parsedPackageJsonDeps: ['react'],
      parsedRequirementsTxtDeps: [],
      parsedPyprojectTomlDeps: [],
      parsedGoModDeps: ['github.com/gin-gonic/gin'],
      parsedPomXmlDeps: [],
      parsedGradleDeps: [],
      parsedGemfileDeps: [],
      parsedCargoTomlDeps: [],
    })
  })
})
