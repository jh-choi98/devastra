# Phase 12: Final Polish + Cross-Doc Consistency

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/prd.md` · `/docs/flow.md` · `/docs/screens.md` · `/docs/data-schema.md` · `/docs/code-architecture.md` · `/docs/adr.md` · `/docs/tech-catalog.md` · `/docs/security-checklist.md`
- `/CLAUDE.md`
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 11's output:

- E2E + integration + unit tests are present and passing
- Reduced-motion guards in all motion components
- Cluster-level keyboard nav + screen-reader summary
- `npm run build` passes

Read the existing code:

- Run a global grep for any stale references to the pre-pivot world-map metaphor or Map/ components
- Check `package.json` for `name` and `description` fields

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Final polish pass. No new features — only consistency, cleanup, and sign-off.

### 1. Cross-codebase stale-reference sweep

```bash
# Should all be empty (or report only intentional historical mentions)

# Map/ directory imports
git grep -l "app/_components/Map/" -- ':!tasks/' ':!docs/' || true
# TerritoryDrawer imports
git grep -l "TerritoryDrawer" -- ':!tasks/' ':!docs/' || true
# Old field name `landmarkName`
git grep -l "landmarkName" -- ':!tasks/' ':!docs/' || true
# WeeklyRecap (pre-pivot template)
git grep -l "WeeklyRecap\b" -- ':!tasks/' ':!docs/' ':!lib/email/templates/WeeklyRecap' || true
# "Living world map" / "world map" phrasing in user-visible copy
git grep -l "world map" -- ':!tasks/' ':!docs/adr.md' || true
# "Level up" copy (compass-rejected)
git grep -l "Level up" -- ':!tasks/' ':!docs/' || true
```

Fix any unintended hits. If something is intentionally in `docs/adr.md` (the rename note, the ADR-7 amendment), leave it.

### 2. `package.json` metadata

```jsonc
{
  "name": "devastra",
  "description": "A developer skill constellation that lights up as you code.",
  // ... keep version, scripts, dependencies as-is ...
}
```

### 3. Tech catalog ↔ docs sync verification

Re-read `docs/tech-catalog.md` and verify it matches `features/territories/tech-catalog.ts` field-for-field:

- Every `tech_key` in the doc is in the ts file with the same `displayName`, `territory`, and detection `rules`.
- Every entry in the ts file is in the doc (no orphans either direction).
- 58 entries total.

If there's a mismatch, the ts file is the source of truth for code behavior; align the doc to it (CLAUDE.md rule). The `{x, y}` columns in the doc may be em-dashes `—` for entries without hand-tuned positions — this is acceptable for MVP because the renderer falls back to deterministic hash placement.

### 4. RLS verification on dev DB

Run the RLS isolation integration test once more against a real dev project:

```bash
npx vitest run tests/integration/rls-isolation.test.ts
```

Expected: all assertions pass — user A cannot read user B's private rows from any per-user table.

### 5. Migration applied verification

Verify that every Drizzle migration in `drizzle/migrations/` has been applied to the dev Supabase project. Re-running `npm run db:migrate` should be a no-op:

```bash
DIRECT_URL=$DIRECT_URL npm run db:migrate
# Expected output: "No migrations to run"
```

### 6. `tests/integration/__snapshots__` committed

Email template snapshots should be committed:

```bash
ls tests/integration/__snapshots__/email-templates.test.ts.snap 2>/dev/null \
  || ls tests/integration/email-templates.test.ts.snap 2>/dev/null
```

The exact location depends on Vitest's snapshot config; either nested under `__snapshots__/` or co-located with the test.

### 7. Documentation sync sweep

Reopen each doc and ensure the file paths it references actually exist:

```bash
# Helper: extract all `lib/...`, `app/...`, `features/...` paths from docs/*.md
# and verify each exists.
for path in $(grep -oE '(lib|app|features|docs|tests|scripts)/[a-zA-Z0-9/_.\-]+' docs/*.md | sort -u); do
  if [ ! -e "$path" ] && [ ! -d "$path" ]; then
    # Check if it's a wildcard/glob pattern
    case "$path" in
      *\**) continue ;;
      *) echo "MISSING: $path" ;;
    esac
  fi
done
```

Any "MISSING:" output should be investigated. False positives (e.g., a referenced future file that hasn't been built yet) are acceptable but should be noted.

### 8. Security checklist final pass

Mark remaining backlog items appropriately in `docs/security-checklist.md`:

- Items 11-20 (high priority): verify if completed in Phase 10; mark accordingly.
- Items 31-38 (backlog): leave as `[ ]` with their trigger conditions noted (no action required pre-launch).

### 9. README update

Verify `README.md` is up to date with the build process:

- Build command works.
- Test command works.
- Local dev steps in `docs/dev-setup.md` are accurate.

If anything has drifted (e.g., test command name changed), update README.

### 10. `.env.example` final check

```bash
# All env vars referenced in lib/ or app/ should be in .env.example
git grep -h "process\.env\." -- 'lib/' 'app/' 'features/' 'middleware.ts' \
  | grep -oE "process\.env\.[A-Z_]+" \
  | sort -u \
  | sed 's/^process\.env\.//' \
  > /tmp/env-used.txt

grep -oE "^[A-Z_]+=" .env.example | sed 's/=$//' | sort -u > /tmp/env-example.txt

# Compare; warn on missing-in-example
comm -23 /tmp/env-used.txt /tmp/env-example.txt
```

If any env var used in code is missing from `.env.example`, add it. Per ADR — never commit real secrets to `.env.example`.

### 11. Final smoke test

Run the full test suite end-to-end:

```bash
npm run build
npx vitest run
```

Expected: zero errors, zero failed tests.

If the integration tests require a Supabase dev project, ensure `.env.test` is present and the project is reachable. If not, integration tests skip cleanly per Phase 0 convention.

### 12. Update `tasks/1-pivot-mvp/index.json` task status

Once all the above passes, the task is complete. `scripts/run-phases.py` automatically marks the task as `completed` in `tasks/index.json` and sets the `completed_at` timestamp on exit. This phase just needs to:

1. Set phase 12 status to `"completed"`.
2. Confirm `tasks/1-pivot-mvp/index.json` has all 13 phases as `"completed"`.

## Acceptance Criteria

```bash
# Full build clean
npm run build

# Full test suite passes
npx vitest run

# No remaining stale references in source code
test -z "$(git grep -l 'app/_components/Map/' -- ':!tasks/' ':!docs/' 2>/dev/null)"
test -z "$(git grep -l 'TerritoryDrawer' -- ':!tasks/' ':!docs/' 2>/dev/null)"
test -z "$(git grep -l 'landmarkName' -- ':!tasks/' ':!docs/' 2>/dev/null)"

# package.json renamed
grep -q '"name": "devastra"' package.json

# All migrations applied (no-op rerun)
# (Manually: DIRECT_URL=$DIRECT_URL npm run db:migrate — expect "no migrations to run")

# Tech catalog count
test "$(grep -c "^  { tech_key:" features/territories/tech-catalog.ts)" -eq 58 || true
# Doc count
test "$(grep -cE '^\| \`[a-z_]+\` \| [A-Z]' docs/tech-catalog.md)" -ge 58 || true

# Security checklist has at least 30 items marked done
grep -c '^### .* \[x\]' docs/security-checklist.md | xargs -I{} test {} -ge 28
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 12 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **Do NOT introduce any new features in this phase.** If a missing feature is discovered, mark it as backlog in `docs/security-checklist.md` or a new follow-up task — do not patch it into Phase 12.
- **Visual design tuning** (cluster center positions, star colors, motion timings) is out of scope for this phase. Hand-tuned `{x, y}` coordinates in `docs/tech-catalog.md` are post-launch polish.
- **GitHub repo rename / domain acquisition / OAuth callback URL update** are ops tasks outside the code phases. Do not commit any production hostname assumptions beyond `devastra.app`.
- **The runner script (`scripts/run-phases.py`) commits each phase separately.** Phase 12's final commit captures the polish + the migration-no-op confirmation + any small fixes from the sweep. The runner then sets the task status to `completed`.
- **If the integration test suite fails because `.env.test` is missing**, that is acceptable — the dev DB integration is an env-dependent path. Document the skipped tests in the phase's `error_message` field only if they fail with a real bug; do NOT mark the phase as error for missing env.
- **No package.json version bump.** Version remains pre-1.0 throughout MVP (semantic versioning starts at v0.1 after the closed beta).
- **Do not commit `.env.local` or any actual secrets.** Confirm via `git status` before commit.
- **Final check before declaring done**: open the local dev server (`npm run dev`), hit `http://localhost:3000`, sign in via mock OAuth, verify the constellation renders and a drawer opens. This is the human ground-truth smoke test that complements the E2E spec.
