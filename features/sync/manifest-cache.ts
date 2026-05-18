import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repositories } from '@/lib/db/schema/repositories'
import type { ClassificationContext } from '@/features/territories/classifier'

type CacheableRepo = {
  id: string
  sourcePushedAt?: Date | string | null
  manifestSourcePushedAt?: Date | string | null
  manifestContext?: unknown
  primaryLanguage?: string | null
}

type ManifestContextCache = {
  parsedPackageJsonDeps: string[]
  parsedRequirementsTxtDeps: string[]
  parsedPyprojectTomlDeps: string[]
  parsedGoModDeps: string[]
  parsedPomXmlDeps: string[]
  parsedGradleDeps: string[]
  parsedGemfileDeps: string[]
  parsedCargoTomlDeps: string[]
}

const EMPTY_CACHE: ManifestContextCache = {
  parsedPackageJsonDeps: [],
  parsedRequirementsTxtDeps: [],
  parsedPyprojectTomlDeps: [],
  parsedGoModDeps: [],
  parsedPomXmlDeps: [],
  parsedGradleDeps: [],
  parsedGemfileDeps: [],
  parsedCargoTomlDeps: [],
}

const CACHE_KEYS = Object.keys(EMPTY_CACHE) as Array<keyof ManifestContextCache>

export function getValidatedCachedManifestContext(
  repo: CacheableRepo,
): ClassificationContext | null {
  if (!sameInstant(repo.sourcePushedAt, repo.manifestSourcePushedAt)) return null

  const cache = parseManifestContextCache(repo.manifestContext)
  if (!cache) return null

  return {
    ...cache,
    primaryLanguage: repo.primaryLanguage ?? null,
  }
}

export async function cacheManifestContextForRepo(params: {
  userId: string
  repo: CacheableRepo
  context: ClassificationContext
}): Promise<void> {
  const sourcePushedAt = toDateOrNull(params.repo.sourcePushedAt)

  await db
    .update(repositories)
    .set({
      manifestContext: serializeManifestContext(params.context),
      manifestSourcePushedAt: sourcePushedAt,
      manifestCachedAt: new Date(),
    })
    .where(and(eq(repositories.id, params.repo.id), eq(repositories.userId, params.userId)))
}

export function serializeManifestContext(ctx: ClassificationContext): ManifestContextCache {
  return {
    parsedPackageJsonDeps: [...ctx.parsedPackageJsonDeps],
    parsedRequirementsTxtDeps: [...ctx.parsedRequirementsTxtDeps],
    parsedPyprojectTomlDeps: [...ctx.parsedPyprojectTomlDeps],
    parsedGoModDeps: [...ctx.parsedGoModDeps],
    parsedPomXmlDeps: [...ctx.parsedPomXmlDeps],
    parsedGradleDeps: [...ctx.parsedGradleDeps],
    parsedGemfileDeps: [...ctx.parsedGemfileDeps],
    parsedCargoTomlDeps: [...ctx.parsedCargoTomlDeps],
  }
}

function parseManifestContextCache(raw: unknown): ManifestContextCache | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const record = raw as Record<string, unknown>
  const parsed = { ...EMPTY_CACHE }

  for (const key of CACHE_KEYS) {
    const value = record[key]
    if (!Array.isArray(value)) return null
    parsed[key] = value.filter((item): item is string => typeof item === 'string')
  }

  return parsed
}

function sameInstant(a: Date | string | null | undefined, b: Date | string | null | undefined) {
  const left = toDateOrNull(a)
  const right = toDateOrNull(b)
  if (!left || !right) return false
  return left.getTime() === right.getTime()
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
