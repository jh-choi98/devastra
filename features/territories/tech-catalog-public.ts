// Client-safe tech display names — no server-only import, no detection rules.
// Kept in sync with tech-catalog.ts. When adding/renaming entries, update both.
export type PublicTechEntry = {
  tech_key: string
  displayName: string
  territory: string
}

const PUBLIC_ENTRIES: readonly PublicTechEntry[] = [
  // Frontend
  { tech_key: 'typescript', displayName: 'TypeScript', territory: 'frontend_land' },
  { tech_key: 'javascript', displayName: 'JavaScript', territory: 'frontend_land' },
  { tech_key: 'react', displayName: 'React', territory: 'frontend_land' },
  { tech_key: 'nextjs', displayName: 'Next.js', territory: 'frontend_land' },
  { tech_key: 'vue', displayName: 'Vue', territory: 'frontend_land' },
  { tech_key: 'svelte', displayName: 'Svelte', territory: 'frontend_land' },
  { tech_key: 'angular', displayName: 'Angular', territory: 'frontend_land' },
  { tech_key: 'tailwind', displayName: 'Tailwind', territory: 'frontend_land' },
  { tech_key: 'css', displayName: 'CSS', territory: 'frontend_land' },
  { tech_key: 'sass', displayName: 'Sass', territory: 'frontend_land' },
  { tech_key: 'vite', displayName: 'Vite', territory: 'frontend_land' },
  { tech_key: 'webpack', displayName: 'Webpack', territory: 'frontend_land' },
  { tech_key: 'astro', displayName: 'Astro', territory: 'frontend_land' },
  { tech_key: 'remix', displayName: 'Remix', territory: 'frontend_land' },
  { tech_key: 'solidjs', displayName: 'SolidJS', territory: 'frontend_land' },
  { tech_key: 'tanstack_query', displayName: 'TanStack Query', territory: 'frontend_land' },
  // Backend
  { tech_key: 'nodejs', displayName: 'Node.js', territory: 'backend_fortress' },
  { tech_key: 'express', displayName: 'Express', territory: 'backend_fortress' },
  { tech_key: 'fastify', displayName: 'Fastify', territory: 'backend_fortress' },
  { tech_key: 'nestjs', displayName: 'NestJS', territory: 'backend_fortress' },
  { tech_key: 'hono', displayName: 'Hono', territory: 'backend_fortress' },
  { tech_key: 'trpc', displayName: 'tRPC', territory: 'backend_fortress' },
  { tech_key: 'go', displayName: 'Go', territory: 'backend_fortress' },
  { tech_key: 'cpp', displayName: 'C++', territory: 'backend_fortress' },
  { tech_key: 'c', displayName: 'C', territory: 'backend_fortress' },
  { tech_key: 'gin', displayName: 'Gin', territory: 'backend_fortress' },
  { tech_key: 'echo', displayName: 'Echo', territory: 'backend_fortress' },
  { tech_key: 'fiber', displayName: 'Fiber', territory: 'backend_fortress' },
  { tech_key: 'grpc', displayName: 'gRPC', territory: 'backend_fortress' },
  { tech_key: 'python', displayName: 'Python', territory: 'backend_fortress' },
  { tech_key: 'fastapi', displayName: 'FastAPI', territory: 'backend_fortress' },
  { tech_key: 'django', displayName: 'Django', territory: 'backend_fortress' },
  { tech_key: 'flask', displayName: 'Flask', territory: 'backend_fortress' },
  { tech_key: 'rust', displayName: 'Rust', territory: 'backend_fortress' },
  { tech_key: 'axum', displayName: 'Axum', territory: 'backend_fortress' },
  { tech_key: 'actix', displayName: 'Actix', territory: 'backend_fortress' },
  { tech_key: 'java', displayName: 'Java', territory: 'backend_fortress' },
  { tech_key: 'spring', displayName: 'Spring', territory: 'backend_fortress' },
  { tech_key: 'rails', displayName: 'Rails', territory: 'backend_fortress' },
  // Data
  { tech_key: 'postgres', displayName: 'Postgres', territory: 'data_pipeline_zone' },
  { tech_key: 'mysql', displayName: 'MySQL', territory: 'data_pipeline_zone' },
  { tech_key: 'sqlite', displayName: 'SQLite', territory: 'data_pipeline_zone' },
  { tech_key: 'mongodb', displayName: 'MongoDB', territory: 'data_pipeline_zone' },
  { tech_key: 'redis', displayName: 'Redis', territory: 'data_pipeline_zone' },
  { tech_key: 'sql', displayName: 'SQL', territory: 'data_pipeline_zone' },
  { tech_key: 'dbt', displayName: 'dbt', territory: 'data_pipeline_zone' },
  { tech_key: 'prisma', displayName: 'Prisma', territory: 'data_pipeline_zone' },
  { tech_key: 'drizzle', displayName: 'Drizzle', territory: 'data_pipeline_zone' },
  { tech_key: 'supabase', displayName: 'Supabase', territory: 'data_pipeline_zone' },
  { tech_key: 'sqlalchemy', displayName: 'SQLAlchemy', territory: 'data_pipeline_zone' },
  { tech_key: 'pandas', displayName: 'pandas', territory: 'data_pipeline_zone' },
  { tech_key: 'numpy', displayName: 'NumPy', territory: 'data_pipeline_zone' },
  { tech_key: 'scikit_learn', displayName: 'scikit-learn', territory: 'data_pipeline_zone' },
  { tech_key: 'jupyter', displayName: 'Jupyter', territory: 'data_pipeline_zone' },
  { tech_key: 'duckdb', displayName: 'DuckDB', territory: 'data_pipeline_zone' },
  // Testing
  { tech_key: 'jest', displayName: 'Jest', territory: 'testing_lab' },
  { tech_key: 'vitest', displayName: 'Vitest', territory: 'testing_lab' },
  { tech_key: 'pytest', displayName: 'pytest', territory: 'testing_lab' },
  { tech_key: 'playwright', displayName: 'Playwright', territory: 'testing_lab' },
  { tech_key: 'cypress', displayName: 'Cypress', territory: 'testing_lab' },
  { tech_key: 'rspec', displayName: 'RSpec', territory: 'testing_lab' },
  { tech_key: 'testing_library', displayName: 'Testing Library', territory: 'testing_lab' },
  { tech_key: 'mocha', displayName: 'Mocha', territory: 'testing_lab' },
  { tech_key: 'ava', displayName: 'AVA', territory: 'testing_lab' },
  { tech_key: 'msw', displayName: 'MSW', territory: 'testing_lab' },
  { tech_key: 'tap', displayName: 'tap', territory: 'testing_lab' },
  { tech_key: 'junit', displayName: 'JUnit', territory: 'testing_lab' },
  // DevOps
  { tech_key: 'docker', displayName: 'Docker', territory: 'devops_harbor' },
  { tech_key: 'docker_compose', displayName: 'Docker Compose', territory: 'devops_harbor' },
  { tech_key: 'ghactions', displayName: 'GitHub Actions', territory: 'devops_harbor' },
  { tech_key: 'terraform', displayName: 'Terraform', territory: 'devops_harbor' },
  { tech_key: 'kubernetes', displayName: 'Kubernetes', territory: 'devops_harbor' },
  { tech_key: 'helm', displayName: 'Helm', territory: 'devops_harbor' },
  { tech_key: 'aws', displayName: 'AWS', territory: 'devops_harbor' },
  { tech_key: 'cloudflare', displayName: 'Cloudflare', territory: 'devops_harbor' },
  { tech_key: 'vercel', displayName: 'Vercel', territory: 'devops_harbor' },
  { tech_key: 'netlify', displayName: 'Netlify', territory: 'devops_harbor' },
  { tech_key: 'ansible', displayName: 'Ansible', territory: 'devops_harbor' },
  { tech_key: 'nginx', displayName: 'Nginx', territory: 'devops_harbor' },
  // Docs
  { tech_key: 'markdown', displayName: 'Markdown', territory: 'docs_library' },
  { tech_key: 'mdx', displayName: 'MDX', territory: 'docs_library' },
  { tech_key: 'jsdoc', displayName: 'JSDoc', territory: 'docs_library' },
  { tech_key: 'storybook', displayName: 'Storybook', territory: 'docs_library' },
  { tech_key: 'openapi', displayName: 'OpenAPI', territory: 'docs_library' },
  { tech_key: 'swagger', displayName: 'Swagger', territory: 'docs_library' },
  { tech_key: 'typedoc', displayName: 'TypeDoc', territory: 'docs_library' },
  { tech_key: 'docusaurus', displayName: 'Docusaurus', territory: 'docs_library' },
  { tech_key: 'mintlify', displayName: 'Mintlify', territory: 'docs_library' },
  { tech_key: 'changelog', displayName: 'Changelog', territory: 'docs_library' },
]

const map = new Map<string, PublicTechEntry>(PUBLIC_ENTRIES.map((e) => [e.tech_key, e]))

export function getPublicTech(tech_key: string): PublicTechEntry | undefined {
  return map.get(tech_key)
}

export function getAllPublicTech(): PublicTechEntry[] {
  return Array.from(map.values())
}
