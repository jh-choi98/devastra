# Phase 0: Pivot Documentation Commit

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent (these were just rewritten for the DevAstra pivot):

- `/CLAUDE.md`
- `/docs/prd.md`
- `/docs/flow.md`
- `/docs/screens.md`
- `/docs/data-schema.md`
- `/docs/code-architecture.md`
- `/docs/adr.md`
- `/docs/tech-catalog.md`
- `/docs/security-checklist.md`
- `/docs/dev-setup.md`
- `/docs/legal/privacy.md`
- `/docs/legal/terms.md`
- `/README.md`

Then verify the following root-level files exist (they were created as part of the pivot doc set):

- `/LICENSE-MIT`
- `/LICENSE-PROPRIETARY`
- `/SECURITY.md`
- `/CONTRIBUTING.md`

This is the first phase of the pivot-mvp task. The previous task (`0-mvp`) is fully committed; this phase's job is to commit the pivot documentation set as a single foundational diff.

## Work

This phase is **documentation-only**. No code changes.

### 1. Verify documentation set is consistent and complete

Run these commands to confirm everything is in place:

```bash
# All required files exist
ls -1 docs/prd.md docs/flow.md docs/screens.md docs/data-schema.md \
      docs/code-architecture.md docs/adr.md docs/tech-catalog.md \
      docs/security-checklist.md docs/dev-setup.md \
      docs/legal/privacy.md docs/legal/terms.md \
      CLAUDE.md README.md LICENSE-MIT LICENSE-PROPRIETARY SECURITY.md CONTRIBUTING.md
```

Then read each file and check for the following invariants:

- **No remaining `DevAtlas` references in product copy.** Two intentional historical mentions in `docs/adr.md` (the rename note around line 5 and the ADR-7 amendment around line 99) are correct as-is — do not touch them. Anywhere else, `DevAtlas` should not appear.
- **All cross-references resolve.** When a doc says `see docs/adr.md ADR-26`, ADR-26 must exist in `docs/adr.md`.
- **Tech catalog `display_name` values are plain tech names**, not architectural metaphors. The `{x, y}` columns in `docs/tech-catalog.md` are placeholders (em-dash `—`); Phase 3 fills them via algorithmic fallback.
- **CLAUDE.md mentions all 16 files** in the documentation reading list and the SPDX policy is documented.
- **`README.md` top section is DevAstra-branded.** The lower `claude-harness-template` section is generic infrastructure and is left intact.

If you find any genuine inconsistency (broken cross-ref, stale `DevAtlas` reference outside the two intentional adr.md mentions, missing file), fix it within this phase. Do NOT modify product decisions or content — only structural / referential issues.

### 2. Commit the documentation set

Stage every doc-side change made in the prior planning session. Run:

```bash
git add CLAUDE.md README.md \
        LICENSE-MIT LICENSE-PROPRIETARY SECURITY.md CONTRIBUTING.md \
        docs/prd.md docs/flow.md docs/screens.md docs/data-schema.md \
        docs/code-architecture.md docs/adr.md docs/tech-catalog.md \
        docs/dev-setup.md docs/security-checklist.md \
        docs/legal/
```

Then commit with this exact message:

```
feat(pivot-mvp): phase 0 — pivot-docs-commit

Captures the full DevAstra pivot documentation set in one diff.
This phase commits no code; subsequent phases implement against
the spec written here.

- PRD rewritten for the constellation metaphor and free-only MVP scope
- Flow + Screens cover 5 main flows + 11 sub-flows + 30+ screens
- Data schema adds 5 boolean columns to users and 4 new tables
- Code architecture documents Constellation/, ClusterDrawer/,
  StateBanners/, SpecialMoments/, feedback/ modules
- ADRs supersede ADR-1, amend ADR-7, add ADR-26..60 (35 new)
- Security checklist captures 38 pre-launch verify items
- Dual-license (LICENSE-MIT for extractable, LICENSE-PROPRIETARY
  for the rest) + SECURITY.md + CONTRIBUTING.md added
- Legal: privacy.md + terms.md sourced as markdown
```

After Phase 0 completes, `scripts/run-phases.py` automatically generates `/tasks/1-pivot-mvp/docs-diff.md` capturing the full diff.

### 3. Status verification

Confirm clean state:

```bash
git status --short
# Expected: clean (no untracked or modified files)
```

## Acceptance Criteria

```bash
# All required files exist and are tracked
git ls-files docs/prd.md docs/flow.md docs/screens.md docs/data-schema.md \
             docs/code-architecture.md docs/adr.md docs/tech-catalog.md \
             docs/security-checklist.md docs/dev-setup.md \
             docs/legal/privacy.md docs/legal/terms.md \
             CLAUDE.md LICENSE-MIT LICENSE-PROPRIETARY SECURITY.md CONTRIBUTING.md

# README.md is committed (it was modified, not untracked)
git ls-files README.md

# No stray DevAtlas references outside intentional adr.md mentions
test "$(git grep -c "DevAtlas" -- ':!docs/adr.md' ':!tasks/' ':!.claude/' | wc -l)" -eq 0

# Working tree is clean
test -z "$(git status --short)"
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 0 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **Do not modify product decisions.** This phase commits the existing doc set. If something looks wrong content-wise, surface it via the `error_message` field — do not silently rewrite.
- The two intentional `DevAtlas` references in `docs/adr.md` are part of the historical record. Do not strip them.
- The `tasks/0-mvp/` directory is a historical record of the pre-pivot MVP build. Do not touch it. It is excluded from the DevAtlas grep check via `':!tasks/'`.
- Do not commit any code changes in this phase — only docs and root-level files.
- The runner will automatically invoke `scripts/gen-docs-diff.py` after this phase to produce `tasks/1-pivot-mvp/docs-diff.md`.
