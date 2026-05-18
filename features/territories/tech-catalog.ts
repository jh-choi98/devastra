// SPDX-License-Identifier: MIT
import 'server-only'
import type { TerritoryType } from './registry'

export type DetectionRule =
  | { kind: 'ext'; extensions: string[] }
  | { kind: 'path'; prefixes: string[] }
  | { kind: 'filename'; names: string[] }
  | { kind: 'packageJson'; packageName: string }
  | { kind: 'requirementsTxt'; packageName: string }
  | { kind: 'pyprojectToml'; packageName: string }
  | { kind: 'goMod'; modulePath: string }
  | { kind: 'pomXml'; artifactId: string }
  | { kind: 'gradle'; artifactId: string }
  | { kind: 'gemfile'; gemName: string }
  | { kind: 'cargoToml'; crateName: string }

export type TechCatalogEntry = {
  tech_key: string
  displayName: string
  territory: TerritoryType
  rules: DetectionRule[]
  /** Normalized [0, 1] position within the cluster. Optional — falls back to
   *  deterministic hash placement when absent. Hand-tuned in design pass. */
  x?: number
  y?: number
}

export const TECH_CATALOG: readonly TechCatalogEntry[] = [
  // ── Frontend cluster ───────────────────────────────────────────────────────
  {
    tech_key: 'typescript',
    displayName: 'TypeScript',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.ts', '.tsx'] }],
  },
  {
    tech_key: 'javascript',
    displayName: 'JavaScript',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.js', '.jsx', '.mjs', '.cjs'] }],
  },
  {
    tech_key: 'react',
    displayName: 'React',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'react' }],
  },
  {
    tech_key: 'nextjs',
    displayName: 'Next.js',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'next' }],
  },
  {
    tech_key: 'vue',
    displayName: 'Vue',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'vue' }],
  },
  {
    tech_key: 'svelte',
    displayName: 'Svelte',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'svelte' }],
  },
  {
    tech_key: 'angular',
    displayName: 'Angular',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: '@angular/core' }],
  },
  {
    tech_key: 'tailwind',
    displayName: 'Tailwind',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'tailwindcss' }],
  },
  {
    tech_key: 'css',
    displayName: 'CSS',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.css'] }],
  },
  {
    tech_key: 'sass',
    displayName: 'Sass',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.scss', '.sass'] }],
  },
  {
    tech_key: 'vite',
    displayName: 'Vite',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'vite' }],
  },
  {
    tech_key: 'webpack',
    displayName: 'Webpack',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'webpack' }],
  },
  {
    tech_key: 'astro',
    displayName: 'Astro',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'astro' }],
  },
  {
    tech_key: 'remix',
    displayName: 'Remix',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: '@remix-run/react' }],
  },
  {
    tech_key: 'solidjs',
    displayName: 'SolidJS',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'solid-js' }],
  },
  {
    tech_key: 'tanstack_query',
    displayName: 'TanStack Query',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: '@tanstack/react-query' }],
  },
  // ── Backend cluster ────────────────────────────────────────────────────────
  {
    tech_key: 'nodejs',
    displayName: 'Node.js',
    territory: 'backend_fortress',
    rules: [{ kind: 'filename', names: ['package.json'] }],
  },
  {
    tech_key: 'express',
    displayName: 'Express',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: 'express' }],
  },
  {
    tech_key: 'fastify',
    displayName: 'Fastify',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: 'fastify' }],
  },
  {
    tech_key: 'nestjs',
    displayName: 'NestJS',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: '@nestjs/core' }],
  },
  {
    tech_key: 'hono',
    displayName: 'Hono',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: 'hono' }],
  },
  {
    tech_key: 'trpc',
    displayName: 'tRPC',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: '@trpc/server' }],
  },
  {
    tech_key: 'go',
    displayName: 'Go',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.go'] }],
  },
  {
    tech_key: 'cpp',
    displayName: 'C++',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'] }],
  },
  {
    tech_key: 'c',
    displayName: 'C',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.c', '.h'] }],
  },
  {
    tech_key: 'gin',
    displayName: 'Gin',
    territory: 'backend_fortress',
    rules: [{ kind: 'goMod', modulePath: 'gin-gonic/gin' }],
  },
  {
    tech_key: 'echo',
    displayName: 'Echo',
    territory: 'backend_fortress',
    rules: [{ kind: 'goMod', modulePath: 'labstack/echo' }],
  },
  {
    tech_key: 'fiber',
    displayName: 'Fiber',
    territory: 'backend_fortress',
    rules: [{ kind: 'goMod', modulePath: 'gofiber/fiber' }],
  },
  {
    tech_key: 'grpc',
    displayName: 'gRPC',
    territory: 'backend_fortress',
    rules: [
      { kind: 'goMod', modulePath: 'google.golang.org/grpc' },
      { kind: 'packageJson', packageName: '@grpc/grpc-js' },
    ],
  },
  {
    tech_key: 'python',
    displayName: 'Python',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.py'] }],
  },
  {
    tech_key: 'fastapi',
    displayName: 'FastAPI',
    territory: 'backend_fortress',
    rules: [
      { kind: 'requirementsTxt', packageName: 'fastapi' },
      { kind: 'pyprojectToml', packageName: 'fastapi' },
    ],
  },
  {
    tech_key: 'django',
    displayName: 'Django',
    territory: 'backend_fortress',
    rules: [
      { kind: 'requirementsTxt', packageName: 'django' },
      { kind: 'pyprojectToml', packageName: 'django' },
    ],
  },
  {
    tech_key: 'flask',
    displayName: 'Flask',
    territory: 'backend_fortress',
    rules: [
      { kind: 'requirementsTxt', packageName: 'flask' },
      { kind: 'pyprojectToml', packageName: 'flask' },
    ],
  },
  {
    tech_key: 'rust',
    displayName: 'Rust',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.rs'] }],
  },
  {
    tech_key: 'axum',
    displayName: 'Axum',
    territory: 'backend_fortress',
    rules: [{ kind: 'cargoToml', crateName: 'axum' }],
  },
  {
    tech_key: 'actix',
    displayName: 'Actix',
    territory: 'backend_fortress',
    rules: [{ kind: 'cargoToml', crateName: 'actix-web' }],
  },
  {
    tech_key: 'java',
    displayName: 'Java',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.java'] }],
  },
  {
    tech_key: 'spring',
    displayName: 'Spring',
    territory: 'backend_fortress',
    rules: [
      { kind: 'pomXml', artifactId: 'spring-boot-starter-web' },
      { kind: 'gradle', artifactId: 'spring-boot-starter-web' },
    ],
  },
  {
    tech_key: 'rails',
    displayName: 'Rails',
    territory: 'backend_fortress',
    rules: [{ kind: 'gemfile', gemName: 'rails' }],
  },
  // ── Data cluster ───────────────────────────────────────────────────────────
  {
    tech_key: 'postgres',
    displayName: 'Postgres',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'pg' }],
  },
  {
    tech_key: 'mysql',
    displayName: 'MySQL',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'mysql2' }],
  },
  {
    tech_key: 'sqlite',
    displayName: 'SQLite',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'better-sqlite3' }],
  },
  {
    tech_key: 'mongodb',
    displayName: 'MongoDB',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'mongoose' }],
  },
  {
    tech_key: 'redis',
    displayName: 'Redis',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'ioredis' }],
  },
  {
    tech_key: 'sql',
    displayName: 'SQL',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'ext', extensions: ['.sql'] }],
  },
  {
    tech_key: 'dbt',
    displayName: 'dbt',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'filename', names: ['dbt_project.yml'] }],
  },
  {
    tech_key: 'prisma',
    displayName: 'Prisma',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'prisma' }],
  },
  {
    tech_key: 'drizzle',
    displayName: 'Drizzle',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'drizzle-orm' }],
  },
  {
    tech_key: 'supabase',
    displayName: 'Supabase',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: '@supabase/supabase-js' }],
  },
  {
    tech_key: 'sqlalchemy',
    displayName: 'SQLAlchemy',
    territory: 'data_pipeline_zone',
    rules: [
      { kind: 'requirementsTxt', packageName: 'sqlalchemy' },
      { kind: 'pyprojectToml', packageName: 'sqlalchemy' },
    ],
  },
  {
    tech_key: 'pandas',
    displayName: 'pandas',
    territory: 'data_pipeline_zone',
    rules: [
      { kind: 'requirementsTxt', packageName: 'pandas' },
      { kind: 'pyprojectToml', packageName: 'pandas' },
    ],
  },
  {
    tech_key: 'numpy',
    displayName: 'NumPy',
    territory: 'data_pipeline_zone',
    rules: [
      { kind: 'requirementsTxt', packageName: 'numpy' },
      { kind: 'pyprojectToml', packageName: 'numpy' },
    ],
  },
  {
    tech_key: 'scikit_learn',
    displayName: 'scikit-learn',
    territory: 'data_pipeline_zone',
    rules: [
      { kind: 'requirementsTxt', packageName: 'scikit-learn' },
      { kind: 'pyprojectToml', packageName: 'scikit-learn' },
    ],
  },
  {
    tech_key: 'jupyter',
    displayName: 'Jupyter',
    territory: 'data_pipeline_zone',
    rules: [
      { kind: 'ext', extensions: ['.ipynb'] },
      { kind: 'requirementsTxt', packageName: 'jupyter' },
      { kind: 'pyprojectToml', packageName: 'jupyter' },
    ],
  },
  {
    tech_key: 'duckdb',
    displayName: 'DuckDB',
    territory: 'data_pipeline_zone',
    rules: [
      { kind: 'packageJson', packageName: 'duckdb' },
      { kind: 'requirementsTxt', packageName: 'duckdb' },
      { kind: 'pyprojectToml', packageName: 'duckdb' },
    ],
  },
  // ── Testing cluster ────────────────────────────────────────────────────────
  {
    tech_key: 'jest',
    displayName: 'Jest',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'jest' }],
  },
  {
    tech_key: 'vitest',
    displayName: 'Vitest',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'vitest' }],
  },
  {
    tech_key: 'pytest',
    displayName: 'pytest',
    territory: 'testing_lab',
    rules: [{ kind: 'requirementsTxt', packageName: 'pytest' }],
  },
  {
    tech_key: 'playwright',
    displayName: 'Playwright',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: '@playwright/test' }],
  },
  {
    tech_key: 'cypress',
    displayName: 'Cypress',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'cypress' }],
  },
  {
    tech_key: 'rspec',
    displayName: 'RSpec',
    territory: 'testing_lab',
    rules: [{ kind: 'gemfile', gemName: 'rspec' }],
  },
  {
    tech_key: 'testing_library',
    displayName: 'Testing Library',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: '@testing-library/react' }],
  },
  {
    tech_key: 'mocha',
    displayName: 'Mocha',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'mocha' }],
  },
  {
    tech_key: 'ava',
    displayName: 'AVA',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'ava' }],
  },
  {
    tech_key: 'msw',
    displayName: 'MSW',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'msw' }],
  },
  {
    tech_key: 'tap',
    displayName: 'tap',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'tap' }],
  },
  {
    tech_key: 'junit',
    displayName: 'JUnit',
    territory: 'testing_lab',
    rules: [
      { kind: 'pomXml', artifactId: 'junit-jupiter' },
      { kind: 'gradle', artifactId: 'junit-jupiter' },
    ],
  },
  // ── DevOps cluster ─────────────────────────────────────────────────────────
  {
    tech_key: 'docker',
    displayName: 'Docker',
    territory: 'devops_harbor',
    rules: [{ kind: 'filename', names: ['Dockerfile'] }],
  },
  {
    tech_key: 'docker_compose',
    displayName: 'Docker Compose',
    territory: 'devops_harbor',
    rules: [
      {
        kind: 'filename',
        names: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'],
      },
    ],
  },
  {
    tech_key: 'ghactions',
    displayName: 'GitHub Actions',
    territory: 'devops_harbor',
    rules: [{ kind: 'path', prefixes: ['.github/workflows/'] }],
  },
  {
    tech_key: 'terraform',
    displayName: 'Terraform',
    territory: 'devops_harbor',
    rules: [{ kind: 'ext', extensions: ['.tf'] }],
  },
  {
    tech_key: 'kubernetes',
    displayName: 'Kubernetes',
    territory: 'devops_harbor',
    rules: [{ kind: 'path', prefixes: ['k8s/', 'kubernetes/'] }],
  },
  {
    tech_key: 'helm',
    displayName: 'Helm',
    territory: 'devops_harbor',
    rules: [
      { kind: 'filename', names: ['Chart.yaml'] },
      { kind: 'path', prefixes: ['charts/'] },
    ],
  },
  {
    tech_key: 'aws',
    displayName: 'AWS',
    territory: 'devops_harbor',
    rules: [{ kind: 'packageJson', packageName: 'aws-cdk-lib' }],
  },
  {
    tech_key: 'cloudflare',
    displayName: 'Cloudflare',
    territory: 'devops_harbor',
    rules: [
      { kind: 'packageJson', packageName: 'wrangler' },
      { kind: 'filename', names: ['wrangler.toml'] },
    ],
  },
  {
    tech_key: 'vercel',
    displayName: 'Vercel',
    territory: 'devops_harbor',
    rules: [{ kind: 'filename', names: ['vercel.json'] }],
  },
  {
    tech_key: 'netlify',
    displayName: 'Netlify',
    territory: 'devops_harbor',
    rules: [{ kind: 'filename', names: ['netlify.toml'] }],
  },
  {
    tech_key: 'ansible',
    displayName: 'Ansible',
    territory: 'devops_harbor',
    rules: [{ kind: 'path', prefixes: ['ansible/', 'playbooks/'] }],
  },
  {
    tech_key: 'nginx',
    displayName: 'Nginx',
    territory: 'devops_harbor',
    rules: [{ kind: 'filename', names: ['nginx.conf'] }],
  },
  // ── Docs cluster ───────────────────────────────────────────────────────────
  {
    tech_key: 'markdown',
    displayName: 'Markdown',
    territory: 'docs_library',
    rules: [{ kind: 'ext', extensions: ['.md'] }],
  },
  {
    tech_key: 'mdx',
    displayName: 'MDX',
    territory: 'docs_library',
    rules: [{ kind: 'ext', extensions: ['.mdx'] }],
  },
  {
    tech_key: 'jsdoc',
    displayName: 'JSDoc',
    territory: 'docs_library',
    rules: [{ kind: 'filename', names: ['jsdoc.json'] }],
  },
  {
    tech_key: 'storybook',
    displayName: 'Storybook',
    territory: 'docs_library',
    rules: [{ kind: 'path', prefixes: ['.storybook/'] }],
  },
  {
    tech_key: 'openapi',
    displayName: 'OpenAPI',
    territory: 'docs_library',
    rules: [{ kind: 'filename', names: ['openapi.yaml'] }],
  },
  {
    tech_key: 'swagger',
    displayName: 'Swagger',
    territory: 'docs_library',
    rules: [{ kind: 'filename', names: ['swagger.yaml', 'swagger.yml', 'swagger.json'] }],
  },
  {
    tech_key: 'typedoc',
    displayName: 'TypeDoc',
    territory: 'docs_library',
    rules: [{ kind: 'packageJson', packageName: 'typedoc' }],
  },
  {
    tech_key: 'docusaurus',
    displayName: 'Docusaurus',
    territory: 'docs_library',
    rules: [{ kind: 'packageJson', packageName: '@docusaurus/core' }],
  },
  {
    tech_key: 'mintlify',
    displayName: 'Mintlify',
    territory: 'docs_library',
    rules: [{ kind: 'filename', names: ['mint.json'] }],
  },
  {
    tech_key: 'changelog',
    displayName: 'Changelog',
    territory: 'docs_library',
    rules: [{ kind: 'filename', names: ['CHANGELOG.md', 'CHANGELOG.mdx'] }],
  },
]

const techKeys = new Set(TECH_CATALOG.map((entry) => entry.tech_key))
if (techKeys.size !== TECH_CATALOG.length) {
  throw new Error('TECH_CATALOG contains duplicate tech_key values')
}

if (TECH_CATALOG.length < 50) {
  throw new Error(`TECH_CATALOG must have at least 50 entries, got ${TECH_CATALOG.length}`)
}

export function getTechByKey(key: string): TechCatalogEntry | undefined {
  return TECH_CATALOG.find((e) => e.tech_key === key)
}
