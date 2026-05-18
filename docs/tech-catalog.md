# Tech Catalog — DevAstra

**Scope of this doc:** the tech catalog that drives the classifier in `features/territories/tech-catalog.ts`. This file is the source of truth. The TypeScript constant must match it exactly. See `docs/code-architecture.md` §Features → territories for how the classifier consumes this catalog. See `docs/screens.md` §C.4 Star visual for how `display_name` and `{x, y}` are rendered.

**Post-pivot naming:** `display_name` is the plain technology name (e.g. `React`, `Docker`, `Postgres`) — no medieval/architectural metaphor (`Forge`, `Bastion`, etc.). The constellation renderer uses this string as the star label.

**Star position fields `{x, y}`:** normalized coordinates within the cluster (range 0.0–1.0). Filled during the visual design pass; missing values fall back to an algorithmic placement. Hand-tuned positions are preferred for visual quality (`docs/adr.md` ADR-26).

## Detection rule grammar

| Rule prefix                       | Matches on                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `ext: .ts .tsx`                   | file extension of any path in `activities.raw.file_paths`                                  |
| `path: .github/workflows/`        | path prefix of any entry in `activities.raw.file_paths`                                    |
| `filename: Dockerfile`            | exact filename (basename) of any entry in `activities.raw.file_paths`                      |
| `packageJson: react`              | package present in the `dependencies` or `devDependencies` of any committed `package.json` |
| `requirementsTxt: django`         | package present in a committed `requirements.txt`                                          |
| `pyprojectToml: fastapi`          | package present in a committed `pyproject.toml`                                            |
| `goMod: gin-gonic/gin`            | module path present in a committed `go.mod`                                                |
| `pomXml: spring-boot-starter-web` | artifact present in a committed Maven `pom.xml`                                            |
| `gradle: spring-boot-starter-web` | artifact present in a committed Gradle build file                                          |
| `gemfile: rails`                  | gem name present in a committed `Gemfile`                                                  |
| `cargoToml: serde`                | crate name present in a committed `Cargo.toml`                                             |

A single activity may match multiple rules → multiple `tech_key` values (multi-label). Drawer's `Why is this lit?` expansion translates the matched rule into product language (`docs/flow.md` Sub-flow D, `docs/screens.md` §D.1):

| Rule                              | Product-facing copy            |
| --------------------------------- | ------------------------------ |
| `ext: .ts .tsx`                   | "TypeScript files"             |
| `path: .github/workflows/`        | "GitHub Actions workflows"     |
| `filename: Dockerfile`            | "Docker setup"                 |
| `packageJson: react`              | "package.json with React"      |
| `requirementsTxt: django`         | "requirements.txt with Django" |
| `pyprojectToml: fastapi`          | "pyproject.toml with FastAPI"  |
| `goMod: gin-gonic/gin`            | "go.mod with Gin"              |
| `pomXml: spring-boot-starter-web` | "pom.xml with Spring"          |
| `gradle: spring-boot-starter-web` | "Gradle with Spring"           |
| `gemfile: rails`                  | "Gemfile with Rails"           |
| `cargoToml: serde`                | "Cargo.toml with serde"        |

---

## Catalog table

### Frontend cluster (`frontend_land`)

| tech_key         | display_name   | territory       | detection rules                      | x   | y   |
| ---------------- | -------------- | --------------- | ------------------------------------ | --- | --- |
| `typescript`     | TypeScript     | `frontend_land` | `ext: .ts .tsx`                      | —   | —   |
| `javascript`     | JavaScript     | `frontend_land` | `ext: .js .jsx .mjs .cjs`            | —   | —   |
| `react`          | React          | `frontend_land` | `packageJson: react`                 | —   | —   |
| `nextjs`         | Next.js        | `frontend_land` | `packageJson: next`                  | —   | —   |
| `vue`            | Vue            | `frontend_land` | `packageJson: vue`                   | —   | —   |
| `svelte`         | Svelte         | `frontend_land` | `packageJson: svelte`                | —   | —   |
| `angular`        | Angular        | `frontend_land` | `packageJson: @angular/core`         | —   | —   |
| `tailwind`       | Tailwind       | `frontend_land` | `packageJson: tailwindcss`           | —   | —   |
| `css`            | CSS            | `frontend_land` | `ext: .css`                          | —   | —   |
| `sass`           | Sass           | `frontend_land` | `ext: .scss .sass`                   | —   | —   |
| `vite`           | Vite           | `frontend_land` | `packageJson: vite`                  | —   | —   |
| `webpack`        | Webpack        | `frontend_land` | `packageJson: webpack`               | —   | —   |
| `astro`          | Astro          | `frontend_land` | `packageJson: astro`                 | —   | —   |
| `remix`          | Remix          | `frontend_land` | `packageJson: @remix-run/react`      | —   | —   |
| `solidjs`        | SolidJS        | `frontend_land` | `packageJson: solid-js`              | —   | —   |
| `tanstack_query` | TanStack Query | `frontend_land` | `packageJson: @tanstack/react-query` | —   | —   |

### Backend cluster (`backend_fortress`)

| tech_key  | display_name | territory          | detection rules                                                      | x   | y   |
| --------- | ------------ | ------------------ | -------------------------------------------------------------------- | --- | --- |
| `nodejs`  | Node.js      | `backend_fortress` | `filename: package.json`                                             | —   | —   |
| `express` | Express      | `backend_fortress` | `packageJson: express`                                               | —   | —   |
| `fastify` | Fastify      | `backend_fortress` | `packageJson: fastify`                                               | —   | —   |
| `nestjs`  | NestJS       | `backend_fortress` | `packageJson: @nestjs/core`                                          | —   | —   |
| `hono`    | Hono         | `backend_fortress` | `packageJson: hono`                                                  | —   | —   |
| `trpc`    | tRPC         | `backend_fortress` | `packageJson: @trpc/server`                                          | —   | —   |
| `go`      | Go           | `backend_fortress` | `ext: .go`                                                           | —   | —   |
| `cpp`     | C++          | `backend_fortress` | `ext: .cpp`; `ext: .cc`; `ext: .cxx`; `ext: .hpp`; `ext: .hh`; `ext: .hxx` | —   | —   |
| `c`       | C            | `backend_fortress` | `ext: .c`; `ext: .h`                                                 | —   | —   |
| `gin`     | Gin          | `backend_fortress` | `goMod: gin-gonic/gin`                                               | —   | —   |
| `echo`    | Echo         | `backend_fortress` | `goMod: labstack/echo`                                               | —   | —   |
| `fiber`   | Fiber        | `backend_fortress` | `goMod: gofiber/fiber`                                               | —   | —   |
| `grpc`    | gRPC         | `backend_fortress` | `goMod: google.golang.org/grpc`; `packageJson: @grpc/grpc-js`        | —   | —   |
| `python`  | Python       | `backend_fortress` | `ext: .py`                                                           | —   | —   |
| `fastapi` | FastAPI      | `backend_fortress` | `requirementsTxt: fastapi`; `pyprojectToml: fastapi`                 | —   | —   |
| `django`  | Django       | `backend_fortress` | `requirementsTxt: django`; `pyprojectToml: django`                   | —   | —   |
| `flask`   | Flask        | `backend_fortress` | `requirementsTxt: flask`; `pyprojectToml: flask`                     | —   | —   |
| `rust`    | Rust         | `backend_fortress` | `ext: .rs`                                                           | —   | —   |
| `axum`    | Axum         | `backend_fortress` | `cargoToml: axum`                                                    | —   | —   |
| `actix`   | Actix        | `backend_fortress` | `cargoToml: actix-web`                                               | —   | —   |
| `java`    | Java         | `backend_fortress` | `ext: .java`                                                         | —   | —   |
| `spring`  | Spring       | `backend_fortress` | `pomXml: spring-boot-starter-web`; `gradle: spring-boot-starter-web` | —   | —   |
| `rails`   | Rails        | `backend_fortress` | `gemfile: rails`                                                     | —   | —   |

### Data cluster (`data_pipeline_zone`)

| tech_key       | display_name | territory            | detection rules                                                           | x   | y   |
| -------------- | ------------ | -------------------- | ------------------------------------------------------------------------- | --- | --- |
| `postgres`     | Postgres     | `data_pipeline_zone` | `packageJson: pg`                                                         | —   | —   |
| `mysql`        | MySQL        | `data_pipeline_zone` | `packageJson: mysql2`                                                     | —   | —   |
| `sqlite`       | SQLite       | `data_pipeline_zone` | `packageJson: better-sqlite3`                                             | —   | —   |
| `mongodb`      | MongoDB      | `data_pipeline_zone` | `packageJson: mongoose`                                                   | —   | —   |
| `redis`        | Redis        | `data_pipeline_zone` | `packageJson: ioredis`                                                    | —   | —   |
| `sql`          | SQL          | `data_pipeline_zone` | `ext: .sql`                                                               | —   | —   |
| `dbt`          | dbt          | `data_pipeline_zone` | `filename: dbt_project.yml`                                               | —   | —   |
| `prisma`       | Prisma       | `data_pipeline_zone` | `packageJson: prisma`                                                     | —   | —   |
| `drizzle`      | Drizzle      | `data_pipeline_zone` | `packageJson: drizzle-orm`                                                | —   | —   |
| `supabase`     | Supabase     | `data_pipeline_zone` | `packageJson: @supabase/supabase-js`                                      | —   | —   |
| `sqlalchemy`   | SQLAlchemy   | `data_pipeline_zone` | `requirementsTxt: sqlalchemy`; `pyprojectToml: sqlalchemy`                | —   | —   |
| `pandas`       | pandas       | `data_pipeline_zone` | `requirementsTxt: pandas`; `pyprojectToml: pandas`                        | —   | —   |
| `numpy`        | NumPy        | `data_pipeline_zone` | `requirementsTxt: numpy`; `pyprojectToml: numpy`                          | —   | —   |
| `scikit_learn` | scikit-learn | `data_pipeline_zone` | `requirementsTxt: scikit-learn`; `pyprojectToml: scikit-learn`            | —   | —   |
| `jupyter`      | Jupyter      | `data_pipeline_zone` | `ext: .ipynb`; `requirementsTxt: jupyter`; `pyprojectToml: jupyter`       | —   | —   |
| `duckdb`       | DuckDB       | `data_pipeline_zone` | `packageJson: duckdb`; `requirementsTxt: duckdb`; `pyprojectToml: duckdb` | —   | —   |

### Testing cluster (`testing_lab`)

| tech_key          | display_name    | territory     | detection rules                                  | x   | y   |
| ----------------- | --------------- | ------------- | ------------------------------------------------ | --- | --- |
| `jest`            | Jest            | `testing_lab` | `packageJson: jest`                              | —   | —   |
| `vitest`          | Vitest          | `testing_lab` | `packageJson: vitest`                            | —   | —   |
| `pytest`          | pytest          | `testing_lab` | `requirementsTxt: pytest`                        | —   | —   |
| `playwright`      | Playwright      | `testing_lab` | `packageJson: @playwright/test`                  | —   | —   |
| `cypress`         | Cypress         | `testing_lab` | `packageJson: cypress`                           | —   | —   |
| `rspec`           | RSpec           | `testing_lab` | `gemfile: rspec`                                 | —   | —   |
| `testing_library` | Testing Library | `testing_lab` | `packageJson: @testing-library/react`            | —   | —   |
| `mocha`           | Mocha           | `testing_lab` | `packageJson: mocha`                             | —   | —   |
| `ava`             | AVA             | `testing_lab` | `packageJson: ava`                               | —   | —   |
| `msw`             | MSW             | `testing_lab` | `packageJson: msw`                               | —   | —   |
| `tap`             | tap             | `testing_lab` | `packageJson: tap`                               | —   | —   |
| `junit`           | JUnit           | `testing_lab` | `pomXml: junit-jupiter`; `gradle: junit-jupiter` | —   | —   |

### DevOps cluster (`devops_harbor`)

| tech_key         | display_name   | territory       | detection rules                                                             | x   | y   |
| ---------------- | -------------- | --------------- | --------------------------------------------------------------------------- | --- | --- |
| `docker`         | Docker         | `devops_harbor` | `filename: Dockerfile`                                                      | —   | —   |
| `docker_compose` | Docker Compose | `devops_harbor` | `filename: docker-compose.yml docker-compose.yaml compose.yml compose.yaml` | —   | —   |
| `ghactions`      | GitHub Actions | `devops_harbor` | `path: .github/workflows/`                                                  | —   | —   |
| `terraform`      | Terraform      | `devops_harbor` | `ext: .tf`                                                                  | —   | —   |
| `kubernetes`     | Kubernetes     | `devops_harbor` | `path: k8s/ kubernetes/`                                                    | —   | —   |
| `helm`           | Helm           | `devops_harbor` | `filename: Chart.yaml`; `path: charts/`                                     | —   | —   |
| `aws`            | AWS            | `devops_harbor` | `packageJson: aws-cdk-lib`                                                  | —   | —   |
| `cloudflare`     | Cloudflare     | `devops_harbor` | `packageJson: wrangler`; `filename: wrangler.toml`                          | —   | —   |
| `vercel`         | Vercel         | `devops_harbor` | `filename: vercel.json`                                                     | —   | —   |
| `netlify`        | Netlify        | `devops_harbor` | `filename: netlify.toml`                                                    | —   | —   |
| `ansible`        | Ansible        | `devops_harbor` | `path: ansible/ playbooks/`                                                 | —   | —   |
| `nginx`          | Nginx          | `devops_harbor` | `filename: nginx.conf`                                                      | —   | —   |

### Docs cluster (`docs_library`)

| tech_key     | display_name | territory      | detection rules                                   | x   | y   |
| ------------ | ------------ | -------------- | ------------------------------------------------- | --- | --- |
| `markdown`   | Markdown     | `docs_library` | `ext: .md`                                        | —   | —   |
| `mdx`        | MDX          | `docs_library` | `ext: .mdx`                                       | —   | —   |
| `jsdoc`      | JSDoc        | `docs_library` | `filename: jsdoc.json`                            | —   | —   |
| `storybook`  | Storybook    | `docs_library` | `path: .storybook/`                               | —   | —   |
| `openapi`    | OpenAPI      | `docs_library` | `filename: openapi.yaml`                          | —   | —   |
| `swagger`    | Swagger      | `docs_library` | `filename: swagger.yaml swagger.yml swagger.json` | —   | —   |
| `typedoc`    | TypeDoc      | `docs_library` | `packageJson: typedoc`                            | —   | —   |
| `docusaurus` | Docusaurus   | `docs_library` | `packageJson: @docusaurus/core`                   | —   | —   |
| `mintlify`   | Mintlify     | `docs_library` | `filename: mint.json`                             | —   | —   |
| `changelog`  | Changelog    | `docs_library` | `filename: CHANGELOG.md CHANGELOG.mdx`            | —   | —   |

---

## Cluster labels (UI)

In the constellation renderer, each cluster's label uses a short neutral name (not the `territory_type` enum value):

| territory_type       | UI cluster label |
| -------------------- | ---------------- |
| `frontend_land`      | Frontend         |
| `backend_fortress`   | Backend          |
| `data_pipeline_zone` | Data             |
| `testing_lab`        | Testing          |
| `devops_harbor`      | DevOps           |
| `docs_library`       | Docs             |

---

## Multi-label reminder

A single activity may produce multiple `tech_key` values. For example, a commit that adds `src/api/auth.ts` and touches `package.json` with `express` added as a dependency would produce: `typescript`, `nodejs`, `express` — all three in one pass. This is by design (see `docs/adr.md` ADR-2 and `docs/data-schema.md` §Activity_Territories).

When implementing the classifier, evaluate all catalog rules against each activity and emit one `ClassificationResult` per matched `tech_key`. Framework dependency evidence should also light the underlying language/runtime star when the catalog has one: `go.mod` with Gin lights `gin` + `go`, `requirements.txt` with FastAPI lights `fastapi` + `python`, `Cargo.toml` with Axum lights `axum` + `rust`, and backend `package.json` frameworks such as Express light `express` + `nodejs`. If the repository primary language has a catalog star in the same cluster as matched dependency evidence, emit that language star too; for example, React in a TypeScript repo lights `react` + `typescript`. Path context is a stronger signal than generic language extension fallback. For example, `server/routes/user.ts` should grow Backend / Node.js, while `components/Button.tsx` should grow Frontend / TypeScript.

Evidence order is: path context and explicit catalog rules → manifest/dependency evidence → primary-language fallback → generic extension fallback. This keeps TypeScript, JavaScript, Python, Shell, and SQL from defaulting into the wrong cluster when the file path or manifest clearly indicates backend, data, testing, DevOps, or docs work.

---

## Star positions `{x, y}` — design pass

`x` and `y` are normalized values in `[0, 1]` within the cluster's local coordinate space. The constellation renderer translates them into screen coordinates using viewport-specific cluster center positions (separate sets for OG 1.9:1 / desktop / mobile 9:16).

**Design principles for the position pass:**

1. **Globally fixed.** All users' `react` star is at the same `(x, y)`. The visual difference between users is whether each star is lit, how bright, and how lines connect.
2. **No reshuffling on growth.** Adding new `tech_key` rows to this catalog must not move existing stars. Position the new tech in unclaimed space.
3. **Hero-friendly clustering.** The 1–2 highest-weight stars per cluster (visually anchored at lit-stars subset) should sit slightly above the cluster center for label legibility (`docs/screens.md` §C.3 Cluster visual).
4. **Avoid edge collision.** Stars at `x ∈ {0, 1}` or `y ∈ {0, 1}` may clip into adjacent cluster bounds at narrow viewports. Keep the safe area `[0.1, 0.9]`.
5. **Connection-line clarity.** MST among lit stars must produce non-crossing or minimally crossing lines for common skill combinations (e.g. `typescript` + `react` + `nextjs` should form a clean triangle).

When `x` or `y` is `—` (em-dash), the renderer falls back to deterministic hash-based placement keyed on `tech_key`. The MVP launch goal is to fill catalog positions by hand before launch.

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
