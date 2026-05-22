import 'server-only'

import type { ClassificationContext } from '@/features/territories/classifier'

export type CacheableManifestRepo = {
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

export const EMPTY_MANIFEST_CONTEXT: ManifestContextCache = {
  parsedPackageJsonDeps: [],
  parsedRequirementsTxtDeps: [],
  parsedPyprojectTomlDeps: [],
  parsedGoModDeps: [],
  parsedPomXmlDeps: [],
  parsedGradleDeps: [],
  parsedGemfileDeps: [],
  parsedCargoTomlDeps: [],
}

const CACHE_KEYS = Object.keys(EMPTY_MANIFEST_CONTEXT) as Array<keyof ManifestContextCache>

export function defaultManifestContext(primaryLanguage?: string | null): ClassificationContext {
  return {
    ...EMPTY_MANIFEST_CONTEXT,
    primaryLanguage: primaryLanguage ?? null,
  }
}

export function getValidatedCachedManifestContext(
  repo: CacheableManifestRepo,
): ClassificationContext | null {
  if (!sameInstant(repo.sourcePushedAt, repo.manifestSourcePushedAt)) return null

  const cache = parseManifestContextCache(repo.manifestContext)
  if (!cache) return null

  return {
    ...cache,
    primaryLanguage: repo.primaryLanguage ?? null,
  }
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
  const parsed = { ...EMPTY_MANIFEST_CONTEXT }

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
