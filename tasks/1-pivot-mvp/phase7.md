# Phase 7: Settings Overhaul + Account-Deleted + Unsubscribe

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` Flow 5 (Settings) · Sub-flow J §unsubscribe · Sub-flow K (auth edge cases)
- `/docs/screens.md` §F Settings · §E.1 Disconnect modal · §E.2 Delete account modal · §A.5 Account deleted · §M3 sign-out state · §M4 unsubscribe pages
- `/docs/adr.md` ADR-13 (disconnect preserves) · ADR-15 (reserved usernames) · ADR-30 (permanent redirect + reservation) · ADR-31 (hard delete) · ADR-32 (recap skip) · ADR-44 (legal markdown) · ADR-45 (one-click unsubscribe) · ADR-48 (token versioning)
- `/CLAUDE.md` (server-only · idempotency)
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 6's output:

- `app/[username]/page.tsx` renders three variants
- `app/not-found.tsx`, `app/rate-limited/page.tsx`, `app/_components/PrivateProfile.tsx` exist
- Username history redirect works
- `npm run build` passes

Read the existing code:

- `app/(authenticated)/settings/page.tsx` and `_actions.ts` — current settings page
- `app/(authenticated)/settings/_sections/*` — existing section components
- `lib/utils/reserved-usernames.ts` (Phase 2)
- `lib/email/unsubscribe-token.ts` (Phase 2)
- `lib/utils/username-redirect.ts` (Phase 2)

Carefully read the code from previous phases. Understand the design intent before working.

## Work

This phase overhauls settings, adds the unsubscribe surface, and the account-deleted transitional page. Several Server Actions are introduced or updated.

### 1. Restructure `app/(authenticated)/settings/page.tsx`

The page is a single long column, max 800px centered. Header: `← Back` link (to `/`) + page title `Settings` + avatar dropdown (right).

Section order (top → bottom), each separated by horizontal dividers (no card backgrounds):

1. **Account info** (read-only).
2. **Public profile**.
3. **Email recap**.
4. **Timezone**.
5. **Username change**.
6. **Included repos** (collapsed by default).
7. **Danger zone** (red bordered box at the bottom, two sub-sections: Disconnect, Delete).

Each section is a child client component co-located under `app/(authenticated)/settings/_sections/`. Update or create:

#### `_sections/account-info.tsx`

```tsx
'use client'
export function AccountInfoSection(props: {
  avatarUrl: string | null
  displayUsername: string
  email: string
}): JSX.Element {
  // Compact: avatar + `@{displayUsername}` on one line, email below.
  return /* ... */ null as any
}
```

#### `_sections/public-profile.tsx`

```tsx
'use client'
import { useTransition, useState } from 'react'
import { setPublicProfile } from '../_actions'
import { toast } from 'sonner'

export function PublicProfileSection(props: {
  initialIsPublic: boolean
  displayUsername: string
  baseUrl: string  // e.g. "https://devastra.app"
}): JSX.Element {
  const [isPublic, setIsPublic] = useState(props.initialIsPublic)
  const [pending, startTransition] = useTransition()

  function onToggle(next: boolean) {
    setIsPublic(next)
    startTransition(async () => {
      await setPublicProfile(next)
      if (next) {
        // No additional toast — the inline URL expansion is the confirmation.
      } else {
        toast('Your constellation is now private. Existing shared links will show a private placeholder.')
      }
    })
  }

  // Render:
  //   Section header: "Public profile"
  //   Helper text: "Make your constellation public at devastra.app/{username}"
  //   Toggle.
  //   When isPublic === true, inline expansion below the toggle:
  //     - Full URL `{baseUrl}/{displayUsername}` displayed.
  //     - [Copy] button → copy URL to clipboard.
  //     - [Preview →] link → open `/{displayUsername}` in a new tab.
  return /* ... */ null as any
}
```

#### `_sections/email-recap.tsx`

```tsx
'use client'
export function EmailRecapSection(props: {
  initialEnabled: boolean
  nextRecapDate: string  // formatted e.g. "May 18"
}): JSX.Element {
  // Toggle + sub-text: "Sundays. Skipped after 2 quiet weeks. Next recap: {nextRecapDate}"
  // Auto-save on toggle. Toast: "Weekly recap {enabled|disabled}".
  return /* ... */ null as any
}
```

The "Next recap date" computation: the next Sunday after `NOW()` in the user's timezone. If the previous 2 weeks were empty, the user might not actually receive an email — but the date reflects the cron schedule (the skip logic is internal).

#### `_sections/timezone.tsx`

```tsx
'use client'
export function TimezoneSection(props: {
  initialTimezone: string
  initialPreviewLine: string  // formatted "Your weekly recap arrives Sunday at 6 PM in this timezone."
}): JSX.Element {
  // IANA dropdown. Auto-save on change → toast "Timezone updated".
  // Live update of the preview line using browser-side recomputation (or trigger Server Action that returns the recomputed line and re-renders).
  return /* ... */ null as any
}
```

#### `_sections/username-change.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import { changeUsername, checkUsernameAvailable } from '../_actions'

export function UsernameChangeSection(props: {
  currentUsername: string
  githubLogin: string  // for self-match exception (ADR-15)
}): JSX.Element {
  const [draft, setDraft] = useState(props.currentUsername)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, startTransition] = useTransition()

  // Inline live validation:
  //   - regex /^[a-z0-9-_]+$/
  //   - length 2-30
  //   - reserved name check (call isReservedUsername; allow if draft === githubLogin per ADR-15)
  //   - collision check via Server Action (debounced)
  // Validation copy:
  //   - <2 chars: "At least 2 characters"
  //   - >30: "Up to 30 characters"
  //   - regex: "Only lowercase letters, numbers, hyphens, and underscores"
  //   - reserved: "This name is reserved"
  //   - collision: "This name is taken"
  // Show live URL preview: `devastra.app/{draft}` (gray text below input).
  //
  // Save button (disabled when invalid OR when draft === currentUsername).
  // On save success:
  //   - Toast: "Username updated"
  //   - Helper text below: "Anyone with your old URL devastra.app/{old} will be redirected to your new one."
  //   - Update currentUsername in local state.
  return /* ... */ null as any
}
```

#### `_sections/included-repos.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import { updateIncludedRepos } from '../_actions'

type Repo = {
  id: string
  owner: string
  name: string
  primaryLanguage: string | null
  isIncluded: boolean
  last90DaysCommits: number
  lastActivityAt: string | null  // ISO
  contributingClusters: string[] // territory_type values
}

export function IncludedReposSection(props: {
  repos: Repo[]
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts] = useState<Map<string, boolean>>(new Map())
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [saving, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState('')

  // Default: collapsed with summary line "{N} of {M} repos included".
  // Click "Edit" → expand to reveal:
  //   - Search input (sticky if scroll).
  //   - List of repos: each row with name, language icon, last activity, 90-day commits, cluster-color dots.
  //   - Toggle per repo.
  //   - Save button → opens pre-save change summary modal (see below).
  //
  // Pre-save modal computes affected stars:
  //   For each repo being de-included, count its contributing landmarks (sum activity_territories weights).
  //   Render: "These changes will affect your constellation:" + bullet list.
  //   "Some changes may take effect after backfill completes." fallback when estimation is fuzzy.
  //   Confirm button → call updateIncludedRepos(); dispatches sync/backfill.requested via Inngest.
  //   Settings page closes (router.push('/')) so user sees backfill progress in the main constellation sync indicator.
  return /* ... */ null as any
}
```

#### `_sections/danger-zone.tsx`

```tsx
'use client'
import { useState } from 'react'
import { DisconnectConfirmModal } from './disconnect-confirm-modal'
import { DeleteAccountModal } from './delete-account-modal'

export function DangerZoneSection(props: {
  displayUsername: string
}): JSX.Element {
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Render a red-bordered <section> with heading "Danger zone".
  // Sub-section 1: Disconnect GitHub
  //   - Description: "Disconnect your GitHub account. Your constellation will be preserved; you can reconnect anytime."
  //   - Button (text red): "Disconnect GitHub" → opens DisconnectConfirmModal.
  // Sub-section 2: Delete account
  //   - Description: "Permanently delete your account, constellation, and all associated data."
  //   - Button (text red): "Delete account" → opens DeleteAccountModal.
  return /* ... */ null as any
}
```

#### `_sections/disconnect-confirm-modal.tsx`

```tsx
'use client'
import { useTransition } from 'react'
import { disconnectGitHub } from '../_actions'

export function DisconnectConfirmModal(props: { open: boolean; onClose: () => void }): JSX.Element | null {
  const [pending, startTransition] = useTransition()
  if (!props.open) return null

  function onConfirm() {
    startTransition(async () => {
      await disconnectGitHub()
      // Server redirects to / with banner state. The Server Action calls revalidatePath('/').
      props.onClose()
    })
  }

  // Modal layout:
  //   Heading: "Disconnect GitHub?"
  //   Body: "Your constellation stays. Public profile becomes private. Reconnect anytime."
  //   Buttons: Cancel (text link, left), Disconnect (red filled, right).
  //   Dismiss: X / Cancel / ESC. Outside-click disabled.
  //   Mobile: centered modal (not full-screen).
  return /* ... */ null as any
}
```

#### `_sections/delete-account-modal.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import { deleteAccount } from '../_actions'

export function DeleteAccountModal(props: {
  open: boolean
  displayUsername: string
  onClose: () => void
}): JSX.Element | null {
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()
  if (!props.open) return null

  const matches = input === props.displayUsername

  function onConfirm() {
    if (!matches) return
    startTransition(async () => {
      await deleteAccount()
      // Server redirects to /account-deleted. No client-side router action needed beyond closing.
    })
  }

  // Modal layout:
  //   Heading: "Delete your account"
  //   Body: "This cannot be undone. We will delete:"
  //     Bulleted list:
  //       - Your constellation
  //       - All weekly recaps
  //       - Your public profile
  //       - All account data
  //   Input: label "Type your username to confirm: {displayUsername}"
  //   Buttons: Cancel (text link, left), "Permanently delete" (red filled, right, DISABLED unless matches).
  //   Dismiss: X / Cancel / ESC. Outside-click disabled.
  //   Mobile: full-screen modal (severity signal).
  return /* ... */ null as any
}
```

### 2. Server Actions in `app/(authenticated)/settings/_actions.ts`

```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { usernameHistory } from '@/lib/db/schema/username-history'
import { repositories } from '@/lib/db/schema/repositories'
import { requireUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/auth/supabase-server'
import { isReservedUsername } from '@/lib/utils/reserved-usernames'
import { inngest } from '@/inngest.config'  // or wherever Inngest sender lives

// ── Public toggle ────────────────────────────────────────────────────────────
export async function setPublicProfile(isPublic: boolean) {
  const user = await requireUser()
  await db.update(users).set({ isPublic }).where(eq(users.id, user.id))
  revalidatePath(`/${user.displayUsername}`)
  revalidatePath('/settings')
}

// ── Email recap toggle ───────────────────────────────────────────────────────
export async function setEmailRecapEnabled(enabled: boolean) {
  const user = await requireUser()
  await db.update(users).set({ emailRecapEnabled: enabled }).where(eq(users.id, user.id))
}

// ── Timezone ─────────────────────────────────────────────────────────────────
const tzSchema = z.string().min(3).max(60)
export async function setTimezone(tz: string) {
  const user = await requireUser()
  const parsed = tzSchema.parse(tz)
  await db.update(users).set({ timezone: parsed }).where(eq(users.id, user.id))
}

// ── Username availability check ─────────────────────────────────────────────
export async function checkUsernameAvailable(draft: string): Promise<
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'reserved' }
  | { kind: 'invalid'; reason: string }
> {
  const user = await requireUser()
  const lower = draft.toLowerCase()
  if (lower === user.displayUsername) return { kind: 'available' }  // same as current
  if (!/^[a-z0-9-_]+$/.test(lower)) return { kind: 'invalid', reason: 'regex' }
  if (lower.length < 2) return { kind: 'invalid', reason: 'too_short' }
  if (lower.length > 30) return { kind: 'invalid', reason: 'too_long' }

  // Self-match exception (ADR-15): user may set their displayUsername to their GitHub login
  // even if it appears in the reserved list.
  if (isReservedUsername(lower) && lower !== user.githubLogin.toLowerCase()) {
    return { kind: 'reserved' }
  }

  const existing = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.displayUsername, lower), ne(users.id, user.id))).limit(1)
  if (existing.length > 0) return { kind: 'taken' }

  // Also check username_history (reserved by another user) per ADR-30
  const histExisting = await db.select({ userId: usernameHistory.userId }).from(usernameHistory)
    .where(eq(usernameHistory.oldUsername, lower)).limit(1)
  if (histExisting.length > 0 && histExisting[0].userId !== user.id) return { kind: 'reserved' }

  return { kind: 'available' }
}

// ── Username change ──────────────────────────────────────────────────────────
export async function changeUsername(newUsername: string) {
  const user = await requireUser()
  const lower = newUsername.toLowerCase()
  const result = await checkUsernameAvailable(lower)
  if (result.kind !== 'available') {
    throw new Error(`Username change rejected: ${result.kind}`)
  }
  if (lower === user.displayUsername) return  // no-op

  // Atomic: insert old username into history, then update users.
  await db.transaction(async (tx) => {
    await tx.insert(usernameHistory).values({
      oldUsername: user.displayUsername,
      userId: user.id,
    })
    await tx.update(users).set({ displayUsername: lower }).where(eq(users.id, user.id))
  })

  revalidatePath(`/${user.displayUsername}`)
  revalidatePath(`/${lower}`)
}

// ── Included repos ───────────────────────────────────────────────────────────
const reposSchema = z.array(z.object({ id: z.string().uuid(), isIncluded: z.boolean() }))
export async function updateIncludedRepos(updates: z.infer<typeof reposSchema>) {
  const user = await requireUser()
  const parsed = reposSchema.parse(updates)

  await db.transaction(async (tx) => {
    for (const u of parsed) {
      await tx.update(repositories)
        .set({ isIncluded: u.isIncluded })
        .where(and(eq(repositories.id, u.id), eq(repositories.userId, user.id)))
    }
  })

  // Dispatch backfill via Inngest
  await inngest.send({
    name: 'sync/backfill.requested',
    data: { user_id: user.id },
  })

  redirect('/')
}

// ── Disconnect GitHub ────────────────────────────────────────────────────────
export async function disconnectGitHub() {
  const user = await requireUser()
  await db.update(users).set({
    githubAccessTokenEnc: null,
    githubRefreshTokenEnc: null,
    githubTokenExpiresAt: null,
    isPublic: false,  // visibility reverts (ADR-13)
  }).where(eq(users.id, user.id))
  revalidatePath(`/${user.displayUsername}`)
  redirect('/')
}

// ── Delete account ───────────────────────────────────────────────────────────
export async function deleteAccount() {
  const user = await requireUser()
  const supabase = createAdminClient()
  // Cascade triggers will remove all public.* rows tied to user.id.
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) throw new Error('Account deletion failed; please contact support.')
  redirect('/account-deleted')
}
```

### 3. Account-deleted page

`app/account-deleted/page.tsx`:

```tsx
import Link from 'next/link'

export default function AccountDeletedPage(): JSX.Element {
  // Dim sky background.
  // Copy: "Thanks for trying DevAstra. Your account has been deleted."
  // Action: <Link href="/">Go to landing now →</Link>
  //
  // Auto-redirect after 5s via small client component (or <meta http-equiv="refresh" content="5; url=/">).
  // Note: avoid hard redirect that destroys the click-to-skip; both must work.
  return /* ... */ null as any
}
```

### 4. Unsubscribe pages

#### `app/unsubscribe/page.tsx`

Renders based on a `token` query param.

```tsx
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { eq } from 'drizzle-orm'

type Status = 'success' | 'expired' | 'invalid'

export default async function UnsubscribePage(props: { searchParams: { token?: string } }): Promise<JSX.Element> {
  const token = props.searchParams.token
  let status: Status = 'invalid'
  if (token) {
    const result = await verifyUnsubscribeToken(token)
    if (result.ok) {
      // Idempotent: update email_recap_enabled = false.
      // Note: this runs on the server during render; for a true POST-only path, see /api/unsubscribe.
      // The link in emails will route through this page; we accept idempotent GET here since the operation
      // is a setting toggle. POST endpoint also exists for explicit confirmation flow.
      await db.update(users).set({ emailRecapEnabled: false }).where(eq(users.id, result.payload.user_id))
      status = 'success'
    } else if (result.reason === 'version_mismatch') {
      status = 'expired'
    } else {
      status = 'invalid'
    }
  }

  if (status === 'success') {
    // M4.1: success page
    // Heading: "You've been unsubscribed from weekly recaps."
    // Sub-line: "You'll no longer receive Sunday recap emails. Your constellation and account remain."
    // Undo (30s, client-side): button that calls POST /api/unsubscribe/undo with the same token.
    // Below: <a href="/">Sign in to manage your email preferences →</a>
  } else {
    // M4.2: expired/invalid page
    // Copy: "This unsubscribe link has expired. Sign in to manage your email preferences."
    // <a href="/">Sign in →</a>
  }
  return /* ... */ null as any
}
```

#### `app/api/unsubscribe/route.ts` (POST handler for explicit confirmation + undo)

```ts
import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

const bodySchema = z.object({
  token: z.string().min(10),
  action: z.enum(['unsubscribe', 'undo']),
})

export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 })

  const verification = await verifyUnsubscribeToken(body.data.token)
  if (!verification.ok) return NextResponse.json({ ok: false, reason: verification.reason }, { status: 401 })

  const enabled = body.data.action === 'undo'
  await db.update(users).set({ emailRecapEnabled: enabled })
    .where(eq(users.id, verification.payload.user_id))

  return NextResponse.json({ ok: true })
}
```

### 5. Wire unsubscribe URL into recap emails (Phase 8 dependency)

Phase 8 builds the email templates. They will use `signUnsubscribeToken(user.id, 'weekly_recap_active')` to build the footer URL. Confirm the function signature matches between Phase 2 and Phase 8 expectations.

### 6. Reconnect entry point

When a user has `users.github_access_token_enc IS NULL`, the page should show the "GitHub disconnected" banner (Phase 5). The Reconnect button triggers `signIn()` (which is the same OAuth flow used at signup). The OAuth callback path handles the existing-user re-auth case identically.

### 7. Test fixtures

Update integration tests:
- `tests/integration/settings.test.ts` (or similar): public toggle, email toggle, timezone, username change, repo update, disconnect, delete.
- Username change test must assert that `username_history` row is inserted with the old name.
- Delete account test must assert that the CASCADE removes all related rows (`territories`, `landmarks`, `activities`, etc.).

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Unit + integration tests pass
npx vitest run tests/unit
# (Integration tests with Supabase dev project — only if .env.test is present)
[ ! -f .env.test ] || npx vitest run tests/integration/settings.test.ts

# Settings page files exist
test -f app/(authenticated)/settings/page.tsx
test -f app/(authenticated)/settings/_actions.ts
test -f app/(authenticated)/settings/_sections/public-profile.tsx
test -f app/(authenticated)/settings/_sections/email-recap.tsx
test -f app/(authenticated)/settings/_sections/timezone.tsx
test -f app/(authenticated)/settings/_sections/username-change.tsx
test -f app/(authenticated)/settings/_sections/included-repos.tsx
test -f app/(authenticated)/settings/_sections/danger-zone.tsx
test -f app/(authenticated)/settings/_sections/disconnect-confirm-modal.tsx
test -f app/(authenticated)/settings/_sections/delete-account-modal.tsx

# Recovery pages
test -f app/account-deleted/page.tsx
test -f app/unsubscribe/page.tsx
test -f app/api/unsubscribe/route.ts

# Reserved username check is wired into username change
git grep -l "isReservedUsername" app/(authenticated)/settings/_actions.ts | wc -l | xargs -I{} test {} -ge 1
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 7 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **Hard delete only** — ADR-31. No soft-delete window. `auth.admin.deleteUser` cascades through to `public.users` via the FK.
- **Outside-click is disabled on both confirm modals.** Delete modal additionally requires the user to type their username exactly.
- **The `setPublicProfile` action calls `revalidatePath('/{username}')`.** This is critical for ISR (ADR-20).
- **Username change creates a `username_history` row first, then updates `users` — atomically in a transaction.** Order matters because the new username must not collide with a stale history row of the same user (the previous username goes into history).
- **GET-based unsubscribe via the page is idempotent.** A second hit does nothing (already disabled). Per ADR-45, the 30s undo provides safety.
- **`UNSUBSCRIBE_TOKEN_SECRET` must be set** in `.env.local` for token verification to work. The page returns the "expired/invalid" variant if missing — confirm by looking at the `verifyUnsubscribeToken` return values.
- **Account-deleted page must auto-redirect.** Use either a `<meta http-equiv="refresh">` or a client component that calls `router.push('/')` after 5s. Both must coexist with the manual `Go to landing now →` button.
- **`disconnectGitHub` reverts `is_public` to false** per ADR-13. This is the only place is_public is changed by Disconnect — Public toggle handles voluntary off.
- **`updateIncludedRepos` dispatches a backfill via Inngest.** The page then redirects to `/` so the user sees the sync indicator. Do not block the action awaiting backfill completion.
- **Do not implement system status banner writes here.** Founder writes via Supabase dashboard SQL (Sub-flow G).
- **Reconnect button reuses `signIn()`** Server Action. No new auth surface required.
