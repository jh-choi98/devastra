// SPDX-License-Identifier: MIT
import 'server-only'
import type { SourceActivity } from '@/features/sync/sources/interface'
import type { TerritoryType } from './registry'
import { SCORE_WEIGHTS } from './rules'
import { TECH_CATALOG, type DetectionRule } from './tech-catalog'

export type ClassificationResult = {
  territory: TerritoryType
  weight: number
  techKeys: string[]
}

export type ClassificationContext = {
  parsedPackageJsonDeps: string[]
  parsedRequirementsTxtDeps: string[]
  parsedGoModDeps: string[]
  parsedGemfileDeps: string[]
  parsedCargoTomlDeps: string[]
  primaryLanguage?: string | null
}

export interface Classifier {
  classify(activity: SourceActivity, ctx: ClassificationContext): ClassificationResult[]
}

// Maps GitHub primary language names (lowercase) to a territory fallback.
const PRIMARY_LANGUAGE_TERRITORY: Record<string, TerritoryType> = {
  go: 'backend_fortress',
  python: 'backend_fortress',
  ruby: 'backend_fortress',
  rust: 'backend_fortress',
  java: 'backend_fortress',
  kotlin: 'backend_fortress',
  scala: 'backend_fortress',
  'c#': 'backend_fortress',
  'c++': 'backend_fortress',
  c: 'backend_fortress',
  php: 'backend_fortress',
  elixir: 'backend_fortress',
  javascript: 'frontend_land',
  typescript: 'frontend_land',
  css: 'frontend_land',
  html: 'frontend_land',
  vue: 'frontend_land',
  svelte: 'frontend_land',
  sql: 'data_pipeline_zone',
  r: 'data_pipeline_zone',
  shell: 'devops_harbor',
  dockerfile: 'devops_harbor',
  hcl: 'devops_harbor',
}

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

function matchRule(
  rule: DetectionRule,
  filePaths: string[],
  ctx: ClassificationContext,
): boolean {
  switch (rule.kind) {
    case 'ext':
      return filePaths.some((fp) => rule.extensions.some((ext) => fp.endsWith(ext)))
    case 'path':
      return filePaths.some((fp) => rule.prefixes.some((prefix) => fp.startsWith(prefix)))
    case 'filename':
      return filePaths.some((fp) => rule.names.includes(basename(fp)))
    case 'packageJson':
      return ctx.parsedPackageJsonDeps.includes(rule.packageName)
    case 'requirementsTxt':
      return ctx.parsedRequirementsTxtDeps.includes(rule.packageName)
    case 'goMod':
      return ctx.parsedGoModDeps.includes(rule.modulePath)
    case 'gemfile':
      return ctx.parsedGemfileDeps.includes(rule.gemName)
    case 'cargoToml':
      return ctx.parsedCargoTomlDeps.includes(rule.crateName)
  }
}

export class GitHubClassifier implements Classifier {
  classify(activity: SourceActivity, ctx: ClassificationContext): ClassificationResult[] {
    const baseWeight = SCORE_WEIGHTS[activity.type]

    // Evaluate all catalog entries
    const matchedEntries = TECH_CATALOG.filter((entry) =>
      entry.rules.some((rule) => matchRule(rule, activity.filePaths, ctx)),
    )

    if (matchedEntries.length === 0) {
      // Extension-based fallback
      const fallback = this.extensionFallback(activity.filePaths, baseWeight)
      if (fallback.length > 0) return fallback
      // Primary language fallback
      return this.primaryLanguageFallback(ctx.primaryLanguage, baseWeight)
    }

    // Group by territory
    const byTerritory = new Map<TerritoryType, string[]>()
    for (const entry of matchedEntries) {
      const keys = byTerritory.get(entry.territory) ?? []
      keys.push(entry.tech_key)
      byTerritory.set(entry.territory, keys)
    }

    const n = byTerritory.size
    const affinity = n === 1 ? 1.0 : Math.max(0.5, 1.0 / Math.sqrt(n))
    const weight = baseWeight * affinity

    return Array.from(byTerritory.entries()).map(([territory, techKeys]) => ({
      territory,
      weight,
      techKeys,
    }))
  }

  private extensionFallback(filePaths: string[], baseWeight: number): ClassificationResult[] {
    const hasTestFiles = filePaths.some((fp) => {
      const name = basename(fp)
      return name.includes('.test.') || name.includes('.spec.') || fp.includes('__tests__/')
    })
    const hasMarkdown = filePaths.some((fp) => fp.endsWith('.md') || fp.endsWith('.mdx'))

    const territories: TerritoryType[] = []
    if (hasTestFiles) territories.push('testing_lab')
    if (hasMarkdown) territories.push('docs_library')

    if (territories.length === 0) return []

    const n = territories.length
    const affinity = n === 1 ? 1.0 : Math.max(0.5, 1.0 / Math.sqrt(n))
    const weight = baseWeight * affinity

    return territories.map((territory) => ({ territory, weight, techKeys: [] }))
  }

  private primaryLanguageFallback(
    primaryLanguage: string | null | undefined,
    baseWeight: number,
  ): ClassificationResult[] {
    if (!primaryLanguage) return []
    const territory = PRIMARY_LANGUAGE_TERRITORY[primaryLanguage.toLowerCase()]
    if (!territory) return []
    return [{ territory, weight: baseWeight, techKeys: [] }]
  }
}
