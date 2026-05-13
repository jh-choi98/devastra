import type { TerritoryType } from './registry'

export type PublicTechEntry = {
  tech_key: string
  landmarkName: string
  territory: TerritoryType
}

export const PUBLIC_TECH_CATALOG: readonly PublicTechEntry[] = [
  // Frontend Land
  { tech_key: 'typescript', landmarkName: 'TypeScript Pavilion', territory: 'frontend_land' },
  { tech_key: 'javascript', landmarkName: 'JavaScript Square', territory: 'frontend_land' },
  { tech_key: 'react', landmarkName: 'React Forge', territory: 'frontend_land' },
  { tech_key: 'nextjs', landmarkName: 'Next.js Citadel', territory: 'frontend_land' },
  { tech_key: 'vue', landmarkName: 'Vue Garden', territory: 'frontend_land' },
  { tech_key: 'svelte', landmarkName: 'Svelte Foundry', territory: 'frontend_land' },
  { tech_key: 'angular', landmarkName: 'Angular Arcade', territory: 'frontend_land' },
  { tech_key: 'tailwind', landmarkName: 'Tailwind Plaza', territory: 'frontend_land' },
  { tech_key: 'css', landmarkName: 'CSS Gallery', territory: 'frontend_land' },
  { tech_key: 'sass', landmarkName: 'Sass Studio', territory: 'frontend_land' },
  { tech_key: 'vite', landmarkName: 'Vite Spire', territory: 'frontend_land' },
  { tech_key: 'webpack', landmarkName: 'Webpack Bunker', territory: 'frontend_land' },
  // Backend Fortress
  { tech_key: 'nodejs', landmarkName: 'Node.js Watchtower', territory: 'backend_fortress' },
  { tech_key: 'express', landmarkName: 'Express Gatehouse', territory: 'backend_fortress' },
  { tech_key: 'fastify', landmarkName: 'Fastify Rampart', territory: 'backend_fortress' },
  { tech_key: 'nestjs', landmarkName: 'NestJS Keep', territory: 'backend_fortress' },
  { tech_key: 'go', landmarkName: 'Go Tower', territory: 'backend_fortress' },
  { tech_key: 'gin', landmarkName: 'Gin Barracks', territory: 'backend_fortress' },
  { tech_key: 'python', landmarkName: 'Python Spire', territory: 'backend_fortress' },
  { tech_key: 'fastapi', landmarkName: 'FastAPI Stronghold', territory: 'backend_fortress' },
  { tech_key: 'django', landmarkName: 'Django Citadel', territory: 'backend_fortress' },
  { tech_key: 'flask', landmarkName: 'Flask Outpost', territory: 'backend_fortress' },
  { tech_key: 'rust', landmarkName: 'Rust Bastion', territory: 'backend_fortress' },
  { tech_key: 'java', landmarkName: 'Java Fortress', territory: 'backend_fortress' },
  // Data Pipeline Zone
  { tech_key: 'postgres', landmarkName: 'Postgres Reservoir', territory: 'data_pipeline_zone' },
  { tech_key: 'mysql', landmarkName: 'MySQL Lock', territory: 'data_pipeline_zone' },
  { tech_key: 'sqlite', landmarkName: 'SQLite Vault', territory: 'data_pipeline_zone' },
  { tech_key: 'mongodb', landmarkName: 'MongoDB Cavern', territory: 'data_pipeline_zone' },
  { tech_key: 'redis', landmarkName: 'Redis Floodgate', territory: 'data_pipeline_zone' },
  { tech_key: 'sql', landmarkName: 'SQL Aqueduct', territory: 'data_pipeline_zone' },
  { tech_key: 'dbt', landmarkName: 'dbt Channel', territory: 'data_pipeline_zone' },
  { tech_key: 'prisma', landmarkName: 'Prisma Bridge', territory: 'data_pipeline_zone' },
  // Testing Lab
  { tech_key: 'jest', landmarkName: 'Jest Workshop', territory: 'testing_lab' },
  { tech_key: 'vitest', landmarkName: 'Vitest Observatory', territory: 'testing_lab' },
  { tech_key: 'pytest', landmarkName: 'Pytest Arena', territory: 'testing_lab' },
  { tech_key: 'playwright', landmarkName: 'Playwright Stage', territory: 'testing_lab' },
  { tech_key: 'cypress', landmarkName: 'Cypress Circuit', territory: 'testing_lab' },
  { tech_key: 'rspec', landmarkName: 'RSpec Proving Ground', territory: 'testing_lab' },
  // DevOps Harbor
  { tech_key: 'docker', landmarkName: 'Container Dock', territory: 'devops_harbor' },
  { tech_key: 'ghactions', landmarkName: 'CI Lighthouse', territory: 'devops_harbor' },
  { tech_key: 'terraform', landmarkName: 'Terraform Quay', territory: 'devops_harbor' },
  { tech_key: 'kubernetes', landmarkName: 'Helm Pier', territory: 'devops_harbor' },
  { tech_key: 'aws', landmarkName: 'AWS Anchor', territory: 'devops_harbor' },
  { tech_key: 'vercel', landmarkName: 'Vercel Gangway', territory: 'devops_harbor' },
  { tech_key: 'nginx', landmarkName: 'Nginx Harbor', territory: 'devops_harbor' },
  // Docs Library
  { tech_key: 'markdown', landmarkName: 'Markdown Archive', territory: 'docs_library' },
  { tech_key: 'mdx', landmarkName: 'MDX Atrium', territory: 'docs_library' },
  { tech_key: 'jsdoc', landmarkName: 'JSDoc Reading Room', territory: 'docs_library' },
  { tech_key: 'storybook', landmarkName: 'Storybook Gallery', territory: 'docs_library' },
  { tech_key: 'openapi', landmarkName: 'OpenAPI Scriptorium', territory: 'docs_library' },
]

export function getPublicTech(key: string): PublicTechEntry | undefined {
  return PUBLIC_TECH_CATALOG.find((e) => e.tech_key === key)
}
