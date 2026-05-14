# Phase 11: Tests + Accessibility

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/adr.md` ADR-21 (test coverage) · ADR-54 (a11y baseline) · ADR-58 (Web Vitals)
- `/docs/security-checklist.md` items 21-30 (accessibility, Web Vitals)
- `/docs/code-architecture.md` §Testing conventions
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 10's output:

- Security hardening done (mock route guard, webhook signature, origin allowlist, CSP)
- Observability wired (Sentry, PostHog, Speed Insights, health endpoint)
- `npm run build` passes

Read the existing tests:

- `tests/e2e/signup-to-reveal.spec.ts` — current E2E
- `tests/integration/*.test.ts`
- `tests/unit/*.test.ts`
- `playwright.config.ts` — Playwright config

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Update tests to cover the pivot. Add accessibility hardening. Add the constellation render screenshot diff test.

### 1. Update E2E `tests/e2e/signup-to-reveal.spec.ts`

Adapt selectors and assertions for the constellation:

```ts
import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('signup → repo selection → first reveal completes', async ({ page }) => {
  // Mock OAuth flow uses /api/test/mock-oauth (NODE_ENV must be non-prod)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /skill constellation that lights up/i })).toBeVisible()

  // Click sign in (this triggers a Server Action; on dev, it routes to mock OAuth)
  await page.getByRole('button', { name: /sign in with github/i }).click()

  // Repo selection
  await expect(page).toHaveURL(/onboarding\/repos/)
  await expect(page.getByText(/pick your repos/i)).toBeVisible()
  await page.getByRole('button', { name: /build my constellation/i }).click()

  // Main constellation page — wait for reveal to complete (max ~30s + buffer)
  await expect(page).toHaveURL(/^\//)
  await page.waitForSelector('[data-testid="constellation-canvas"]', { timeout: 5000 })

  // First reveal should complete and the cluster labels should appear.
  // Visible cluster labels should include at least one of the six names.
  const clusterLabels = ['Frontend', 'Backend', 'Data', 'Testing', 'DevOps', 'Docs']
  // Wait until any cluster label is visible (timing depends on sync speed; budget 60s).
  await Promise.any(clusterLabels.map((label) =>
    page.getByText(label, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 }),
  ))

  // Drawer test: click a visible cluster label
  for (const label of clusterLabels) {
    const el = page.getByText(label, { exact: true })
    if (await el.isVisible()) {
      await el.click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
      await page.keyboard.press('Escape')
      break
    }
  }
})
```

`data-testid` attributes:
- `data-testid="constellation-canvas"` on the root `<svg>` of `Constellation.tsx`.
- `data-testid="cluster-label-{type}"` on each cluster label (optional but useful for visual debugging).
- `data-testid="star-{tech_key}"` on each rendered star.

Add these attributes in the Phase 3 components if not already present. (Adjust selectors here accordingly.)

### 2. New E2E: constellation render screenshot diff

`tests/e2e/constellation-render.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

test('constellation renders with stable visual snapshot', async ({ page }) => {
  // Sign in via mock OAuth, run sync, navigate to /
  // (Reuse helpers from signup-to-reveal.spec.ts via test fixtures or duplicate inline.)

  // After the reveal completes, snapshot the canvas region.
  const canvas = page.locator('[data-testid="constellation-canvas"]')
  await expect(canvas).toHaveScreenshot('constellation-default.png', {
    maxDiffPixelRatio: 0.02,
    timeout: 5000,
  })
})
```

The baseline `constellation-default.png` is committed to `tests/e2e/__screenshots__/`. First run authors it; subsequent runs diff. For the very first commit of this test, set `--update-snapshots` once locally and commit the result.

### 3. Accessibility hardening

#### Reduced motion

Verify every animated component checks `useReducedMotion()` (introduced in Phase 3 `SparkAnimation.tsx`). Audit:

```bash
grep -rn "framer-motion" app/_components/ --include='*.tsx' | wc -l
```

For each file using `framer-motion` `<motion.*>` components or `useAnimate`/`animate`, confirm a branch for reduced motion exists.

If anything is missing, add `useReducedMotion()` and snap to final state. Critical components:

- `app/_components/Constellation/Star.tsx` (spark)
- `app/_components/Constellation/ClusterAura.tsx` (ripple)
- `app/_components/SpecialMoments/FirstTimeReveal.tsx`
- `app/_components/SpecialMoments/FirstEverStarCinematic.tsx`
- `app/_components/SpecialMoments/StageUpMoment.tsx`
- `app/_components/StateBanners/HintTooltip.tsx`
- `app/_components/StateBanners/ThisWeekStrip.tsx` (cluster pulse)
- `app/_components/PublicStickyBar.tsx` (pulse)
- Any modal entry/exit animation in `ClusterDrawer`, `ShareModal`, etc.

#### Keyboard navigation

Cluster labels in `Cluster.tsx` must be keyboard-focusable buttons:

```tsx
<g
  role="button"
  tabIndex={0}
  aria-label={`${TERRITORIES[type].name} cluster, ${litCount} stars lit`}
  onClick={onClusterClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClusterClick?.() }
  }}
>
  {/* label text */}
</g>
```

Star elements should NOT be individually focusable (`aria-hidden`); the cluster aggregates them.

Drawer's X close button needs `aria-label="Close drawer"`.

The Share modal's overlay click should be disabled per ADR rules (mod E.1/E.2), but ESC must close it.

#### Screen reader summary

Add a hidden text summary at the top of the main constellation page for screen readers:

```tsx
{/* In app/(authenticated)/page.tsx */}
<div className="sr-only" role="status" aria-live="polite">
  Your constellation has {litStarCount} stars lit across {activeClusterCount} clusters.
</div>
```

For the public profile owner self-view, the summary is the same. For visitor view, use:

```tsx
<div className="sr-only">
  {ownerUsername}'s constellation has {litStarCount} stars lit across {activeClusterCount} clusters.
</div>
```

Add Tailwind's `.sr-only` utility (already standard) or define it once in `globals.css` if not present.

#### Color contrast — audit

Run a manual contrast check (using browser DevTools or a Pa11y CLI in the future) against:

- Cluster label text (`#cbd5e1` on `#0b1020` background): verify ≥ 4.5:1 for normal text.
- Star colors against the dim sky background.
- Drawer body text (`#f1f5f9` / `#cbd5e1` on dim card background).

If any text fails AA, brighten the foreground (e.g., move `#cbd5e1` → `#e2e8f0`). Star colors are decorative (≥ 3:1 acceptable for icons).

Document the audit results inline in the phase commit message.

### 4. Update integration tests

#### `tests/integration/rls-isolation.test.ts`

Add coverage for the new tables:

- User A INSERT into `misclassification_feedback` for their own data → succeeds.
- User A INSERT into `misclassification_feedback` for user B's data (`user_id = userB.id`) → fails (RLS rejects).
- User A SELECT from `misclassification_feedback` → fails (no select policy for authenticated).
- `tech_global_stats` SELECT works for anon.
- `username_history` SELECT works for anon.
- `system_messages` SELECT works for anon.

#### `tests/integration/email-templates.test.ts`

Already added in Phase 8. Confirm snapshots are committed under `tests/integration/__snapshots__/`.

#### `tests/integration/recap-generation.test.ts`

Smoke test:

- Create a user with synthetic activities in the past week.
- Call `generateWeeklyRecapForUser` for the Monday.
- Assert `weekly_recaps.highlights` row has `kind: 'active'` (or `empty` for the empty case).
- Assert `subject_pick` and `preview_text` populated.

### 5. Unit test coverage refresh

Ensure each new module has at least one unit test:

- `lib/db/queries/_helpers.ts` — done in Phase 1
- `lib/email/unsubscribe-token.ts` — done in Phase 2
- `lib/utils/reserved-usernames.ts` — done in Phase 2
- `lib/og/version.ts` — done in Phase 2
- `lib/utils/username-redirect.ts` — needs integration test (uses DB)
- `features/sync/cinematic-detection.ts` — needs integration test (uses DB)
- `features/recap/slot-builder.ts` — needs unit test (pure function)
- `features/recap/subject-line.ts` — needs unit test (pure function)
- `lib/posthog.ts` `sanitizePath` — done in Phase 10
- `lib/auth/actions.ts` `pickOrigin` — done in Phase 10 (`tests/unit/origin-allowlist.test.ts`)

Add the missing tests:

#### `tests/unit/slot-builder.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildHighlights } from '@/features/recap/slot-builder'

describe('buildHighlights', () => {
  it('returns empty kind when isEmptyWeek', () => {
    const result = buildHighlights({
      aggregations: { weekStart: new Date(), stageUps: [], newStars: [], brightenedStars: [], brightestCluster: null, activity: { active_days: 0, commits: 0, prs_shipped: 0 } },
      isFirstWeek: false,
      isEmptyWeek: true,
    })
    expect(result.kind).toBe('empty')
    expect(result.subject_pick).toBe('empty')
  })

  it('prioritizes stage_up in slot 1', () => {
    const result = buildHighlights({
      aggregations: {
        weekStart: new Date(),
        stageUps: [{ territory: 'backend_fortress', from_stage: 1, to_stage: 2 }],
        newStars: [{ tech_key: 'docker', territory: 'devops_harbor' }],
        brightenedStars: [],
        brightestCluster: { territory: 'frontend_land', growthPct: 12 },
        activity: { active_days: 4, commits: 10, prs_shipped: 2 },
      },
      isFirstWeek: false,
      isEmptyWeek: false,
    })
    expect(result.slot_1?.kind).toBe('stage_up')
    if (result.slot_1?.kind === 'stage_up') expect(result.slot_1.cluster_type).toBe('backend_fortress')
    expect(result.subject_pick).toBe('stage_up_backend_fortress')
  })

  it('falls back to brightest_cluster if no stage_up', () => {
    const result = buildHighlights({
      aggregations: {
        weekStart: new Date(),
        stageUps: [],
        newStars: [],
        brightenedStars: [],
        brightestCluster: { territory: 'frontend_land', growthPct: 18 },
        activity: { active_days: 3, commits: 7, prs_shipped: 1 },
      },
      isFirstWeek: false,
      isEmptyWeek: false,
    })
    expect(result.slot_1?.kind).toBe('brightest_cluster')
  })
})
```

#### `tests/unit/subject-line.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildSubjectLine } from '@/features/recap/subject-line'

describe('buildSubjectLine', () => {
  it('empty', () => {
    expect(buildSubjectLine({ kind: 'empty', subject_pick: 'empty', preview_text: '' })).toBe('Your sky — this week')
  })

  it('first_week', () => {
    expect(buildSubjectLine({ kind: 'first_week', subject_pick: 'first_week', preview_text: '' })).toBe('Your first week on DevAstra')
  })

  it('stage_up priority', () => {
    const subj = buildSubjectLine({
      kind: 'active',
      slot_1: { kind: 'stage_up', cluster_type: 'backend_fortress', from_stage: 1, to_stage: 2 },
      subject_pick: 'stage_up_backend_fortress',
      preview_text: '',
    })
    expect(subj).toBe('Backend cluster expanded')
  })

  it('new stars without stage_up', () => {
    const subj = buildSubjectLine({
      kind: 'active',
      slot_2: { kind: 'new_stars', tech_keys: ['docker', 'postgres'] },
      subject_pick: 'new_stars_2',
      preview_text: '',
    })
    expect(subj).toBe('2 new stars this week')
  })

  it('one new star uses tech name', () => {
    const subj = buildSubjectLine({
      kind: 'active',
      slot_2: { kind: 'new_stars', tech_keys: ['docker'] },
      subject_pick: 'new_stars_1',
      preview_text: '',
    })
    expect(subj).toBe('Docker is new this week')
  })
})
```

### 6. Verify `data-testid` attributes are present

Confirm the renderer / drawer / banners expose `data-testid` consistent with the E2E selectors:

- `<svg data-testid="constellation-canvas">` in `Constellation.tsx`
- `<g data-testid="cluster-{type}">` per cluster
- `<g data-testid="star-{tech_key}">` per star (optional)
- `<div role="dialog" data-testid="cluster-drawer">` on `ClusterDrawer`
- `<button data-testid="refresh-button">` on `RefreshButton`
- `<button data-testid="share-button">` on the header share trigger
- `<a data-testid="sticky-cta">` on `PublicStickyBar`

Add these in this phase if missing.

### 7. Update security checklist

In `docs/security-checklist.md`, mark items 21-30 (accessibility, Web Vitals, sitemap, etc.) as `[x]`.

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Unit tests pass
npx vitest run tests/unit

# Integration tests pass (only if .env.test present)
[ ! -f .env.test ] || npx vitest run tests/integration

# E2E runs (Playwright requires a running server; CI step or dev runs)
# Locally, an explicit "BASE_URL=http://localhost:3000 npx playwright test" is the path.
# AC here only checks the spec files exist.
test -f tests/e2e/signup-to-reveal.spec.ts
test -f tests/e2e/constellation-render.spec.ts

# Reduced-motion check present in all motion components
grep -l "useReducedMotion\|prefers-reduced-motion" app/_components/Constellation/*.tsx | wc -l | xargs -I{} test {} -ge 2
grep -l "useReducedMotion\|prefers-reduced-motion" app/_components/SpecialMoments/*.tsx | wc -l | xargs -I{} test {} -ge 3

# Cluster label is keyboard-focusable
grep -n "tabIndex={0}" app/_components/Constellation/Cluster.tsx | head -1

# Screen-reader summary present
grep -rn "stars lit across" app/ --include="*.tsx" | head -1

# Security checklist items 21-30 marked
grep -c '^### .* \[x\]' docs/security-checklist.md | xargs -I{} test {} -ge 20
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 11 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **Playwright screenshot diffs**: the baseline image is committed. First-time run may need `--update-snapshots` locally; from then on, only intentional visual changes update the baseline.
- **Reduced motion is mandatory** for every motion component. Visually, the user with `prefers-reduced-motion: reduce` set sees the final state of every animation, never the in-between frames.
- **Star focus** — stars are decorative individually; cluster-level keyboard nav is the model. Do not introduce per-star tab focus.
- **`role="dialog"`** on the cluster drawer must include `aria-modal="true"` and trap focus. Use a focus-trap library if needed (the Phase 4 drawer should already implement this; verify).
- **PostHog test events** — do not write integration tests that send live PostHog events. Mock the client or check captured calls instead.
- **CSP test**: do not test CSP via JSDOM/Vitest (it doesn't enforce CSP). Manual verification via `curl -I` in production.
- **Don't add Lighthouse runner to CI** for MVP — Vercel Speed Insights is the production-side metric capture (ADR-58). Manual Lighthouse run in dev is acceptable for local Web Vitals check.
- **Don't change the dim-sky color palette** in this phase. Color contrast tuning is acceptable but small adjustments only — major palette work is post-launch.
