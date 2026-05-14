# Phase 8: Email Templates + Recap Pipeline

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` Flow 2 (Weekly recap return)
- `/docs/screens.md` §J Email templates (active / empty / first-week)
- `/docs/data-schema.md` §Weekly_Recaps (highlights JSONB shape) · §Email_Sends
- `/docs/adr.md` ADR-6 (Resend) · ADR-14 (UTC weeks + localized delivery) · ADR-32 (skip after 2 empty) · ADR-33 (diff persistence) · ADR-35 (no achievement copy) · ADR-36 (first-week)
- `/CLAUDE.md` (idempotency · time zone discipline)
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 7's output:

- Settings overhaul + account-deleted + unsubscribe pages exist
- `signUnsubscribeToken` is exported from `lib/email/unsubscribe-token.ts` (Phase 2)
- `npm run build` passes

Read the existing code:

- `features/recap/generate.ts`, `send.ts`, `diff.ts`, `time.ts` — current recap pipeline
- `lib/email/templates/WeeklyRecap.tsx`, `WeeklyRecapEmpty.tsx` — current templates
- `lib/email/client.ts` — Resend client

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Reshape the recap pipeline to populate the new `weekly_recaps.highlights` JSONB slot structure. Update / create 3 email templates. Enforce skip-after-2-empty policy. Wire unsubscribe URL.

### 1. `features/recap/slot-builder.ts`

Composes the 3-slot highlight payload from raw aggregations. Priority for slot 1: stage-up > brightest cluster.

```ts
import 'server-only'
import { TERRITORIES, type TerritoryType } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

export type RecapAggregations = {
  weekStart: Date
  stageUps: Array<{ territory: TerritoryType; from_stage: number; to_stage: number }>
  newStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightenedStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightestCluster: { territory: TerritoryType; growthPct: number } | null
  activity: { active_days: number; commits: number; prs_shipped: number }
}

export type HighlightsPayload = {
  kind: 'active' | 'empty' | 'first_week'
  slot_1?:
    | { kind: 'stage_up'; cluster_type: TerritoryType; from_stage: number; to_stage: number }
    | { kind: 'brightest_cluster'; cluster_type: TerritoryType; growth_pct: number }
  slot_2?:
    | { kind: 'new_stars'; tech_keys: string[] }
    | { kind: 'brightened_stars'; tech_keys: string[] }
  slot_3?: { kind: 'activity'; active_days: number; commits: number; prs_shipped: number }
  subject_pick: string  // e.g. "stage_up_backend_fortress", "new_stars_3", "brightest_backend", "empty"
  preview_text: string
}

export function buildHighlights(opts: {
  aggregations: RecapAggregations
  isFirstWeek: boolean
  isEmptyWeek: boolean
}): HighlightsPayload {
  const { aggregations: a, isFirstWeek, isEmptyWeek } = opts

  if (isEmptyWeek) {
    return {
      kind: 'empty',
      subject_pick: 'empty',
      preview_text: 'Steady week — your constellation is the same.',
    }
  }

  const kind = isFirstWeek ? 'first_week' : 'active'

  // Slot 1: stage-up > brightest cluster
  let slot_1: HighlightsPayload['slot_1']
  let subject_pick = ''
  if (a.stageUps.length > 0) {
    const s = a.stageUps[0]
    slot_1 = { kind: 'stage_up', cluster_type: s.territory, from_stage: s.from_stage, to_stage: s.to_stage }
    subject_pick = `stage_up_${s.territory}`
  } else if (a.brightestCluster) {
    slot_1 = {
      kind: 'brightest_cluster',
      cluster_type: a.brightestCluster.territory,
      growth_pct: Math.round(a.brightestCluster.growthPct),
    }
    subject_pick = `brightest_${a.brightestCluster.territory}`
  }

  // Slot 2: new stars > brightened
  let slot_2: HighlightsPayload['slot_2']
  if (a.newStars.length > 0) {
    slot_2 = { kind: 'new_stars', tech_keys: a.newStars.map((s) => s.tech_key) }
    if (!subject_pick) subject_pick = `new_stars_${a.newStars.length}`
  } else if (a.brightenedStars.length > 0) {
    slot_2 = { kind: 'brightened_stars', tech_keys: a.brightenedStars.map((s) => s.tech_key) }
  }

  // Slot 3: activity
  let slot_3: HighlightsPayload['slot_3']
  if (a.activity.commits + a.activity.prs_shipped > 0) {
    slot_3 = {
      kind: 'activity',
      active_days: a.activity.active_days,
      commits: a.activity.commits,
      prs_shipped: a.activity.prs_shipped,
    }
  }

  // Preview text composition: constellation change first, activity counts last (ADR — Flow 2 #25)
  const previewParts: string[] = []
  if (slot_1) {
    if (slot_1.kind === 'stage_up') {
      previewParts.push(`${TERRITORIES[slot_1.cluster_type].name} expanded`)
    } else {
      previewParts.push(`${TERRITORIES[slot_1.cluster_type].name} brightened`)
    }
  }
  if (slot_2 && slot_2.kind === 'new_stars') {
    previewParts.push(`${slot_2.tech_keys.length} new star${slot_2.tech_keys.length === 1 ? '' : 's'}`)
  } else if (slot_2 && slot_2.kind === 'brightened_stars') {
    previewParts.push(`${slot_2.tech_keys.length} brightened`)
  }
  if (slot_3) {
    previewParts.push(`${slot_3.commits} commits`)
  }

  return {
    kind,
    slot_1,
    slot_2,
    slot_3,
    subject_pick: subject_pick || 'active_default',
    preview_text: previewParts.join(' · '),
  }
}
```

### 2. `features/recap/subject-line.ts`

```ts
import 'server-only'
import { TERRITORIES, type TerritoryType } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import type { HighlightsPayload } from './slot-builder'

export function buildSubjectLine(h: HighlightsPayload): string {
  if (h.kind === 'empty') return 'Your sky — this week'
  if (h.kind === 'first_week') return 'Your first week on DevAstra'

  // Active week: priority stage-up > new star > brightest cluster
  if (h.slot_1?.kind === 'stage_up') {
    return `${TERRITORIES[h.slot_1.cluster_type].name} cluster expanded`
  }
  if (h.slot_2?.kind === 'new_stars') {
    const tks = h.slot_2.tech_keys
    if (tks.length === 1) {
      const name = getPublicTech(tks[0])?.displayName ?? tks[0]
      return `${name} is new this week`
    }
    return `${tks.length} new stars this week`
  }
  if (h.slot_1?.kind === 'brightest_cluster') {
    return `${TERRITORIES[h.slot_1.cluster_type].name} brightened`
  }

  return 'Your sky — this week'
}
```

### 3. Update `features/recap/diff.ts`

Diff calculations for the past UTC week. Compute:

- `stageUps` from `territories.stage_changed_at > weekStart`.
- `newStars` from `landmarks.first_unlocked_at` in `[weekStart, weekEnd)`.
- `brightenedStars` from `landmarks.last_grown_at` in `[weekStart, weekEnd)` AND `first_unlocked_at < weekStart`.
- `brightestCluster` from comparing `territories.growth_30d` (or a week-scoped query) per cluster, pick the maximum growth.
- `activity`: count distinct `activities.occurred_at` days in `[weekStart, weekEnd)`, `commits`, `prs_shipped`.

Signature:

```ts
import 'server-only'
import type { TerritoryType } from '@/features/territories/registry'

export type WeekAggregations = {
  weekStart: Date  // Monday 00:00 UTC
  stageUps: Array<{ territory: TerritoryType; from_stage: number; to_stage: number }>
  newStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightenedStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightestCluster: { territory: TerritoryType; growthPct: number } | null
  activity: { active_days: number; commits: number; prs_shipped: number }
}

export async function computeWeekAggregations(opts: {
  userId: string
  weekStart: Date
}): Promise<WeekAggregations> {
  // Implementation: 4-5 separate Drizzle queries, all scoped via withUserScopeAnd.
  return /* ... */ null as any
}
```

### 4. Update `features/recap/generate.ts`

```ts
import 'server-only'
import { eq, and, gte, lt, isNotNull, desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { weeklyRecaps } from '@/lib/db/schema/weekly-recaps'
import { users } from '@/lib/db/schema/users'
import { computeWeekAggregations } from './diff'
import { buildHighlights } from './slot-builder'

export async function generateWeeklyRecapForUser(opts: {
  userId: string
  weekStart: Date  // Monday 00:00 UTC
}): Promise<{ recapId: string; kind: 'active' | 'empty' | 'first_week'; shouldSend: boolean }> {
  const aggregations = await computeWeekAggregations({ userId: opts.userId, weekStart: opts.weekStart })

  const isEmpty =
    aggregations.stageUps.length === 0 &&
    aggregations.newStars.length === 0 &&
    aggregations.brightenedStars.length === 0 &&
    aggregations.activity.commits === 0 &&
    aggregations.activity.prs_shipped === 0

  // First-week detection: user's first Monday-aligned recap
  const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, opts.userId)).limit(1)
  if (!user) throw new Error('user not found')
  const firstMondayAfterSignup = nextMondayUtc(user.createdAt)
  const isFirstWeek = +opts.weekStart === +firstMondayAfterSignup

  const highlights = buildHighlights({ aggregations, isFirstWeek, isEmptyWeek: isEmpty })

  // UPSERT weekly_recaps (unique on (user_id, week_start))
  const inserted = await db
    .insert(weeklyRecaps)
    .values({
      userId: opts.userId,
      weekStart: opts.weekStart,  // Drizzle date col; ensure DATE type accepted
      highlights,
    })
    .onConflictDoUpdate({
      target: [weeklyRecaps.userId, weeklyRecaps.weekStart],
      set: { highlights },
    })
    .returning({ id: weeklyRecaps.id })

  // Skip-after-2-empty policy (ADR-32):
  //   If this is empty AND the previous week's recap was also empty → don't send.
  //   But still UPSERT the row for record (so the next cycle can detect).
  let shouldSend = true
  if (isEmpty) {
    const previousMonday = new Date(opts.weekStart)
    previousMonday.setUTCDate(previousMonday.getUTCDate() - 7)
    const [prev] = await db
      .select()
      .from(weeklyRecaps)
      .where(and(eq(weeklyRecaps.userId, opts.userId), eq(weeklyRecaps.weekStart, previousMonday)))
      .limit(1)
    const prevHighlights = prev?.highlights as { kind?: string } | undefined
    if (prevHighlights?.kind === 'empty') {
      shouldSend = false
    }
  }

  return { recapId: inserted[0].id, kind: highlights.kind, shouldSend }
}

function nextMondayUtc(date: Date): Date {
  const d = new Date(date)
  const dow = d.getUTCDay()
  const daysUntilMonday = dow === 0 ? 1 : (8 - dow) % 7 || 7  // next Monday strictly after `date`
  // For simplicity, snap to the Monday after `date.getUTCDate()`:
  d.setUTCDate(d.getUTCDate() + daysUntilMonday)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
```

The Inngest cron `recap/weekly.generated` at Sunday 09:00 UTC fans out to call `generateWeeklyRecapForUser` for every user with `users.email_recap_enabled = true` AND `users.github_access_token_enc IS NOT NULL`. The fan-out runner already exists in `features/sync/runner.ts` or `features/recap/`. Adapt to call the new generator + dispatch send when `shouldSend = true`.

### 5. Update `features/recap/send.ts`

```ts
import 'server-only'
import { resend } from '@/lib/email/client'
import { signUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { db } from '@/lib/db/client'
import { weeklyRecaps } from '@/lib/db/schema/weekly-recaps'
import { users } from '@/lib/db/schema/users'
import { emailSends } from '@/lib/db/schema/email-sends'
import { eq } from 'drizzle-orm'
import { WeeklyRecapActive } from '@/lib/email/templates/WeeklyRecapActive'
import { WeeklyRecapEmpty } from '@/lib/email/templates/WeeklyRecapEmpty'
import { WeeklyRecapFirstWeek } from '@/lib/email/templates/WeeklyRecapFirstWeek'
import { buildSubjectLine } from './subject-line'
import { ogVersionParam } from '@/lib/og/version'

export async function sendWeeklyRecapEmail(opts: { recapId: string }) {
  const [recap] = await db.select().from(weeklyRecaps).where(eq(weeklyRecaps.id, opts.recapId)).limit(1)
  if (!recap) throw new Error('recap not found')
  const [user] = await db.select().from(users).where(eq(users.id, recap.userId)).limit(1)
  if (!user) throw new Error('user not found')
  if (!user.emailRecapEnabled) return  // user opted out between generation and send
  if (!user.email) return

  const highlights = recap.highlights as any  // typed via HighlightsPayload
  const subject = buildSubjectLine(highlights)
  const ogUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'}/api/og/recap/${recap.id}?${ogVersionParam()}`
  const emailType: 'weekly_recap_active' | 'weekly_recap_empty' | 'weekly_recap_first_week' =
    highlights.kind === 'empty' ? 'weekly_recap_empty'
    : highlights.kind === 'first_week' ? 'weekly_recap_first_week'
    : 'weekly_recap_active'
  const unsubscribeToken = await signUnsubscribeToken(user.id, emailType)
  const unsubscribeUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'}/unsubscribe?token=${unsubscribeToken}`
  const ctaUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'}/?from=recap&week=${recap.weekStart}`

  const Template =
    highlights.kind === 'empty' ? WeeklyRecapEmpty
    : highlights.kind === 'first_week' ? WeeklyRecapFirstWeek
    : WeeklyRecapActive

  const result = await resend.emails.send({
    from: 'DevAstra <hello@devastra.app>',
    to: user.email,
    subject,
    react: <Template
      ogUrl={ogUrl}
      highlights={highlights}
      ctaUrl={ctaUrl}
      unsubscribeUrl={unsubscribeUrl}
      displayUsername={user.displayUsername}
    />,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  await db.insert(emailSends).values({
    userId: user.id,
    emailType,
    relatedId: recap.id,
    externalMessageId: result.data?.id ?? null,
    bounced: false,
  })

  await db.update(weeklyRecaps).set({ emailSentAt: new Date() }).where(eq(weeklyRecaps.id, recap.id))
}
```

### 6. Email templates

#### `lib/email/templates/WeeklyRecapActive.tsx`

```tsx
import { Html, Head, Preview, Body, Container, Heading, Text, Img, Link, Section } from '@react-email/components'
import type { HighlightsPayload } from '@/features/recap/slot-builder'
import { TERRITORIES } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

export function WeeklyRecapActive(props: {
  ogUrl: string
  highlights: HighlightsPayload
  ctaUrl: string
  unsubscribeUrl: string
  displayUsername: string
}): JSX.Element {
  const { highlights: h, ogUrl, ctaUrl, unsubscribeUrl } = props
  return (
    <Html>
      <Head />
      <Preview>{h.preview_text}</Preview>
      <Body style={{ backgroundColor: '#0b1020', fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px', color: '#f1f5f9' }}>
          {/* Header */}
          <Text style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', margin: 0, marginBottom: 24 }}>DevAstra</Text>

          {/* Hero OG image */}
          <Img src={ogUrl} alt="Your DevAstra constellation, this week" width="552" height="290"
               style={{ width: '100%', height: 'auto', borderRadius: 12, marginBottom: 24 }} />

          {/* Slot 1 */}
          {h.slot_1 && (
            <Heading as="h2" style={{ color: '#f8fafc', fontSize: 20, margin: '8px 0' }}>
              {h.slot_1.kind === 'stage_up'
                ? `${TERRITORIES[h.slot_1.cluster_type].name} cluster expanded`
                : `${TERRITORIES[h.slot_1.cluster_type].name} brightened most this week`}
            </Heading>
          )}

          {/* Slot 2 */}
          {h.slot_2 && (
            <Text style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.5 }}>
              {h.slot_2.kind === 'new_stars'
                ? renderNewStars(h.slot_2.tech_keys)
                : renderBrightenedStars(h.slot_2.tech_keys)}
            </Text>
          )}

          {/* Slot 3 */}
          {h.slot_3 && (
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              {[
                h.slot_3.active_days > 0 && `${h.slot_3.active_days} active days`,
                h.slot_3.commits > 0 && `${h.slot_3.commits} commits`,
                h.slot_3.prs_shipped > 0 && `${h.slot_3.prs_shipped} PRs shipped`,
              ].filter(Boolean).join(' · ')}
            </Text>
          )}

          {/* CTA */}
          <Section style={{ marginTop: 32, marginBottom: 32 }}>
            <Link href={ctaUrl} style={{ backgroundColor: '#3b82f6', color: '#fff', padding: '12px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
              See what's new →
            </Link>
          </Section>

          {/* Footer */}
          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 32 }}>
            <Link href={unsubscribeUrl} style={{ color: '#64748b' }}>Unsubscribe</Link> ·{' '}
            <Link href="https://devastra.app/privacy" style={{ color: '#64748b' }}>Privacy</Link> ·{' '}
            <Link href="https://devastra.app/settings" style={{ color: '#64748b' }}>Settings</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

function renderNewStars(techKeys: string[]): string {
  if (techKeys.length === 0) return ''
  const names = techKeys.map((tk) => getPublicTech(tk)?.displayName ?? tk)
  if (names.length === 1) return `${names[0]} is new this week`
  if (names.length <= 3) return `${names.join(', ')} are new this week`
  return `${names.length} new stars this week — ${names.slice(0, 3).join(', ')}, +${names.length - 3}`
}

function renderBrightenedStars(techKeys: string[]): string {
  if (techKeys.length === 0) return ''
  const names = techKeys.map((tk) => getPublicTech(tk)?.displayName ?? tk)
  return `${names.length} star${names.length === 1 ? '' : 's'} brightened — ${names.slice(0, 3).join(', ')}`
}
```

#### `lib/email/templates/WeeklyRecapEmpty.tsx`

```tsx
import { Html, Head, Preview, Body, Container, Text, Img, Link, Section } from '@react-email/components'

export function WeeklyRecapEmpty(props: {
  ogUrl: string
  highlights: any  // empty kind doesn't use slot data
  ctaUrl: string
  unsubscribeUrl: string
  displayUsername: string
}): JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Steady week — your constellation is the same.</Preview>
      <Body style={{ backgroundColor: '#0b1020', fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px', color: '#f1f5f9' }}>
          <Text style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', margin: 0, marginBottom: 24 }}>DevAstra</Text>
          <Img src={props.ogUrl} alt="Your DevAstra constellation, this week" width="552" height="290"
               style={{ width: '100%', height: 'auto', borderRadius: 12, marginBottom: 24 }} />
          <Text style={{ color: '#cbd5e1', fontSize: 16 }}>Steady week — your constellation is the same.</Text>
          <Section style={{ marginTop: 24 }}>
            <Link href={props.ctaUrl} style={{ backgroundColor: '#3b82f6', color: '#fff', padding: '12px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
              See your sky →
            </Link>
          </Section>
          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 32 }}>
            <Link href={props.unsubscribeUrl} style={{ color: '#64748b' }}>Unsubscribe</Link> ·{' '}
            <Link href="https://devastra.app/privacy" style={{ color: '#64748b' }}>Privacy</Link> ·{' '}
            <Link href="https://devastra.app/settings" style={{ color: '#64748b' }}>Settings</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

#### `lib/email/templates/WeeklyRecapFirstWeek.tsx`

Same shell as Active, but the headline area is replaced or augmented:

- If empty: `Welcome — push a commit to begin your constellation.` + CTA "See your sky →".
- If has new stars: highlight the first lit star inline above the standard 3-slot rendering: `Your first star: {displayName}`.

```tsx
import { Html, Head, Preview, Body, Container, Heading, Text, Img, Link, Section } from '@react-email/components'
import type { HighlightsPayload } from '@/features/recap/slot-builder'
import { TERRITORIES } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

export function WeeklyRecapFirstWeek(props: {
  ogUrl: string
  highlights: HighlightsPayload
  ctaUrl: string
  unsubscribeUrl: string
  displayUsername: string
}): JSX.Element {
  const h = props.highlights
  const hasNewStars = h.slot_2?.kind === 'new_stars' && h.slot_2.tech_keys.length > 0
  const firstStar = hasNewStars && h.slot_2?.kind === 'new_stars' ? h.slot_2.tech_keys[0] : null

  return (
    <Html>
      <Head />
      <Preview>{h.preview_text || 'Welcome to your first week on DevAstra.'}</Preview>
      <Body style={{ backgroundColor: '#0b1020', fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px', color: '#f1f5f9' }}>
          <Text style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', margin: 0, marginBottom: 24 }}>DevAstra</Text>
          <Img src={props.ogUrl} alt="Your DevAstra constellation, week 1" width="552" height="290"
               style={{ width: '100%', height: 'auto', borderRadius: 12, marginBottom: 24 }} />

          {firstStar ? (
            <Heading as="h2" style={{ color: '#f8fafc', fontSize: 22, margin: '8px 0' }}>
              Your first star: {getPublicTech(firstStar)?.displayName ?? firstStar}
            </Heading>
          ) : (
            <Heading as="h2" style={{ color: '#f8fafc', fontSize: 20, margin: '8px 0' }}>
              Welcome — push a commit to begin your constellation.
            </Heading>
          )}

          {/* Slot 1, 2, 3 — copy reuses the Active template's renderers */}
          {/* (Inline for brevity, or extract to a shared subcomponent.) */}

          <Section style={{ marginTop: 32 }}>
            <Link href={props.ctaUrl} style={{ backgroundColor: '#3b82f6', color: '#fff', padding: '12px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
              {firstStar ? "See what's new →" : 'See your sky →'}
            </Link>
          </Section>

          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 32 }}>
            <Link href={props.unsubscribeUrl} style={{ color: '#64748b' }}>Unsubscribe</Link> ·{' '}
            <Link href="https://devastra.app/privacy" style={{ color: '#64748b' }}>Privacy</Link> ·{' '}
            <Link href="https://devastra.app/settings" style={{ color: '#64748b' }}>Settings</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

### 7. Delete or remove old `WeeklyRecap.tsx`

`lib/email/templates/WeeklyRecap.tsx` is replaced by `WeeklyRecapActive.tsx`. Delete the old file. If `tests/integration/recap-email.test.ts` (or similar) imports `WeeklyRecap`, update to `WeeklyRecapActive`.

### 8. Snapshot tests

`tests/integration/email-templates.test.ts`:

```ts
import { render } from '@react-email/render'
import { describe, it, expect } from 'vitest'
import { WeeklyRecapActive } from '@/lib/email/templates/WeeklyRecapActive'
import { WeeklyRecapEmpty } from '@/lib/email/templates/WeeklyRecapEmpty'
import { WeeklyRecapFirstWeek } from '@/lib/email/templates/WeeklyRecapFirstWeek'

const mockHighlights = {
  active: {
    kind: 'active' as const,
    slot_1: { kind: 'stage_up' as const, cluster_type: 'backend_fortress' as const, from_stage: 1, to_stage: 2 },
    slot_2: { kind: 'new_stars' as const, tech_keys: ['docker', 'postgres'] },
    slot_3: { kind: 'activity' as const, active_days: 5, commits: 12, prs_shipped: 3 },
    subject_pick: 'stage_up_backend_fortress',
    preview_text: 'Backend expanded · 2 new stars · 12 commits',
  },
  empty: { kind: 'empty' as const, subject_pick: 'empty', preview_text: 'Steady week — your constellation is the same.' },
  firstWeek: {
    kind: 'first_week' as const,
    slot_2: { kind: 'new_stars' as const, tech_keys: ['typescript'] },
    subject_pick: 'first_week',
    preview_text: 'Your first star: TypeScript',
  },
}

describe('email templates', () => {
  const baseProps = {
    ogUrl: 'https://example.test/og.png',
    ctaUrl: 'https://example.test/?from=recap',
    unsubscribeUrl: 'https://example.test/unsubscribe?token=xxx',
    displayUsername: 'tester',
  }

  it('renders active variant', async () => {
    const html = await render(WeeklyRecapActive({ ...baseProps, highlights: mockHighlights.active }))
    expect(html).toMatchSnapshot()
  })

  it('renders empty variant', async () => {
    const html = await render(WeeklyRecapEmpty({ ...baseProps, highlights: mockHighlights.empty }))
    expect(html).toMatchSnapshot()
  })

  it('renders first-week variant with a first star', async () => {
    const html = await render(WeeklyRecapFirstWeek({ ...baseProps, highlights: mockHighlights.firstWeek }))
    expect(html).toMatchSnapshot()
  })
})
```

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Unit + integration tests
npx vitest run tests/unit
npx vitest run tests/integration/email-templates.test.ts

# New email templates exist
test -f lib/email/templates/WeeklyRecapActive.tsx
test -f lib/email/templates/WeeklyRecapEmpty.tsx
test -f lib/email/templates/WeeklyRecapFirstWeek.tsx

# Old template removed
test ! -f lib/email/templates/WeeklyRecap.tsx

# slot-builder + subject-line + updated diff/generate/send
test -f features/recap/slot-builder.ts
test -f features/recap/subject-line.ts

# Snapshot files exist (after first test run)
[ -d tests/integration/__snapshots__ ] || test -f tests/integration/email-templates.test.ts.snap
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 8 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **All times UTC** for storage and aggregation (ADR-14). Per-user local-time delivery is handled by the Inngest fan-out delay layer.
- **`weekly_recaps` row is UPSERTed even for empty weeks.** The `shouldSend` flag controls dispatching, not storage. This lets ADR-32 detect consecutive empty weeks.
- **Skip-after-2-empty (ADR-32) is enforced in `generateWeeklyRecapForUser`.** First empty week → send. Second consecutive empty week → no send (still UPSERT). Activity resumes → next cycle sends again normally.
- **Unsubscribe URL format**: token-based, no expiry; can be invalidated via `UNSUBSCRIBE_TOKEN_VERSION` bump (ADR-48).
- **`List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers** are mandatory for Gmail / Yahoo's one-click unsubscribe (RFC 8058). Phase 8 wires them.
- **Email_sends row is recorded for every successful send.** The `external_message_id` is Resend's id; bounce webhook (Phase 10) updates `bounced = true`.
- **Subject line is single-purpose** — do NOT add username or "DevAstra" prefix for active variants (ADR — Flow 2 #269). The first-week variant explicitly contains "DevAstra" by design.
- **Reduced-motion** is a CSS concern; emails do not animate, so no special handling required here.
- **First-week detection** uses the user's `created_at` timestamp. If the user signed up Saturday, the first Sunday recap is partial — the template handles this gracefully with the welcome / first-star copy.
- **Dark-mode email rendering**: the dark sky background is intentional. Gmail dark mode may invert; the OG image is an image so its content is preserved. Body text uses light gray (`#cbd5e1`, `#f1f5f9`) which renders correctly in both light and dark clients.
