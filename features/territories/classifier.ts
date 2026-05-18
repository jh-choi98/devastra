// SPDX-License-Identifier: MIT
import 'server-only'
import type { SourceActivity } from '@/features/sync/sources/interface'
import type { TerritoryType } from './registry'
import { SCORE_WEIGHTS } from './rules'
import { TECH_CATALOG, type DetectionRule, type TechCatalogEntry } from './tech-catalog'

export type ClassificationResult = {
  territory: TerritoryType
  weight: number
  techKeys: string[]
}

export type ClassificationContext = {
  parsedPackageJsonDeps: string[]
  parsedRequirementsTxtDeps: string[]
  parsedPyprojectTomlDeps: string[]
  parsedGoModDeps: string[]
  parsedPomXmlDeps: string[]
  parsedGradleDeps: string[]
  parsedGemfileDeps: string[]
  parsedCargoTomlDeps: string[]
  primaryLanguage?: string | null
}

export interface Classifier {
  classify(activity: SourceActivity, ctx: ClassificationContext): ClassificationResult[]
}

// Maps GitHub primary language names (lowercase) to a territory fallback.
// When the language has a catalog star, include that tech key so fallback
// activity can light stars rather than only grow the cluster.
const PRIMARY_LANGUAGE_FALLBACK: Record<string, { territory: TerritoryType; techKey?: string }> = {
  go: { territory: 'backend_fortress', techKey: 'go' },
  python: { territory: 'backend_fortress', techKey: 'python' },
  ruby: { territory: 'backend_fortress' },
  rust: { territory: 'backend_fortress', techKey: 'rust' },
  java: { territory: 'backend_fortress', techKey: 'java' },
  kotlin: { territory: 'backend_fortress' },
  scala: { territory: 'backend_fortress' },
  'c#': { territory: 'backend_fortress' },
  'c++': { territory: 'backend_fortress', techKey: 'cpp' },
  c: { territory: 'backend_fortress', techKey: 'c' },
  php: { territory: 'backend_fortress' },
  elixir: { territory: 'backend_fortress' },
  javascript: { territory: 'frontend_land', techKey: 'javascript' },
  typescript: { territory: 'frontend_land', techKey: 'typescript' },
  css: { territory: 'frontend_land', techKey: 'css' },
  html: { territory: 'frontend_land' },
  vue: { territory: 'frontend_land', techKey: 'vue' },
  svelte: { territory: 'frontend_land', techKey: 'svelte' },
  sql: { territory: 'data_pipeline_zone', techKey: 'sql' },
  r: { territory: 'data_pipeline_zone' },
  shell: { territory: 'devops_harbor' },
  dockerfile: { territory: 'devops_harbor', techKey: 'docker' },
  hcl: { territory: 'devops_harbor', techKey: 'terraform' },
}

const CONTEXT_SENSITIVE_TECH_KEYS = new Set([
  'typescript',
  'javascript',
  'nodejs',
  'go',
  'python',
  'rust',
  'java',
  'cpp',
  'c',
  'css',
  'sass',
  'sql',
  'jupyter',
  'terraform',
  'markdown',
  'mdx',
])

type RuleKind = DetectionRule['kind']

const IMPLIED_LANGUAGE_TECH_KEYS: Record<string, Partial<Record<RuleKind, string[]>>> = {
  express: { packageJson: ['nodejs'] },
  fastify: { packageJson: ['nodejs'] },
  nestjs: { packageJson: ['nodejs'] },
  hono: { packageJson: ['nodejs'] },
  trpc: { packageJson: ['nodejs'] },
  gin: { goMod: ['go'] },
  echo: { goMod: ['go'] },
  fiber: { goMod: ['go'] },
  grpc: { goMod: ['go'], packageJson: ['nodejs'] },
  fastapi: { requirementsTxt: ['python'], pyprojectToml: ['python'] },
  django: { requirementsTxt: ['python'], pyprojectToml: ['python'] },
  flask: { requirementsTxt: ['python'], pyprojectToml: ['python'] },
  axum: { cargoToml: ['rust'] },
  actix: { cargoToml: ['rust'] },
  spring: { pomXml: ['java'], gradle: ['java'] },
}

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

function normalizedPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase()
}

function normalizedBasename(filePath: string): string {
  return basename(normalizedPath(filePath))
}

function hasPathPrefix(filePath: string, prefixes: string[]): boolean {
  const normalized = normalizedPath(filePath)
  return prefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()))
}

function hasExtension(filePath: string, extensions: string[]): boolean {
  const normalized = normalizedPath(filePath)
  return extensions.some((ext) => normalized.endsWith(ext.toLowerCase()))
}

function isTestPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath)
  const name = normalizedBasename(filePath)
  return (
    normalized.includes('/__tests__/') ||
    normalized.startsWith('__tests__/') ||
    normalized.includes('/tests/') ||
    normalized.startsWith('tests/') ||
    normalized.includes('/test/') ||
    normalized.startsWith('test/') ||
    normalized.includes('/spec/') ||
    normalized.startsWith('spec/') ||
    normalized.startsWith('cypress/') ||
    normalized.startsWith('playwright/') ||
    name.includes('.test.') ||
    name.includes('.spec.')
  )
}

function detectPathTerritories(filePaths: string[]): Set<TerritoryType> {
  const territories = new Set<TerritoryType>()

  for (const filePath of filePaths) {
    const normalized = normalizedPath(filePath)
    const name = normalizedBasename(filePath)

    if (isTestPath(filePath)) territories.add('testing_lab')
    if (
      normalized.startsWith('docs/') ||
      normalized.startsWith('doc/') ||
      normalized.includes('/docs/') ||
      name === 'readme.md' ||
      name === 'readme.mdx' ||
      name === 'changelog.md' ||
      name === 'changelog.mdx' ||
      hasExtension(filePath, ['.md', '.mdx'])
    ) {
      territories.add('docs_library')
    }
    if (
      hasPathPrefix(normalized, [
        '.github/workflows/',
        'infra/',
        'infrastructure/',
        'terraform/',
        'k8s/',
        'kubernetes/',
        'charts/',
        'helm/',
        'deploy/',
        'deployments/',
        'ansible/',
        'playbooks/',
      ]) ||
      [
        'dockerfile',
        'docker-compose.yml',
        'docker-compose.yaml',
        'compose.yml',
        'compose.yaml',
        'vercel.json',
        'netlify.toml',
        'wrangler.toml',
        'nginx.conf',
        'chart.yaml',
      ].includes(name) ||
      hasExtension(filePath, ['.tf'])
    ) {
      territories.add('devops_harbor')
    }
    if (
      hasPathPrefix(normalized, [
        'migrations/',
        'migration/',
        'db/',
        'database/',
        'data/',
        'datasets/',
        'notebooks/',
        'prisma/',
        'drizzle/',
        'sql/',
      ]) ||
      normalized.includes('/migrations/') ||
      normalized.includes('/notebooks/') ||
      hasExtension(filePath, ['.sql', '.ipynb'])
    ) {
      territories.add('data_pipeline_zone')
    }
    if (
      hasPathPrefix(normalized, [
        'api/',
        'server/',
        'backend/',
        'routes/',
        'controllers/',
        'handlers/',
        'services/api/',
        'services/backend/',
        'cmd/',
        'internal/',
        'pkg/',
        'src/main/java/',
        'src/main/kotlin/',
      ]) ||
      normalized.includes('/api/') ||
      normalized.includes('/server/') ||
      normalized.includes('/backend/') ||
      normalized.startsWith('app/api/')
    ) {
      territories.add('backend_fortress')
    }
    if (
      !normalized.startsWith('app/api/') &&
      (hasPathPrefix(normalized, [
        'app/',
        'pages/',
        'components/',
        'ui/',
        'frontend/',
        'client/',
        'web/',
        'styles/',
        'public/',
        'src/components/',
        'src/pages/',
        'src/app/',
      ]) ||
        hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss', '.sass']))
    ) {
      territories.add('frontend_land')
    }
  }

  return territories
}

function findTechEntry(techKey: string): TechCatalogEntry | undefined {
  return TECH_CATALOG.find((entry) => entry.tech_key === techKey)
}

function contextualEntries(
  filePaths: string[],
  pathTerritories: Set<TerritoryType>,
): TechCatalogEntry[] {
  const keys = new Set<string>()

  for (const filePath of filePaths) {
    if (pathTerritories.has('backend_fortress')) {
      if (hasExtension(filePath, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])) keys.add('nodejs')
      if (hasExtension(filePath, ['.go'])) keys.add('go')
      if (hasExtension(filePath, ['.py'])) keys.add('python')
      if (hasExtension(filePath, ['.rs'])) keys.add('rust')
      if (hasExtension(filePath, ['.java'])) keys.add('java')
      if (hasExtension(filePath, ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'])) keys.add('cpp')
      if (hasExtension(filePath, ['.c', '.h'])) keys.add('c')
    }
    if (pathTerritories.has('frontend_land')) {
      if (hasExtension(filePath, ['.ts', '.tsx'])) keys.add('typescript')
      if (hasExtension(filePath, ['.js', '.jsx', '.mjs', '.cjs'])) keys.add('javascript')
      if (hasExtension(filePath, ['.css'])) keys.add('css')
      if (hasExtension(filePath, ['.scss', '.sass'])) keys.add('sass')
    }
    if (pathTerritories.has('data_pipeline_zone')) {
      if (hasExtension(filePath, ['.sql'])) keys.add('sql')
      if (hasExtension(filePath, ['.ipynb'])) keys.add('jupyter')
    }
    if (pathTerritories.has('devops_harbor') && hasExtension(filePath, ['.tf'])) {
      keys.add('terraform')
    }
    if (pathTerritories.has('docs_library')) {
      if (hasExtension(filePath, ['.md'])) keys.add('markdown')
      if (hasExtension(filePath, ['.mdx'])) keys.add('mdx')
    }
  }

  return Array.from(keys)
    .map((key) => findTechEntry(key))
    .filter((entry): entry is TechCatalogEntry => Boolean(entry))
}

function shouldKeepEntry(
  entry: TechCatalogEntry,
  pathTerritories: Set<TerritoryType>,
  filePaths: string[],
): boolean {
  if (pathTerritories.size === 0 || filePaths.length === 0) return true
  if (pathTerritories.has(entry.territory)) return true
  if (CONTEXT_SENSITIVE_TECH_KEYS.has(entry.tech_key)) return false
  return false
}

function matchRule(rule: DetectionRule, filePaths: string[], ctx: ClassificationContext): boolean {
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
    case 'pyprojectToml':
      return ctx.parsedPyprojectTomlDeps.includes(rule.packageName)
    case 'goMod':
      return ctx.parsedGoModDeps.some((dep) => dep.includes(rule.modulePath))
    case 'pomXml':
      return ctx.parsedPomXmlDeps.includes(rule.artifactId)
    case 'gradle':
      return ctx.parsedGradleDeps.includes(rule.artifactId)
    case 'gemfile':
      return ctx.parsedGemfileDeps.includes(rule.gemName)
    case 'cargoToml':
      return ctx.parsedCargoTomlDeps.includes(rule.crateName)
  }
}

function catalogEntriesFromMatchedRules(
  filePaths: string[],
  pathTerritories: Set<TerritoryType>,
  ctx: ClassificationContext,
): TechCatalogEntry[] {
  const keys = new Set<string>()

  for (const entry of TECH_CATALOG) {
    const matchedRules = entry.rules.filter((rule) => matchRule(rule, filePaths, ctx))
    if (matchedRules.length === 0) continue
    if (!shouldKeepEntry(entry, pathTerritories, filePaths)) continue

    keys.add(entry.tech_key)

    const impliedByRule = IMPLIED_LANGUAGE_TECH_KEYS[entry.tech_key]
    if (!impliedByRule) continue

    for (const rule of matchedRules) {
      for (const impliedKey of impliedByRule[rule.kind] ?? []) {
        keys.add(impliedKey)
      }
    }
  }

  const primaryLanguage = ctx.primaryLanguage?.toLowerCase()
  const primaryFallback = primaryLanguage ? PRIMARY_LANGUAGE_FALLBACK[primaryLanguage] : undefined
  if (
    primaryFallback?.techKey &&
    TECH_CATALOG.some(
      (entry) => keys.has(entry.tech_key) && entry.territory === primaryFallback.territory,
    )
  ) {
    keys.add(primaryFallback.techKey)
  }

  return TECH_CATALOG.filter((entry) => keys.has(entry.tech_key))
}

export class GitHubClassifier implements Classifier {
  classify(activity: SourceActivity, ctx: ClassificationContext): ClassificationResult[] {
    const baseWeight = SCORE_WEIGHTS[activity.type]
    const pathTerritories = detectPathTerritories(activity.filePaths)

    // Evaluate all catalog entries and add implied language/runtime stars for frameworks.
    const matchedEntries = catalogEntriesFromMatchedRules(
      activity.filePaths,
      pathTerritories,
      ctx,
    )
    const entries = [
      ...matchedEntries,
      ...contextualEntries(activity.filePaths, pathTerritories),
    ].filter(
      (entry, index, all) =>
        all.findIndex((candidate) => candidate.tech_key === entry.tech_key) === index,
    )

    if (entries.length === 0) {
      // Extension-based fallback
      const fallback = this.extensionFallback(activity.filePaths, baseWeight)
      if (fallback.length > 0) return fallback
      const pathFallback = this.pathFallback(pathTerritories, baseWeight)
      if (pathFallback.length > 0) return pathFallback
      // Primary language fallback
      return this.primaryLanguageFallback(ctx.primaryLanguage, baseWeight)
    }

    // Group by territory
    const byTerritory = new Map<TerritoryType, string[]>()
    for (const entry of entries) {
      const keys = byTerritory.get(entry.territory) ?? []
      keys.push(entry.tech_key)
      byTerritory.set(entry.territory, keys)
    }
    for (const territory of Array.from(pathTerritories)) {
      if (!byTerritory.has(territory)) byTerritory.set(territory, [])
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

  private pathFallback(
    pathTerritories: Set<TerritoryType>,
    baseWeight: number,
  ): ClassificationResult[] {
    if (pathTerritories.size === 0) return []
    const territories = Array.from(pathTerritories)
    const affinity =
      territories.length === 1 ? 1.0 : Math.max(0.5, 1.0 / Math.sqrt(territories.length))
    const weight = baseWeight * affinity
    return territories.map((territory) => ({ territory, weight, techKeys: [] }))
  }

  private primaryLanguageFallback(
    primaryLanguage: string | null | undefined,
    baseWeight: number,
  ): ClassificationResult[] {
    if (!primaryLanguage) return []
    const fallback = PRIMARY_LANGUAGE_FALLBACK[primaryLanguage.toLowerCase()]
    if (!fallback) return []
    return [
      {
        territory: fallback.territory,
        weight: baseWeight,
        techKeys: fallback.techKey ? [fallback.techKey] : [],
      },
    ]
  }
}
