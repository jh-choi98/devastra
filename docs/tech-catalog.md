# Tech Catalog — DevAstra

**Scope of this doc:** the 58-entry tech catalog that drives the classifier in `features/territories/tech-catalog.ts`. This file is the source of truth. The TypeScript constant must match it exactly. See `docs/code-architecture.md` §Features → territories for how the classifier consumes this catalog. See `docs/screens.md` §C.4 Star visual for how `display_name` and `{x, y}` are rendered.

**Post-pivot naming:** `display_name` is the plain technology name (e.g. `React`, `Docker`, `Postgres`) — no medieval/architectural metaphor (`Forge`, `Bastion`, etc.). The constellation renderer uses this string as the star label.

**Star position fields `{x, y}`:** normalized coordinates within the cluster (range 0.0–1.0). Filled during the visual design pass; missing values fall back to an algorithmic placement. Hand-tuned positions are preferred for visual quality (`docs/adr.md` ADR-26).

## Detection rule grammar

| Rule prefix | Matches on |
|---|---|
| `ext: .ts .tsx` | file extension of any path in `activities.raw.file_paths` |
| `path: .github/workflows/` | path prefix of any entry in `activities.raw.file_paths` |
| `filename: Dockerfile` | exact filename (basename) of any entry in `activities.raw.file_paths` |
| `packageJson: react` | package present in the `dependencies` or `devDependencies` of any committed `package.json` |
| `requirementsTxt: django` | package present in a committed `requirements.txt` |
| `goMod: gin-gonic/gin` | module path present in a committed `go.mod` |
| `gemfile: rails` | gem name present in a committed `Gemfile` |
| `cargoToml: serde` | crate name present in a committed `Cargo.toml` |

A single activity may match multiple rules → multiple `tech_key` values (multi-label). Drawer's `Why is this lit?` expansion translates the matched rule into product language (`docs/flow.md` Sub-flow D, `docs/screens.md` §D.1):

| Rule | Product-facing copy |
|---|---|
| `ext: .ts .tsx` | "TypeScript files" |
| `path: .github/workflows/` | "GitHub Actions workflows" |
| `filename: Dockerfile` | "Docker setup" |
| `packageJson: react` | "package.json with React" |
| `requirementsTxt: django` | "requirements.txt with Django" |
| `goMod: gin-gonic/gin` | "go.mod with Gin" |
| `gemfile: rails` | "Gemfile with Rails" |
| `cargoToml: serde` | "Cargo.toml with serde" |

---

## Catalog table

### Frontend cluster (`frontend_land`)

| tech_key | display_name | territory | detection rules | x | y |
|---|---|---|---|---|---|
| `typescript` | TypeScript | `frontend_land` | `ext: .ts .tsx` | — | — |
| `javascript` | JavaScript | `frontend_land` | `ext: .js .jsx .mjs .cjs` | — | — |
| `react` | React | `frontend_land` | `packageJson: react` | — | — |
| `nextjs` | Next.js | `frontend_land` | `packageJson: next` | — | — |
| `vue` | Vue | `frontend_land` | `packageJson: vue` | — | — |
| `svelte` | Svelte | `frontend_land` | `packageJson: svelte` | — | — |
| `angular` | Angular | `frontend_land` | `packageJson: @angular/core` | — | — |
| `tailwind` | Tailwind | `frontend_land` | `packageJson: tailwindcss` | — | — |
| `css` | CSS | `frontend_land` | `ext: .css` | — | — |
| `sass` | Sass | `frontend_land` | `ext: .scss .sass` | — | — |
| `vite` | Vite | `frontend_land` | `packageJson: vite` | — | — |
| `webpack` | Webpack | `frontend_land` | `packageJson: webpack` | — | — |

### Backend cluster (`backend_fortress`)

| tech_key | display_name | territory | detection rules | x | y |
|---|---|---|---|---|---|
| `nodejs` | Node.js | `backend_fortress` | `filename: package.json` | — | — |
| `express` | Express | `backend_fortress` | `packageJson: express` | — | — |
| `fastify` | Fastify | `backend_fortress` | `packageJson: fastify` | — | — |
| `nestjs` | NestJS | `backend_fortress` | `packageJson: @nestjs/core` | — | — |
| `go` | Go | `backend_fortress` | `ext: .go` | — | — |
| `gin` | Gin | `backend_fortress` | `goMod: gin-gonic/gin` | — | — |
| `python` | Python | `backend_fortress` | `ext: .py` | — | — |
| `fastapi` | FastAPI | `backend_fortress` | `requirementsTxt: fastapi` | — | — |
| `django` | Django | `backend_fortress` | `requirementsTxt: django` | — | — |
| `flask` | Flask | `backend_fortress` | `requirementsTxt: flask` | — | — |
| `rust` | Rust | `backend_fortress` | `ext: .rs` | — | — |
| `java` | Java | `backend_fortress` | `ext: .java` | — | — |

### Data cluster (`data_pipeline_zone`)

| tech_key | display_name | territory | detection rules | x | y |
|---|---|---|---|---|---|
| `postgres` | Postgres | `data_pipeline_zone` | `packageJson: pg` | — | — |
| `mysql` | MySQL | `data_pipeline_zone` | `packageJson: mysql2` | — | — |
| `sqlite` | SQLite | `data_pipeline_zone` | `packageJson: better-sqlite3` | — | — |
| `mongodb` | MongoDB | `data_pipeline_zone` | `packageJson: mongoose` | — | — |
| `redis` | Redis | `data_pipeline_zone` | `packageJson: ioredis` | — | — |
| `sql` | SQL | `data_pipeline_zone` | `ext: .sql` | — | — |
| `dbt` | dbt | `data_pipeline_zone` | `filename: dbt_project.yml` | — | — |
| `prisma` | Prisma | `data_pipeline_zone` | `packageJson: prisma` | — | — |

### Testing cluster (`testing_lab`)

| tech_key | display_name | territory | detection rules | x | y |
|---|---|---|---|---|---|
| `jest` | Jest | `testing_lab` | `packageJson: jest` | — | — |
| `vitest` | Vitest | `testing_lab` | `packageJson: vitest` | — | — |
| `pytest` | pytest | `testing_lab` | `requirementsTxt: pytest` | — | — |
| `playwright` | Playwright | `testing_lab` | `packageJson: @playwright/test` | — | — |
| `cypress` | Cypress | `testing_lab` | `packageJson: cypress` | — | — |
| `rspec` | RSpec | `testing_lab` | `gemfile: rspec` | — | — |

### DevOps cluster (`devops_harbor`)

| tech_key | display_name | territory | detection rules | x | y |
|---|---|---|---|---|---|
| `docker` | Docker | `devops_harbor` | `filename: Dockerfile` | — | — |
| `ghactions` | GitHub Actions | `devops_harbor` | `path: .github/workflows/` | — | — |
| `terraform` | Terraform | `devops_harbor` | `ext: .tf` | — | — |
| `kubernetes` | Kubernetes | `devops_harbor` | `path: k8s/` | — | — |
| `aws` | AWS | `devops_harbor` | `packageJson: aws-cdk-lib` | — | — |
| `vercel` | Vercel | `devops_harbor` | `filename: vercel.json` | — | — |
| `nginx` | Nginx | `devops_harbor` | `filename: nginx.conf` | — | — |

### Docs cluster (`docs_library`)

| tech_key | display_name | territory | detection rules | x | y |
|---|---|---|---|---|---|
| `markdown` | Markdown | `docs_library` | `ext: .md` | — | — |
| `mdx` | MDX | `docs_library` | `ext: .mdx` | — | — |
| `jsdoc` | JSDoc | `docs_library` | `filename: jsdoc.json` | — | — |
| `storybook` | Storybook | `docs_library` | `path: .storybook/` | — | — |
| `openapi` | OpenAPI | `docs_library` | `filename: openapi.yaml` | — | — |

---

## Cluster labels (UI)

In the constellation renderer, each cluster's label uses a short neutral name (not the `territory_type` enum value):

| territory_type | UI cluster label |
|---|---|
| `frontend_land` | Frontend |
| `backend_fortress` | Backend |
| `data_pipeline_zone` | Data |
| `testing_lab` | Testing |
| `devops_harbor` | DevOps |
| `docs_library` | Docs |

---

## Multi-label reminder

A single activity may produce multiple `tech_key` values. For example, a commit that adds `src/api/auth.ts` and touches `package.json` with `express` added as a dependency would produce: `typescript`, `nodejs`, `express` — all three in one pass. This is by design (see `docs/adr.md` ADR-2 and `docs/data-schema.md` §Activity_Territories).

When implementing the classifier, evaluate all 58 rules against each activity and emit one `ClassificationResult` per matched `tech_key`.

---

## Star positions `{x, y}` — design pass

`x` and `y` are normalized values in `[0, 1]` within the cluster's local coordinate space. The constellation renderer translates them into screen coordinates using viewport-specific cluster center positions (separate sets for OG 1.9:1 / desktop / mobile 9:16).

**Design principles for the position pass:**

1. **Globally fixed.** All users' `react` star is at the same `(x, y)`. The visual difference between users is whether each star is lit, how bright, and how lines connect.
2. **No reshuffling on growth.** Adding new `tech_key` rows to this catalog must not move existing stars. Position the new tech in unclaimed space.
3. **Hero-friendly clustering.** The 1–2 highest-weight stars per cluster (visually anchored at lit-stars subset) should sit slightly above the cluster center for label legibility (`docs/screens.md` §C.3 Cluster visual).
4. **Avoid edge collision.** Stars at `x ∈ {0, 1}` or `y ∈ {0, 1}` may clip into adjacent cluster bounds at narrow viewports. Keep the safe area `[0.1, 0.9]`.
5. **Connection-line clarity.** MST among lit stars must produce non-crossing or minimally crossing lines for common skill combinations (e.g. `typescript` + `react` + `nextjs` should form a clean triangle).

When `x` or `y` is `—` (em-dash), the renderer falls back to deterministic hash-based placement keyed on `tech_key`. The MVP launch goal is to fill all 58 positions by hand before launch.

---

## How to add a new tech

1. Choose a `tech_key`: lowercase, no hyphens (use underscores if needed), globally unique.
2. Choose a `display_name`: the plain technology name with normal casing (e.g. `Next.js`, `Postgres`, `pytest`). Avoid metaphors.
3. Write the detection rule using the grammar above. Prefer specific rules over broad ones (`packageJson: @nestjs/core` over `ext: .ts`).
4. Pick a `(x, y)` within the cluster's safe area `[0.1, 0.9]²`. Verify it does not collide with existing stars in the same cluster.
5. Add the row to the relevant cluster section in this doc.
6. Add the corresponding entry to `features/territories/tech-catalog.ts` in the same commit.
7. Add unit tests in `tests/unit/` covering the new rule.
8. No additional renderer change is required — the star renders from catalog data alone.
