import 'server-only'
import type { TerritoryType } from './registry'

export type DetectionRule =
  | { kind: 'ext'; extensions: string[] }
  | { kind: 'path'; prefixes: string[] }
  | { kind: 'filename'; names: string[] }
  | { kind: 'packageJson'; packageName: string }
  | { kind: 'requirementsTxt'; packageName: string }
  | { kind: 'goMod'; modulePath: string }
  | { kind: 'gemfile'; gemName: string }
  | { kind: 'cargoToml'; crateName: string }

export type TechCatalogEntry = {
  tech_key: string
  landmarkName: string
  territory: TerritoryType
  rules: DetectionRule[]
}

export const TECH_CATALOG: readonly TechCatalogEntry[] = [
  // ── Frontend Land ──────────────────────────────────────────────────────────
  {
    tech_key: 'typescript',
    landmarkName: 'TypeScript Pavilion',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.ts', '.tsx'] }],
  },
  {
    tech_key: 'javascript',
    landmarkName: 'JavaScript Square',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.js', '.jsx', '.mjs', '.cjs'] }],
  },
  {
    tech_key: 'react',
    landmarkName: 'React Forge',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'react' }],
  },
  {
    tech_key: 'nextjs',
    landmarkName: 'Next.js Citadel',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'next' }],
  },
  {
    tech_key: 'vue',
    landmarkName: 'Vue Garden',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'vue' }],
  },
  {
    tech_key: 'svelte',
    landmarkName: 'Svelte Foundry',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'svelte' }],
  },
  {
    tech_key: 'angular',
    landmarkName: 'Angular Arcade',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: '@angular/core' }],
  },
  {
    tech_key: 'tailwind',
    landmarkName: 'Tailwind Plaza',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'tailwindcss' }],
  },
  {
    tech_key: 'css',
    landmarkName: 'CSS Gallery',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.css'] }],
  },
  {
    tech_key: 'sass',
    landmarkName: 'Sass Studio',
    territory: 'frontend_land',
    rules: [{ kind: 'ext', extensions: ['.scss', '.sass'] }],
  },
  {
    tech_key: 'vite',
    landmarkName: 'Vite Spire',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'vite' }],
  },
  {
    tech_key: 'webpack',
    landmarkName: 'Webpack Bunker',
    territory: 'frontend_land',
    rules: [{ kind: 'packageJson', packageName: 'webpack' }],
  },

  // ── Backend Fortress ───────────────────────────────────────────────────────
  {
    tech_key: 'nodejs',
    landmarkName: 'Node.js Watchtower',
    territory: 'backend_fortress',
    rules: [{ kind: 'filename', names: ['package.json'] }],
  },
  {
    tech_key: 'express',
    landmarkName: 'Express Gatehouse',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: 'express' }],
  },
  {
    tech_key: 'fastify',
    landmarkName: 'Fastify Rampart',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: 'fastify' }],
  },
  {
    tech_key: 'nestjs',
    landmarkName: 'NestJS Keep',
    territory: 'backend_fortress',
    rules: [{ kind: 'packageJson', packageName: '@nestjs/core' }],
  },
  {
    tech_key: 'go',
    landmarkName: 'Go Tower',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.go'] }],
  },
  {
    tech_key: 'gin',
    landmarkName: 'Gin Barracks',
    territory: 'backend_fortress',
    rules: [{ kind: 'goMod', modulePath: 'gin-gonic/gin' }],
  },
  {
    tech_key: 'python',
    landmarkName: 'Python Spire',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.py'] }],
  },
  {
    tech_key: 'fastapi',
    landmarkName: 'FastAPI Stronghold',
    territory: 'backend_fortress',
    rules: [{ kind: 'requirementsTxt', packageName: 'fastapi' }],
  },
  {
    tech_key: 'django',
    landmarkName: 'Django Citadel',
    territory: 'backend_fortress',
    rules: [{ kind: 'requirementsTxt', packageName: 'django' }],
  },
  {
    tech_key: 'flask',
    landmarkName: 'Flask Outpost',
    territory: 'backend_fortress',
    rules: [{ kind: 'requirementsTxt', packageName: 'flask' }],
  },
  {
    tech_key: 'rust',
    landmarkName: 'Rust Bastion',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.rs'] }],
  },
  {
    tech_key: 'java',
    landmarkName: 'Java Fortress',
    territory: 'backend_fortress',
    rules: [{ kind: 'ext', extensions: ['.java'] }],
  },

  // ── Data Pipeline Zone ─────────────────────────────────────────────────────
  {
    tech_key: 'postgres',
    landmarkName: 'Postgres Reservoir',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'pg' }],
  },
  {
    tech_key: 'mysql',
    landmarkName: 'MySQL Lock',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'mysql2' }],
  },
  {
    tech_key: 'sqlite',
    landmarkName: 'SQLite Vault',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'better-sqlite3' }],
  },
  {
    tech_key: 'mongodb',
    landmarkName: 'MongoDB Cavern',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'mongoose' }],
  },
  {
    tech_key: 'redis',
    landmarkName: 'Redis Floodgate',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'ioredis' }],
  },
  {
    tech_key: 'sql',
    landmarkName: 'SQL Aqueduct',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'ext', extensions: ['.sql'] }],
  },
  {
    tech_key: 'dbt',
    landmarkName: 'dbt Channel',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'filename', names: ['dbt_project.yml'] }],
  },
  {
    tech_key: 'prisma',
    landmarkName: 'Prisma Bridge',
    territory: 'data_pipeline_zone',
    rules: [{ kind: 'packageJson', packageName: 'prisma' }],
  },

  // ── Testing Lab ────────────────────────────────────────────────────────────
  {
    tech_key: 'jest',
    landmarkName: 'Jest Workshop',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'jest' }],
  },
  {
    tech_key: 'vitest',
    landmarkName: 'Vitest Observatory',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'vitest' }],
  },
  {
    tech_key: 'pytest',
    landmarkName: 'Pytest Arena',
    territory: 'testing_lab',
    rules: [{ kind: 'requirementsTxt', packageName: 'pytest' }],
  },
  {
    tech_key: 'playwright',
    landmarkName: 'Playwright Stage',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: '@playwright/test' }],
  },
  {
    tech_key: 'cypress',
    landmarkName: 'Cypress Circuit',
    territory: 'testing_lab',
    rules: [{ kind: 'packageJson', packageName: 'cypress' }],
  },
  {
    tech_key: 'rspec',
    landmarkName: 'RSpec Proving Ground',
    territory: 'testing_lab',
    rules: [{ kind: 'gemfile', gemName: 'rspec' }],
  },

  // ── DevOps Harbor ──────────────────────────────────────────────────────────
  {
    tech_key: 'docker',
    landmarkName: 'Container Dock',
    territory: 'devops_harbor',
    rules: [{ kind: 'filename', names: ['Dockerfile'] }],
  },
  {
    tech_key: 'ghactions',
    landmarkName: 'CI Lighthouse',
    territory: 'devops_harbor',
    rules: [{ kind: 'path', prefixes: ['.github/workflows/'] }],
  },
  {
    tech_key: 'terraform',
    landmarkName: 'Terraform Quay',
    territory: 'devops_harbor',
    rules: [{ kind: 'ext', extensions: ['.tf'] }],
  },
  {
    tech_key: 'kubernetes',
    landmarkName: 'Helm Pier',
    territory: 'devops_harbor',
    rules: [{ kind: 'path', prefixes: ['k8s/'] }],
  },
  {
    tech_key: 'aws',
    landmarkName: 'AWS Anchor',
    territory: 'devops_harbor',
    rules: [{ kind: 'packageJson', packageName: 'aws-cdk-lib' }],
  },
  {
    tech_key: 'vercel',
    landmarkName: 'Vercel Gangway',
    territory: 'devops_harbor',
    rules: [{ kind: 'filename', names: ['vercel.json'] }],
  },
  {
    tech_key: 'nginx',
    landmarkName: 'Nginx Harbor',
    territory: 'devops_harbor',
    rules: [{ kind: 'filename', names: ['nginx.conf'] }],
  },

  // ── Docs Library ───────────────────────────────────────────────────────────
  {
    tech_key: 'markdown',
    landmarkName: 'Markdown Archive',
    territory: 'docs_library',
    rules: [{ kind: 'ext', extensions: ['.md'] }],
  },
  {
    tech_key: 'mdx',
    landmarkName: 'MDX Atrium',
    territory: 'docs_library',
    rules: [{ kind: 'ext', extensions: ['.mdx'] }],
  },
  {
    tech_key: 'jsdoc',
    landmarkName: 'JSDoc Reading Room',
    territory: 'docs_library',
    rules: [{ kind: 'filename', names: ['jsdoc.json'] }],
  },
  {
    tech_key: 'storybook',
    landmarkName: 'Storybook Gallery',
    territory: 'docs_library',
    rules: [{ kind: 'path', prefixes: ['.storybook/'] }],
  },
  {
    tech_key: 'openapi',
    landmarkName: 'OpenAPI Scriptorium',
    territory: 'docs_library',
    rules: [{ kind: 'filename', names: ['openapi.yaml'] }],
  },
]

if (TECH_CATALOG.length !== 50) {
  throw new Error(`TECH_CATALOG must have exactly 50 entries, got ${TECH_CATALOG.length}`)
}

export function getTechByKey(key: string): TechCatalogEntry | undefined {
  return TECH_CATALOG.find((e) => e.tech_key === key)
}
