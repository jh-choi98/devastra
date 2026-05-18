# Phase 0: Stellarium Docs Commit

## Preparation

First, read the documents below to understand the redesign in full:

- `/CLAUDE.md` — agent compliance checklist (modified)
- `/docs/prd.md` — product mission (unchanged this task)
- `/docs/flow.md` — user flows (unchanged this task)
- `/docs/screens.md` — §C Canvas rewritten, §I.3 refined
- `/docs/data-schema.md` — unchanged this task (zero schema delta)
- `/docs/code-architecture.md` — Constellation directory tree, deps, env vars, observability all extended
- `/docs/adr.md` — ADR-61, ADR-62, ADR-63 appended
- `/docs/security-checklist.md` — section "Constellation WebGL renderer launch" with W1–W9 appended
- `/docs/dev-setup.md` — `CONSTELLATION_RENDERER` + `ENABLE_DEV_MAP` env vars added
- `/docs/tech-catalog.md` — for context only (unchanged this task)
- `/docs/legal/privacy.md`, `/docs/legal/terms.md` — for context only

There is no previous phase. The working tree carries the doc edits from the planning session plus some pre-existing non-doc dirty state which this phase MUST NOT touch.

## Work

This phase is **documentation-only**. No code changes. Commit ONLY the docs + CLAUDE.md.

### 1. Verify the docs delta is present

Confirm each of these files appears in `git status --short` with an `M ` modification mark:

```
CLAUDE.md
docs/adr.md
docs/code-architecture.md
docs/dev-setup.md
docs/screens.md
docs/security-checklist.md
```

Quick spot-checks for correctness:

```bash
# ADR-61 / ADR-62 / ADR-63 must all be present in docs/adr.md
grep -c "^## ADR-6[123]:" docs/adr.md  # expect 3

# CLAUDE.md must reference ADR-61 / ADR-62 / ADR-63
grep -E "ADR-6[123]" CLAUDE.md  # expect at least one match per ADR

# screens.md §C must include the new layer order
grep -q "Territory boundary lines" docs/screens.md

# security-checklist.md must include W1..W9
grep -cE "^### W[1-9]\." docs/security-checklist.md  # expect 9

# dev-setup.md must list CONSTELLATION_RENDERER and ENABLE_DEV_MAP
grep -q "CONSTELLATION_RENDERER" docs/dev-setup.md
grep -q "ENABLE_DEV_MAP" docs/dev-setup.md
```

If any spot-check fails, do NOT silently rewrite. Mark the phase status as `"error"` with `"error_message"` explaining what was missing.

### 2. Log the pre-existing non-doc dirty state (do NOT touch it)

The working tree contains pre-existing changes that are intentionally NOT part of this commit. They are documented here so subsequent phases know what is already in flight:

- `app/_components/Constellation/Cluster.tsx` — DELETED in working tree (legacy renderer cleanup)
- `app/_components/Constellation/ClusterAura.tsx` — DELETED
- `app/_components/Constellation/Connections.tsx` — DELETED
- `app/_components/Constellation/Constellation.tsx` — MODIFIED (current SVG renderer)
- `app/dev/map/page.tsx` — MODIFIED
- `public/textures/source/milky-way-pexels-29746501.jpg` — NEW UNTRACKED (texture source committed in Phase 1)

The 5 Constellation/dev-map changes will be absorbed by **Phase 3** (`switch-skeleton-rename`). The texture source will be committed by **Phase 1**.

Out of scope (must NOT be modified or committed by this phase or any subsequent phase):

- `drizzle/migrations/0002_rls_and_triggers.sql` — pre-existing modification unrelated to this redesign. Will be handled as a separate hotfix outside this task.

Write the current `git status --short` output to the phase output (the runner captures stdout/stderr in `phase0-output.json`) so future phases can reference it. Do this by running `git status --short` and letting the output appear in the runner log.

### 3. Stage and commit docs only

Use explicit file list. Do NOT use `git add .` or `git add -A`.

```bash
git add CLAUDE.md \
        docs/adr.md \
        docs/code-architecture.md \
        docs/dev-setup.md \
        docs/screens.md \
        docs/security-checklist.md
```

Commit with this exact message (HEREDOC for multiline):

```bash
git commit -m "$(cat <<'EOF'
feat(stellarium-redesign): phase 0 — stellarium-docs-commit

Captures the Stellarium visual-language redesign documentation in one
diff. This phase commits no code; subsequent phases implement against
the spec written here.

- ADR-61: Stellarium visual language (cluster identity via map grammar,
  not color); compass-forbidden list amended
- ADR-62: WebGL primary renderer (R3F + drei + postprocessing); SVG OG
  divergence at ~80% fidelity; server-side feature flag for instant
  rollback
- ADR-63: Voronoi territory boundary; label visibility rule
  (top-1/cluster + global cap 8–12); DOM accessibility overlay;
  /dev/map env-var guard
- screens.md §C Canvas section rewritten with 8-layer order, SSR
  skeleton, adaptive mobile quality, WebGL fallback path
- screens.md §I.3 stage-up: aura is the moment color BECOMES visible
- code-architecture.md: features/constellation/render/ shared module,
  new external deps, env vars, observability events
- CLAUDE.md: forbidden list rewrite; visual language, feature flag,
  /dev/map guard sections; server-only and SPDX additions
- security-checklist.md: W1–W9 WebGL launch verification items
- dev-setup.md: CONSTELLATION_RENDERER + ENABLE_DEV_MAP env vars
EOF
)"
```

### 4. Do NOT stash or revert non-doc dirty state

The user has explicitly forbidden auto-stash and auto-revert. The dirty state listed in step 2 must remain in the working tree after this commit. Subsequent phases handle it.

After Phase 0 completes, `scripts/run-phases.py` automatically generates `/tasks/2-stellarium-redesign/docs-diff.md` capturing the docs diff.

## Acceptance Criteria

```bash
# (1) The commit exists with the expected message
git log -1 --format='%s' | grep -q "^feat(stellarium-redesign): phase 0 — stellarium-docs-commit$"

# (2) The commit contains exactly the expected 6 files
test "$(git diff HEAD~1 --name-only | sort | tr '\n' ' ')" = "CLAUDE.md docs/adr.md docs/code-architecture.md docs/dev-setup.md docs/screens.md docs/security-checklist.md "

# (3) The commit does NOT contain any code files
! git diff HEAD~1 --name-only | grep -qE "\.(ts|tsx|js|jsx|css|json|sql)$"

# (4) ADR-61, ADR-62, ADR-63 are present in the committed adr.md
test "$(git show HEAD:docs/adr.md | grep -cE '^## ADR-6[123]:')" = "3"

# (5) The non-doc pre-existing dirty state is preserved (informational; no failure if false — log only)
git status --short
```

## How to verify AC

Run the AC commands above. If all five pass, set the phase 0 status to `"completed"` in `/tasks/2-stellarium-redesign/index.json`. If any fail after at most 3 attempts to remedy *structural* issues (e.g. forgot a file in `git add`), set status to `"error"` and write the failure reason in the phase's `"error_message"` field.

Do NOT attempt to "fix" by modifying the doc content. The doc content was reviewed in the planning session and is authoritative.

## Notes

- **No auto-stash. No auto-revert.** The pre-existing dirty state in `Constellation.tsx`, `Cluster.tsx`/`ClusterAura.tsx`/`Connections.tsx` (deleted), `dev/map/page.tsx`, and `drizzle/migrations/0002_rls_and_triggers.sql` must remain untouched. The runner will not have a clean working tree after this phase — that is intentional and expected.
- **Do not commit `drizzle/migrations/0002_rls_and_triggers.sql`.** It is out of scope for this task entirely. It will be handled as a separate hotfix outside this task series. If it accidentally ends up staged, `git reset HEAD drizzle/migrations/0002_rls_and_triggers.sql` before committing.
- **Do not commit `public/textures/source/milky-way-pexels-29746501.jpg`.** It will be committed by Phase 1 along with the rest of the texture asset directory setup.
- **`tsconfig.tsbuildinfo`** has already been reverted in the planning session — it should not appear in `git status` at the start of this phase. If it reappears (because TypeScript regenerated it), do NOT commit it. Add `tsconfig.tsbuildinfo` to `.gitignore` if it is not already there.
