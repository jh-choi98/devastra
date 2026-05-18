# Phase 12: Tests, Visual Baseline, Launch Verification

## Preparation

Read these docs first:

- `/docs/security-checklist.md` — Constellation WebGL renderer launch section (W1–W9)
- `/docs/code-architecture.md` — Testing conventions, Observability targets
- `/docs/adr.md` ADR-58 (Web Vitals), ADR-62 (bundle budget, adaptive quality)
- All Phase 0–11 outputs in `tasks/2-stellarium-redesign/phase*-output.json` and `visual-checkpoints/*.png`
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- Phase 11: Error Boundary, Sentry events, WebGL detect, size budget all wired
- Phases 4–9: visual checkpoint screenshots accumulated under `tasks/2-stellarium-redesign/visual-checkpoints/`

## Work

This is the final phase. Lock visual regression baselines, run all security-checklist items, verify mobile performance, and mark the rollout-ready criteria as met.

### 1. Visual regression baseline lock

Create the visual regression test suite. The baselines committed in this phase are the official "this is how the constellation should look" snapshots.

Create `tests/visual/dev-map.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

// Scenarios — each calls /dev/map with a specific mock setup.
// The mock data is configured via query params on /dev/map (added in earlier phases).
const SCENARIOS = [
  { name: 'empty',       url: '/dev/map?scenario=empty' },
  { name: 'sparse',      url: '/dev/map?scenario=sparse' },
  { name: 'dense',       url: '/dev/map?scenario=dense' },
  { name: 'stage-up',    url: '/dev/map?scenario=stage-up' },
  { name: 'first-ever',  url: '/dev/map?scenario=first-ever' },
]

for (const s of SCENARIOS) {
  test(`visual regression: ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`http://localhost:3000${s.url}`)
    // Wait for Scene fade-in (~500ms) + texture load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    await expect(page).toHaveScreenshot(`${s.name}.png`, { maxDiffPixelRatio: 0.03 })
  })
}
```

`/dev/map` needs a `?scenario=` param that maps to one of 5 mock data sets. Add this to `app/dev/map/page.tsx` if not already:

```tsx
const SCENARIOS = {
  empty:      { /* 0 lit landmarks */ },
  sparse:     { /* 4 lit landmarks total */ },
  dense:      { /* 30+ lit landmarks across all 6 clusters */ },
  'stage-up': { /* trigger stage-up cinematic on backend */ },
  'first-ever': { /* trigger first-ever cinematic with 2 stars */ },
}

const scenario = (searchParams?.scenario as keyof typeof SCENARIOS) ?? 'dense'
const mockData = SCENARIOS[scenario]
```

Run the test:

```bash
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
# First run: --update-snapshots to write baselines
npx playwright test tests/visual --update-snapshots
# Verify baselines committed to tests/visual/__screenshots__/
# Second run: should pass against the freshly-written baselines
npx playwright test tests/visual
kill $DEV_PID || true
```

Commit the baseline PNGs to `tests/visual/__screenshots__/`.

### 2. A11y verification

Run the axe test from Phase 8:

```bash
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npm run axe:test
kill $DEV_PID || true
```

Resolve any WCAG violations. Common pitfalls in WebGL apps:
- Missing `aria-label` on overlay buttons → add
- Insufficient color contrast on labels → bump opacity / shade
- Focus indicator invisible → use `focus-visible:` Tailwind utilities

### 3. Bundle budget verification

```bash
npm run build
npm run size
# Should pass the size-limit gate set in package.json
# (Updated in Phase 11 with realistic chunk paths)
```

If still over budget:
- Lazy-import drei's heavy parts (only import what's used)
- Tree-shake postprocessing (import individual passes, not the whole package)
- Verify `dynamic({ ssr: false })` is actually splitting Scene off

### 4. Mobile emulation testing

```bash
# Playwright with mobile viewports
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npx playwright test tests/visual --project=mobile-chrome
kill $DEV_PID || true
```

Configure `playwright.config.ts` with a mobile project if not present:

```ts
{
  name: 'mobile-chrome',
  use: { ...devices['Pixel 5'] },
}
```

Verify on emulated iPhone 12 mini and Pixel 5:
- Adaptive quality kicks in (field stars 1000, bloom 0.5×)
- FPS stays >= 30 (visual observation; precise measurement is overkill for MVP)
- Labels remain readable at smaller viewport

### 5. Reduced-motion verification

```ts
// tests/visual/reduced-motion.spec.ts
import { test, expect } from '@playwright/test'

test('reduced motion: no twinkle, no parallax, no breathing', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('http://localhost:3000/dev/map?scenario=dense')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  // Take two screenshots 2s apart; they should be identical (no motion)
  const a = await page.screenshot()
  await page.waitForTimeout(2000)
  const b = await page.screenshot()
  // If twinkle/parallax/breathing were active, pixels would differ.
  // Allow tiny diff for sub-pixel raster differences.
  expect(Buffer.compare(a, b)).toBe(0)
})
```

### 6. CONSTELLATION_RENDERER=svg regression test

```ts
// tests/e2e/svg-fallback.spec.ts
import { test, expect } from '@playwright/test'

test('CONSTELLATION_RENDERER=svg still renders the legacy SVG path', async ({ page }) => {
  // Requires the dev server to be started with CONSTELLATION_RENDERER=svg
  await page.goto('http://localhost:3000/dev/map?scenario=dense')
  // The SVG renderer is the legacy implementation; verify some marker
  await expect(page.locator('svg')).toBeVisible()
  // No <canvas> from R3F should be present
  await expect(page.locator('canvas')).toHaveCount(0)
})
```

Run this with `CONSTELLATION_RENDERER=svg npm run dev` in a separate context to confirm legacy path is operational.

### 7. Security checklist verification

For each of W1–W9 (from `docs/security-checklist.md`), verify and update the status marker:

```bash
# W1: /dev/map gated
test -f app/dev/map/page.tsx
grep -q "ENABLE_DEV_MAP" app/dev/map/page.tsx
! grep -q "NODE_ENV === 'production'" app/dev/map/page.tsx

# W2: CONSTELLATION_RENDERER server-side only
! grep -rE "NEXT_PUBLIC_CONSTELLATION_RENDERER" app/ lib/ features/

# W3: WebGL fallback works → covered by Phase 11 fallback test

# W4: Bundle budget → npm run size

# W5: Reduced motion → reduced-motion.spec.ts above

# W6: A11y → axe:test

# W7: Sentry events → covered by Phase 11

# W8: Texture LICENSE.md exists
test -f public/textures/LICENSE.md
grep -q "Pexels" public/textures/LICENSE.md
grep -q "Giona Mason" public/textures/LICENSE.md

# W9: Visual regression baselines
test -d tests/visual/__screenshots__
# (at least 5 baselines committed)
test "$(ls tests/visual/__screenshots__/*.png 2>/dev/null | wc -l)" -ge 5
```

After all pass, edit `docs/security-checklist.md` to flip W1–W9 from `[ ]` to `[x]` and add a `**Status:** [x] ...` note with the verification source (test file path or grep result).

### 8. Final polish pass — visual checkpoint review

Open each `tasks/2-stellarium-redesign/visual-checkpoints/phase{N}.png` and the new baseline screenshots. The user reviews these. If anything looks off in a specific phase (e.g. milky way too dark, bloom too aggressive), revert the offending phase's status to `"pending"` and re-run that phase with adjustment instructions.

This phase is the gate where "looks good enough to ship" is decided. If the user requests adjustments, those happen by re-opening prior phases — NOT by piling fixes into Phase 12.

### 9. Update final docs

- `docs/security-checklist.md` — W1–W9 status updates per step 7
- No other doc changes expected. ADRs were locked in Phase 0.

### 10. Mark task complete

After all AC passes, the runner sets the task status to `"completed"` in `/tasks/index.json` automatically. Phase 12's job is to make sure AC is honest.

## Acceptance Criteria

```bash
# (1) Visual regression baselines exist and pass
test "$(ls tests/visual/__screenshots__/*.png 2>/dev/null | wc -l)" -ge 5
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npx playwright test tests/visual --project=chromium
kill $DEV_PID || true

# (2) A11y test passes
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npm run axe:test
kill $DEV_PID || true

# (3) Bundle budget passes
npm run build
npm run size

# (4) Reduced-motion test passes
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npx playwright test tests/visual/reduced-motion.spec.ts
kill $DEV_PID || true

# (5) SVG fallback regression test passes
CONSTELLATION_RENDERER=svg ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npx playwright test tests/e2e/svg-fallback.spec.ts
kill $DEV_PID || true

# (6) Mobile emulation test passes (degraded quality acceptable, no errors)
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npx playwright test tests/visual --project=mobile-chrome
kill $DEV_PID || true

# (7) All W1–W9 items in security-checklist.md are [x]
test "$(grep -c '^### W[1-9]\\.' docs/security-checklist.md)" -eq 9
test "$(grep -cE '^### W[1-9]\\..*\\[x\\]' docs/security-checklist.md)" -eq 9

# (8) features/constellation/render unit tests pass
npm test -- features/constellation/render

# (9) Type check + production build pass
npm run build

# (10) No console errors during /dev/map render (verified via Playwright capture)
```

## How to verify AC

Run AC commands. All ten must pass. Set phase 12 status to `"completed"` in `/tasks/2-stellarium-redesign/index.json`. The runner then sets the overall task status to `"completed"` in `/tasks/index.json`.

If a specific visual baseline looks wrong on user review (subjective call), set phase 12 status back to `"pending"` and re-run after the underlying phase has been adjusted. Do not falsely mark this phase complete if the user is unhappy with a visual checkpoint.

## Notes

- **Visual baselines are commits, not approvals.** Once committed, future PRs that fail visual regression must explicitly update the baselines with reviewer approval. This protects against accidental visual drift.
- **3% threshold.** Playwright's `maxDiffPixelRatio: 0.03` allows small anti-aliasing / subpixel differences. If a real change exceeds 3%, it's a meaningful visual change and requires baseline update + reviewer sign-off.
- **Mobile FPS measurement.** We don't have a robust 30fps assertion in Playwright. Visual observation on real hardware is the truth source. Document any visible jank in `phase12-output.json` for the user to evaluate.
- **Reduced motion screenshot equality.** The test compares two screenshots 2 seconds apart. If they differ, some ambient motion leaked through. Investigate which uniform isn't gated by `uMotionEnabled`.
- **SVG fallback path must still work.** Even though the goal is WebGL adoption, the legacy SVG renderer stays alive until the post-rollout removal PR. Verify it now to confirm it didn't regress during the refactor.
- **W1–W9 status updates.** Edit `docs/security-checklist.md` directly. Use a commit message like `docs(stellarium-redesign): mark W1-W9 launch checklist verified`. This is part of Phase 12's commit, not a separate one.
- **Honest AC.** If something fails, mark `"error"` with the failure detail. Do NOT mask failures to push the task to `completed`. The whole point of this checklist phase is to surface issues before rollout.
- **Texture LICENSE.md cross-check.** Open the file and verify the photographer name + URL are accurate. The earlier phase created this — Phase 12 just verifies it didn't drift.
