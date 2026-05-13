# Phase 0: Documentation Refinement

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/prd.md`
- `/docs/flow.md`
- `/docs/data-schema.md`
- `/docs/code-architecture.md`
- `/docs/adr.md`

This is the first phase of the MVP build, so there is no previous phase output to verify.

## Work

Add three new documents that will be referenced by every subsequent phase. Do NOT modify the five existing docs unless you spot a real inconsistency among them.

### 1. `/docs/dev-setup.md`

Local development setup guide. Cover:

- Required tools (Node 20+, pnpm or npm, Docker for local Supabase optional)
- `.env.local` template variable names and where each is obtained (Supabase dashboard, GitHub OAuth App, Inngest, Resend, Sentry, PostHog)
- How to run the Next.js dev server (`npm run dev`)
- How to run Drizzle migrations against the local/dev Supabase project (`npm run db:generate`, `npm run db:migrate`)
- How to run Inngest dev server (`npx inngest-cli dev`) and how the local Next.js app connects to it
- How to run tests (unit, integration, e2e)
- How to preview the React Email templates locally (`npx react-email dev`)
- The expected `.env.example` filename and the discipline of never committing `.env.local`

### 2. `/docs/tech-catalog.md`

Specification of the 50-tech catalog used by the classifier. This is the source of truth for what each `tech_key` represents; the actual code constant in `features/territories/tech-catalog.ts` (created in Phase 5) must match this doc.

Structure as a single table with columns: `tech_key | display_name (landmark name) | territory | detection rules`.

Detection rule grammar (used in the doc):

- `ext: .ts .tsx` — match by file extension on commit `file_paths`
- `path: .github/workflows/` — match by path prefix
- `filename: Dockerfile` — match by exact filename
- `packageJson: react` — package present in any committed `package.json` dependencies
- `requirementsTxt: django` — package present in `requirements.txt`
- `goMod: gin-gonic/gin` — module present in `go.mod`
- `gemfile: rails` — gem present in `Gemfile`
- `cargoToml: serde` — crate present in `Cargo.toml`

Provide 50 entries spread across the six territories so the catalog is balanced. Suggested distribution (final mix at your discretion as long as totals add up):

- **Frontend Land (~12):** typescript, javascript, react, nextjs, vue, svelte, angular, tailwind, css, sass, vite, webpack
- **Backend Fortress (~12):** nodejs, express, fastify, nestjs, go, gin, python, fastapi, django, flask, rust, java
- **Data Pipeline Zone (~8):** postgres, mysql, sqlite, mongodb, redis, sql, dbt, prisma
- **Testing Lab (~6):** jest, vitest, pytest, playwright, cypress, rspec
- **DevOps Harbor (~7):** docker, ghactions, terraform, kubernetes, aws, vercel, nginx
- **Docs Library (~5):** markdown, mdx, jsdoc, storybook, openapi

Use evocative landmark names matching the territory's visual metaphor (Backend Fortress → "Go Watchtower", "Rust Bastion", "Python Spire"; Frontend Land → "TypeScript Pavilion", "React Forge"; Data Pipeline Zone → "Postgres Reservoir", "SQL Aqueduct"; DevOps Harbor → "Container Dock", "CI Lighthouse"; Testing Lab → "Jest Workshop", "Playwright Stage"; Docs Library → "Markdown Archive", "MDX Atrium"). Names must be in English.

Conclude the doc with a "When matching, a single activity may produce multiple tech_keys (multi-label)" reminder and a "How to add a new tech" subsection.

### 3. `/CLAUDE.md` (project root)

Rules for any future AI coding session in this repo. Write in English. Cover:

- **Language policy:** All code, comments, identifiers, commit messages, and any new documentation must be written in English. Korean is acceptable only in conversational responses to the user.
- **Server-only discipline:** Every file under `lib/db/`, `lib/github/`, `lib/email/`, `lib/og/`, `features/sync/`, `features/recap/`, and `features/territories/rules.ts` MUST start with `import 'server-only'`. Client components MUST NOT import from these paths.
- **Schema as source of truth:** Drizzle schemas in `lib/db/schema/` are the source of truth for the DB. `docs/data-schema.md` describes intent; if the two disagree, update the doc.
- **Source-agnostic columns:** `activities.source`, `activities.external_id`, `repositories.source`, `repositories.external_repo_id` are used throughout. Never reintroduce `github_*` names in these tables (see ADR-16).
- **`raw` JSONB restriction:** `activities.raw` only ever contains `file_paths`, `additions`, `deletions`, `github_url`. Never commit messages, diffs, PR titles, or PR bodies (see ADR-9).
- **Private repo guard:** `MVP_INCLUDE_PRIVATE = false` is hardcoded in `features/sync/sources/github.ts`. Never remove without explicit user instruction (see ADR-11).
- **Time zone discipline:** All DB columns and aggregation use UTC. Localization happens only at display layer (see ADR-14).
- **Idempotency:** Every Inngest step must be idempotent. Use UPSERT on all writes (see ADR-5).
- **Cross-doc cross-link:** When updating one doc, search for references in other docs and update accordingly.
- **Reference paths to read** before any non-trivial task: the five files under `/docs/`.

Keep `CLAUDE.md` to ~80-120 lines. Not a tutorial — a checklist for an AI agent that has already read `/docs/`.

## Acceptance Criteria

```bash
test -f docs/dev-setup.md && test -f docs/tech-catalog.md && test -f CLAUDE.md
grep -q "tech_key" docs/tech-catalog.md
grep -q "server-only" CLAUDE.md
grep -q "MVP_INCLUDE_PRIVATE" CLAUDE.md
wc -l docs/tech-catalog.md | awk '{ if ($1 < 70) exit 1 }'
```

## How to verify AC

Run the AC commands above. If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`.

If you cannot make them pass after 3 attempts, set status to `"error"` and write the failure reason in the phase's `"error_message"` field in `/tasks/0-mvp/index.json`.

## Notes

- Do not modify the five existing `/docs/*.md` files unless you find a factual inconsistency among them. If you do change one, note the change in a single comment line so the auto-generated `docs-diff.md` captures it cleanly.
- Do not create any source code in this phase. This phase is documentation only.
- Do not invent new ADRs. If you discover a missing decision, surface it in a comment at the bottom of `CLAUDE.md` under a "## Open questions" heading rather than silently deciding.
- Use English only. Korean text in these files will cause downstream phases to drift.
