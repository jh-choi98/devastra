import 'server-only'

import type { ClassificationContext } from '@/features/territories/classifier'
import {
  defaultManifestContext,
  getValidatedCachedManifestContext,
  type CacheableManifestRepo,
} from './manifest-context'

export type ManifestContextPlanningRepo = CacheableManifestRepo & {
  externalRepoId: string
}

export function planManifestContextRefresh<T extends ManifestContextPlanningRepo>(
  repos: readonly T[],
  maxFetches: number,
): {
  manifestContexts: Record<string, ClassificationContext>
  reposToFetch: T[]
} {
  const manifestContexts: Record<string, ClassificationContext> = {}
  const reposToFetch: T[] = []

  for (const repo of repos) {
    const cached = getValidatedCachedManifestContext(repo)
    manifestContexts[repo.externalRepoId] =
      cached ?? defaultManifestContext(repo.primaryLanguage)

    if (!cached && reposToFetch.length < maxFetches) {
      reposToFetch.push(repo)
    }
  }

  return { manifestContexts, reposToFetch }
}
