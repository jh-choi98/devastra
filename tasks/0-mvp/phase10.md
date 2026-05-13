# Phase 10: Weekly Recap

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` §Flow 2
- `/docs/adr.md` (ADR-6, ADR-14)
- `/docs/data-schema.md` §Weekly_Recaps, §Email_Sends
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 9's output:

- `lib/og/RecapImage.tsx` exists (or `lib/og/shared.tsx` provides the helper)
- `app/api/og/recap/[recap_id]/route.tsx` exists
- `lib/cache/revalidate-profile.ts` exists

Also verify the Phase 6 stubs:

- `features/sync/runner.ts` registers `weeklyRecapGenerate` (cron) and `weeklyRecapSend` (event) — currently throwing `NotImplemented`

## Work

Replace the recap stubs with full implementations. Sunday 09:00 UTC generation, fan-out delivery to each user's local Sunday 18:00.

### 1. Recap data assembly

`features/recap/generate.ts`:

```ts
import 'server-only'
import { ALL_TERRITORY_TYPES, TerritoryType } from '@/features/territories/registry'

export type RecapHighlights = {
  topGrowth: { territory: TerritoryType; pct: number } | null
  newLandmarks: Array<{ tech_key: string; landmarkName: string; territory: TerritoryType }>
  stageUps: Array<{ territory: TerritoryType; from: number; to: number }>
  stats: { activeDays: number; prsShipped: number; totalCommits: number }
}

export async function generateRecapForUser(userId: string, weekStart: Date): Promise<{
  recapId: string
  highlights: RecapHighlights
  hasActivity: boolean
}>
```

Steps:

1. Compute `weekStart = Monday 00:00 UTC` of the recap period (the previous full week). `weekEnd = weekStart + 7 days`.
2. Query `activities` joined with `activity_territories` for the user in [weekStart, weekEnd).
3. For each territory, compute weight gained this week and percent growth relative to total_weight at start of week.
4. `topGrowth` = territory with highest pct (or null if none).
5. `newLandmarks` = landmarks with `first_unlocked_at` within [weekStart, weekEnd).
6. `stageUps` = territories with `stage_changed_at` within [weekStart, weekEnd) AND new stage > old stage. To compare old/new, store the previous stage in `weekly_recaps.highlights.stageUps[].from` by reading current `territories.stage` and reversing the change history — but since we don't store stage history, an easier approach is: query for territories where `stage_changed_at ∈ [weekStart, weekEnd)` and infer `from = current_stage - 1, to = current_stage`. This is accurate when stages only ever increase (ADR-12).
7. `stats.activeDays` = distinct DATE(occurred_at AT TIME ZONE 'UTC') count in the week.
8. `stats.prsShipped` = count of `type='pr'` activities in the week.
9. `stats.totalCommits` = count of `type='commit'` activities in the week.
10. `hasActivity` = `totalCommits + prsShipped > 0`.
11. UPSERT `weekly_recaps` row with `week_start`, `highlights`, `og_image_url = /api/og/recap/{recap_id}`.
12. Return.

### 2. Recap diff helper

`features/recap/diff.ts`:

```ts
import 'server-only'
export function summarizeForEmail(highlights: RecapHighlights): { lines: string[] }
```

Convert highlights into ≤3 short lines for the email body. Examples:

- "Backend Fortress grew 18% this week"
- "New landmark: Rust Bastion"
- "5 active days · 3 PRs shipped"

If `hasActivity = false`, return `{ lines: ['Steady week.', 'See you next Sunday.'] }`.

### 3. Resend client

`lib/email/client.ts`:

```ts
import 'server-only'
import { Resend } from 'resend'
export const resend = new Resend(process.env.RESEND_API_KEY!)
```

### 4. Email templates (React Email)

`lib/email/templates/WeeklyRecap.tsx` — React Email component. Layout:

- Hero: `<Img src={`https://devatlas.app/api/og/recap/${recapId}`} width="600" />` (responsive proportional).
- 3 bullet highlights from `summarizeForEmail`.
- Big CTA button: "See your full world →" linking to `https://devatlas.app/`.
- Footer: unsubscribe link `https://devatlas.app/settings#email` and small "Sent by DevAtlas" line.

`lib/email/templates/WeeklyRecapEmpty.tsx` — same layout, different tone. Hero: previous week's OG image (or a generic ocean image — use previous week if available, else fall back). Body: "Steady week — see you next Sunday." Same CTA. Same footer.

Both must be valid React Email components renderable via `render` from `@react-email/components`.

### 5. Generation cron implementation

`features/sync/runner.ts` — replace stub `weeklyRecapGenerate`:

```ts
export const weeklyRecapGenerate = inngest.createFunction(
  { id: 'recap-generate', name: 'Generate weekly recap' },
  { cron: '0 9 * * 0' },     // Sunday 09:00 UTC
  async ({ step }) => {
    const users = await step.run('list-eligible-users', () => listUsersForRecap())
    for (const u of users) {
      const recap = await step.run(`generate-${u.id}`, () => generateRecapForUser(u.id, computeLastFullWeekUtcMonday()))
      // schedule per-user send with local Sunday 18:00 delay
      const sendAt = computeSendAtSundayLocal(u.timezone)
      await step.sendEvent(`recap/email.send-${u.id}`, {
        name: EVENTS.RECAP_EMAIL_SEND,
        data: { userId: u.id, recapId: recap.recapId, hasActivity: recap.hasActivity },
        ts: sendAt.getTime(),
      })
    }
  }
)
```

`listUsersForRecap()` selects users where `users.email_recap_enabled = true` and (token present OR they had any activity at any point — to be safe, restrict to `email_recap_enabled = true` for MVP).

`computeSendAtSundayLocal(tz)` returns the Date for the next Sunday 18:00 in tz. If "this Sunday 18:00 local" is already in the past (e.g. the cron ran late), use this week's Sunday — or just send immediately and log a slip.

### 6. Email send implementation

`features/recap/send.ts`:

```ts
import 'server-only'
import { resend } from '@/lib/email/client'
import { render } from '@react-email/components'

export async function sendRecapEmail(opts: { userId: string; recapId: string; hasActivity: boolean }): Promise<void> {
  // 1. fetch user (display_username, email, timezone, email_recap_enabled)
  // 2. if !email_recap_enabled → return (race protection)
  // 3. fetch weekly_recaps row by recapId
  // 4. choose template: WeeklyRecap if hasActivity, else WeeklyRecapEmpty
  // 5. render to html via @react-email/components
  // 6. resend.emails.send({ from: 'recap@devatlas.app', to: user.email, subject, html, headers: { 'List-Unsubscribe': '<https://devatlas.app/settings#email>' } })
  // 7. INSERT email_sends row with external_message_id from response
}
```

Subject: `Your DevAtlas — this week`. (Non-personalized; static; deliverability-friendly.)

`features/sync/runner.ts` — replace stub `weeklyRecapSend`:

```ts
export const weeklyRecapSend = inngest.createFunction(
  { id: 'recap-send', name: 'Send recap email' },
  { event: EVENTS.RECAP_EMAIL_SEND },
  async ({ event }) => sendRecapEmail(event.data)
)
```

### 7. Bounce webhook

`app/api/webhooks/resend/route.ts`:

```ts
export async function POST(req: Request) {
  // verify Resend signature (if available; otherwise rely on URL secrecy + minimal action)
  // body: { type: 'email.bounced', data: { email_id, ... } }
  // 1. mark email_sends.bounced = true
  // 2. count consecutive bounces for this user (no successful 'delivered' since)
  // 3. if >= 3 → UPDATE users SET email_recap_enabled = false WHERE id = ...
  // 4. return 200
}
```

Use Resend's webhook secret env var if configured.

### 8. Helpers

`features/recap/time.ts`:

```ts
export function computeLastFullWeekUtcMonday(now = new Date()): Date
export function computeSendAtSundayLocal(timezone: string, now = new Date()): Date
```

Use `Intl.DateTimeFormat` with `timeZone` to convert UTC↔local. Document the algorithm inline.

### 9. Integration test

`tests/integration/weekly-recap.test.ts`:

- Seed a user with activities across two weeks.
- Call `generateRecapForUser(userId, weekStart)`.
- Assert highlights include the right `topGrowth`, `stageUps`, `newLandmarks`, `stats`.
- Assert `hasActivity = true`.
- Call again with `weekStart` for a week with no activity → `hasActivity = false`.

Email template smoke (render-only):

```ts
import { render } from '@react-email/components'
import { WeeklyRecap } from '@/lib/email/templates/WeeklyRecap'
test('renders without throwing', () => {
  const html = render(<WeeklyRecap recapId="..." username="..." highlights={...} />)
  expect(html).toContain('See your full world')
})
```

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- weekly-recap
npm test -- email-render || echo "skipped if file absent"
grep -q "0 9 \* \* 0" features/sync/runner.ts
grep -q "computeSendAtSundayLocal\|sundayLocal" features/recap/time.ts
```

## How to verify AC

Run the AC commands. The recap and email-render tests must pass.

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT personalize the email subject line beyond `Your DevAtlas — this week`. Stable subjects improve inbox threading; personalization can come post-MVP.
- Do NOT send a recap to a user whose `email_recap_enabled = false`. Check at both list time and send time (race protection).
- Do NOT generate a recap for a user with no activity in the entire history of the account. Filter at `listUsersForRecap` (skip users whose `created_at > weekStart + 7 days`).
- Empty-week recap IS sent (with softer copy). Only `email_recap_enabled = false` skips entirely.
- Recap subject and body in English only.
- If the timezone field is empty/`'UTC'`, fan-out sends at Sunday 18:00 UTC.
- Idempotency: `weekly_recaps UNIQUE(user_id, week_start)` and `email_sends.external_message_id` tracking prevent duplicate sends.
