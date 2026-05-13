import { describe, it, expect } from 'vitest'
import { GitHubClassifier, type ClassificationContext } from '../../features/territories/classifier'
import type { SourceActivity } from '../../features/sync/sources/interface'
import { SCORE_WEIGHTS } from '../../features/territories/rules'

const classifier = new GitHubClassifier()

function makeActivity(opts: {
  type?: 'commit' | 'pr' | 'issue'
  filePaths?: string[]
  occurredAt?: Date
}): SourceActivity {
  return {
    source: 'github',
    externalId: 'test-id',
    type: opts.type ?? 'commit',
    repoExternalId: 'repo-1',
    occurredAt: opts.occurredAt ?? new Date(),
    filePaths: opts.filePaths ?? [],
    additions: 0,
    deletions: 0,
    githubUrl: 'https://github.com/test/repo/commit/abc',
  }
}

const emptyCtx: ClassificationContext = {
  parsedPackageJsonDeps: [],
  parsedRequirementsTxtDeps: [],
  parsedGoModDeps: [],
  parsedGemfileDeps: [],
  parsedCargoTomlDeps: [],
}

function ctxWith(overrides: Partial<ClassificationContext>): ClassificationContext {
  return { ...emptyCtx, ...overrides }
}

// ---------------------------------------------------------------------------
// Frontend Land
// ---------------------------------------------------------------------------
describe('Frontend Land catalog entries', () => {
  it('typescript: matches .ts files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['src/main.ts'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('typescript'))).toBe(true)
  })

  it('typescript: matches .tsx files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['App.tsx'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('typescript'))).toBe(true)
  })

  it('javascript: matches .js files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['index.js'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('javascript'))).toBe(true)
  })

  it('javascript: matches .jsx files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['App.jsx'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('javascript'))).toBe(true)
  })

  it('javascript: matches .mjs files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['esm.mjs'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('javascript'))).toBe(true)
  })

  it('javascript: matches .cjs files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['bundle.cjs'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('javascript'))).toBe(true)
  })

  it('react: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['react'] }),
    )
    expect(results.some((r) => r.techKeys.includes('react'))).toBe(true)
  })

  it('nextjs: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['next'] }),
    )
    expect(results.some((r) => r.techKeys.includes('nextjs'))).toBe(true)
  })

  it('vue: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['vue'] }),
    )
    expect(results.some((r) => r.techKeys.includes('vue'))).toBe(true)
  })

  it('svelte: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['svelte'] }),
    )
    expect(results.some((r) => r.techKeys.includes('svelte'))).toBe(true)
  })

  it('angular: matches packageJson dep @angular/core', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['@angular/core'] }),
    )
    expect(results.some((r) => r.techKeys.includes('angular'))).toBe(true)
  })

  it('tailwind: matches packageJson dep tailwindcss', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['tailwindcss'] }),
    )
    expect(results.some((r) => r.techKeys.includes('tailwind'))).toBe(true)
  })

  it('css: matches .css files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['styles.css'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('css'))).toBe(true)
  })

  it('sass: matches .scss files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['styles.scss'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('sass'))).toBe(true)
  })

  it('sass: matches .sass files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['main.sass'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('sass'))).toBe(true)
  })

  it('vite: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['vite'] }),
    )
    expect(results.some((r) => r.techKeys.includes('vite'))).toBe(true)
  })

  it('webpack: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['webpack'] }),
    )
    expect(results.some((r) => r.techKeys.includes('webpack'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Backend Fortress
// ---------------------------------------------------------------------------
describe('Backend Fortress catalog entries', () => {
  it('nodejs: matches package.json filename', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['package.json'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('nodejs'))).toBe(true)
  })

  it('nodejs: matches nested package.json', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['services/api/package.json'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('nodejs'))).toBe(true)
  })

  it('express: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['express'] }),
    )
    expect(results.some((r) => r.techKeys.includes('express'))).toBe(true)
  })

  it('fastify: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['fastify'] }),
    )
    expect(results.some((r) => r.techKeys.includes('fastify'))).toBe(true)
  })

  it('nestjs: matches packageJson dep @nestjs/core', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['@nestjs/core'] }),
    )
    expect(results.some((r) => r.techKeys.includes('nestjs'))).toBe(true)
  })

  it('go: matches .go files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['main.go'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('go'))).toBe(true)
  })

  it('gin: matches goMod dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedGoModDeps: ['gin-gonic/gin'] }),
    )
    expect(results.some((r) => r.techKeys.includes('gin'))).toBe(true)
  })

  it('python: matches .py files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['app.py'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('python'))).toBe(true)
  })

  it('fastapi: matches requirementsTxt dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedRequirementsTxtDeps: ['fastapi'] }),
    )
    expect(results.some((r) => r.techKeys.includes('fastapi'))).toBe(true)
  })

  it('django: matches requirementsTxt dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedRequirementsTxtDeps: ['django'] }),
    )
    expect(results.some((r) => r.techKeys.includes('django'))).toBe(true)
  })

  it('flask: matches requirementsTxt dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedRequirementsTxtDeps: ['flask'] }),
    )
    expect(results.some((r) => r.techKeys.includes('flask'))).toBe(true)
  })

  it('rust: matches .rs files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['src/main.rs'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('rust'))).toBe(true)
  })

  it('java: matches .java files', () => {
    const results = classifier.classify(makeActivity({ filePaths: ['Main.java'] }), emptyCtx)
    expect(results.some((r) => r.techKeys.includes('java'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Data Pipeline Zone
// ---------------------------------------------------------------------------
describe('Data Pipeline Zone catalog entries', () => {
  it('postgres: matches packageJson pg', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['pg'] }),
    )
    expect(results.some((r) => r.techKeys.includes('postgres'))).toBe(true)
  })

  it('mysql: matches packageJson mysql2', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['mysql2'] }),
    )
    expect(results.some((r) => r.techKeys.includes('mysql'))).toBe(true)
  })

  it('sqlite: matches packageJson better-sqlite3', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['better-sqlite3'] }),
    )
    expect(results.some((r) => r.techKeys.includes('sqlite'))).toBe(true)
  })

  it('mongodb: matches packageJson mongoose', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['mongoose'] }),
    )
    expect(results.some((r) => r.techKeys.includes('mongodb'))).toBe(true)
  })

  it('redis: matches packageJson ioredis', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['ioredis'] }),
    )
    expect(results.some((r) => r.techKeys.includes('redis'))).toBe(true)
  })

  it('sql: matches .sql files', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['migrations/001_init.sql'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('sql'))).toBe(true)
  })

  it('dbt: matches dbt_project.yml filename', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['dbt_project.yml'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('dbt'))).toBe(true)
  })

  it('prisma: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['prisma'] }),
    )
    expect(results.some((r) => r.techKeys.includes('prisma'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Testing Lab
// ---------------------------------------------------------------------------
describe('Testing Lab catalog entries', () => {
  it('jest: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['jest'] }),
    )
    expect(results.some((r) => r.techKeys.includes('jest'))).toBe(true)
  })

  it('vitest: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['vitest'] }),
    )
    expect(results.some((r) => r.techKeys.includes('vitest'))).toBe(true)
  })

  it('pytest: matches requirementsTxt dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedRequirementsTxtDeps: ['pytest'] }),
    )
    expect(results.some((r) => r.techKeys.includes('pytest'))).toBe(true)
  })

  it('playwright: matches packageJson @playwright/test', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['@playwright/test'] }),
    )
    expect(results.some((r) => r.techKeys.includes('playwright'))).toBe(true)
  })

  it('cypress: matches packageJson dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['cypress'] }),
    )
    expect(results.some((r) => r.techKeys.includes('cypress'))).toBe(true)
  })

  it('rspec: matches gemfile dep', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedGemfileDeps: ['rspec'] }),
    )
    expect(results.some((r) => r.techKeys.includes('rspec'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DevOps Harbor
// ---------------------------------------------------------------------------
describe('DevOps Harbor catalog entries', () => {
  it('docker: matches Dockerfile filename', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['Dockerfile'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('docker'))).toBe(true)
  })

  it('docker: matches nested Dockerfile', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['services/api/Dockerfile'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('docker'))).toBe(true)
  })

  it('ghactions: matches .github/workflows/ path', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['.github/workflows/ci.yml'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('ghactions'))).toBe(true)
  })

  it('terraform: matches .tf files', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['infra/main.tf'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('terraform'))).toBe(true)
  })

  it('kubernetes: matches k8s/ path', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['k8s/deployment.yaml'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('kubernetes'))).toBe(true)
  })

  it('aws: matches packageJson aws-cdk-lib', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ parsedPackageJsonDeps: ['aws-cdk-lib'] }),
    )
    expect(results.some((r) => r.techKeys.includes('aws'))).toBe(true)
  })

  it('vercel: matches vercel.json filename', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['vercel.json'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('vercel'))).toBe(true)
  })

  it('nginx: matches nginx.conf filename', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['nginx.conf'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('nginx'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Docs Library
// ---------------------------------------------------------------------------
describe('Docs Library catalog entries', () => {
  it('markdown: matches .md files', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['README.md'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('markdown'))).toBe(true)
  })

  it('mdx: matches .mdx files', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['docs/guide.mdx'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('mdx'))).toBe(true)
  })

  it('jsdoc: matches jsdoc.json filename', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['jsdoc.json'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('jsdoc'))).toBe(true)
  })

  it('storybook: matches .storybook/ path', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['.storybook/main.js'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('storybook'))).toBe(true)
  })

  it('openapi: matches openapi.yaml filename', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['openapi.yaml'] }),
      emptyCtx,
    )
    expect(results.some((r) => r.techKeys.includes('openapi'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Multi-territory affinity
// ---------------------------------------------------------------------------
describe('Multi-territory affinity', () => {
  it('multi-territory commit yields three results with affinity < 1.0', () => {
    // React (frontend_land) + .sql migration (data_pipeline_zone) + Dockerfile (devops_harbor)
    const activity = makeActivity({
      filePaths: ['migrations/001_init.sql', 'Dockerfile'],
    })
    const ctx = ctxWith({ parsedPackageJsonDeps: ['react'] })
    const results = classifier.classify(activity, ctx)

    expect(results).toHaveLength(3)
    const territories = results.map((r) => r.territory)
    expect(territories).toContain('frontend_land')
    expect(territories).toContain('data_pipeline_zone')
    expect(territories).toContain('devops_harbor')
    // affinity = max(0.5, 1/sqrt(3)) ≈ 0.577
    for (const r of results) {
      expect(r.weight).toBeLessThan(SCORE_WEIGHTS.commit)
    }
  })

  it('single-territory commit has affinity 1.0', () => {
    const activity = makeActivity({ filePaths: ['main.go'] })
    const results = classifier.classify(activity, emptyCtx)
    expect(results).toHaveLength(1)
    expect(results[0].weight).toBe(SCORE_WEIGHTS.commit)
  })

  it('two-territory commit has affinity = 1/sqrt(2)', () => {
    // .go (backend_fortress) + .tf (devops_harbor)
    const activity = makeActivity({ filePaths: ['main.go', 'infra/main.tf'] })
    const results = classifier.classify(activity, emptyCtx)
    expect(results).toHaveLength(2)
    const expected = Math.max(0.5, 1 / Math.sqrt(2))
    for (const r of results) {
      expect(r.weight).toBeCloseTo(expected)
    }
  })

  it('affinity floor is 0.5 for 5+ territories', () => {
    // frontend_land (.ts) + backend_fortress (.go) + data_pipeline_zone (.sql)
    // + devops_harbor (.tf) + docs_library (.md) = 5 territories
    const activity = makeActivity({
      filePaths: ['src/app.ts', 'cmd/main.go', 'migrations/001.sql', 'infra/main.tf', 'README.md'],
    })
    const results = classifier.classify(activity, emptyCtx)
    expect(results.length).toBeGreaterThanOrEqual(5)
    for (const r of results) {
      expect(r.weight).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('techKeys grouped correctly by territory', () => {
    // typescript + react both → frontend_land
    const activity = makeActivity({ filePaths: ['App.tsx'] })
    const ctx = ctxWith({ parsedPackageJsonDeps: ['react'] })
    const results = classifier.classify(activity, ctx)
    const frontendResult = results.find((r) => r.territory === 'frontend_land')
    expect(frontendResult).toBeDefined()
    expect(frontendResult!.techKeys).toContain('typescript')
    expect(frontendResult!.techKeys).toContain('react')
  })
})

// ---------------------------------------------------------------------------
// Activity type base weights
// ---------------------------------------------------------------------------
describe('Activity type base weights', () => {
  it('commit uses weight 1', () => {
    const results = classifier.classify(
      makeActivity({ type: 'commit', filePaths: ['main.go'] }),
      emptyCtx,
    )
    expect(results[0].weight).toBe(SCORE_WEIGHTS.commit)
  })

  it('pr uses weight 5', () => {
    const results = classifier.classify(
      makeActivity({ type: 'pr', filePaths: ['main.go'] }),
      emptyCtx,
    )
    expect(results[0].weight).toBe(SCORE_WEIGHTS.pr)
  })

  it('issue uses weight 2', () => {
    const results = classifier.classify(
      makeActivity({ type: 'issue', filePaths: ['main.go'] }),
      emptyCtx,
    )
    expect(results[0].weight).toBe(SCORE_WEIGHTS.issue)
  })
})

// ---------------------------------------------------------------------------
// Fallback logic
// ---------------------------------------------------------------------------
describe('Fallback logic', () => {
  it('returns empty array when no matches and no primary language', () => {
    const results = classifier.classify(makeActivity({ filePaths: [] }), emptyCtx)
    expect(results).toEqual([])
  })

  it('returns empty array when no matches, unknown primary language, and no primary language set', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ primaryLanguage: undefined }),
    )
    expect(results).toEqual([])
  })

  it('returns backend_fortress for go primary language fallback', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ primaryLanguage: 'go' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].territory).toBe('backend_fortress')
  })

  it('primary language matching is case-insensitive', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ primaryLanguage: 'Go' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].territory).toBe('backend_fortress')
  })

  it('returns testing_lab via extension fallback for .test. files', () => {
    // .rb extension has no catalog entry; .test. triggers fallback
    const results = classifier.classify(
      makeActivity({ filePaths: ['unit.test.rb'] }),
      emptyCtx,
    )
    expect(results).toHaveLength(1)
    expect(results[0].territory).toBe('testing_lab')
  })

  it('returns testing_lab via extension fallback for __tests__/ files', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: ['__tests__/setup.rb'] }),
      emptyCtx,
    )
    expect(results).toHaveLength(1)
    expect(results[0].territory).toBe('testing_lab')
  })

  it('extension fallback does not activate when catalog already matched', () => {
    // .ts matched by typescript catalog entry; extension fallback should not add testing_lab
    const results = classifier.classify(
      makeActivity({ filePaths: ['App.test.ts'] }),
      emptyCtx,
    )
    const territories = results.map((r) => r.territory)
    expect(territories).toContain('frontend_land')
    expect(territories).not.toContain('testing_lab')
  })

  it('returns null for unknown primary language', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ primaryLanguage: 'COBOL' }),
    )
    expect(results).toEqual([])
  })

  it('returns empty when primary language is null', () => {
    const results = classifier.classify(
      makeActivity({ filePaths: [] }),
      ctxWith({ primaryLanguage: null }),
    )
    expect(results).toEqual([])
  })

  it('primary language fallback weight equals base weight with affinity 1', () => {
    const results = classifier.classify(
      makeActivity({ type: 'pr', filePaths: [] }),
      ctxWith({ primaryLanguage: 'python' }),
    )
    expect(results[0].weight).toBe(SCORE_WEIGHTS.pr)
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------
describe('Determinism', () => {
  it('same input always produces same output', () => {
    const activity = makeActivity({
      filePaths: ['src/App.tsx', 'package.json', 'Dockerfile'],
    })
    const ctx = ctxWith({ parsedPackageJsonDeps: ['react', 'pg'] })
    const r1 = classifier.classify(activity, ctx)
    const r2 = classifier.classify(activity, ctx)
    expect(r1).toEqual(r2)
  })
})
