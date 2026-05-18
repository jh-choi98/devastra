# Phase 11: Settings & Lifecycle

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` §Flow 5, §Flow 1 step 4 (Repo Selection)
- `/docs/adr.md` (ADR-13, ADR-15, ADR-22)
- `/docs/data-schema.md` §Users, §Repositories
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 10's output:

- `features/recap/send.ts` exists
- `lib/email/templates/WeeklyRecap.tsx` exists

## Work

Implement the full Settings page, Repo Selection onboarding screen, and lifecycle actions (disconnect, delete).

### 1. Reserved usernames

`lib/utils/reserved-usernames.ts`:

```ts
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // system paths
  'settings', 'api', 'admin', 'login', 'signup', 'signin', 'signout', 'auth',
  'app', 'dev', 'static', '_next', 'public', 'about', 'help', 'support',
  'privacy', 'terms', 'docs', 'blog', 'home', 'me', 'profile', 'account',
  'onboarding', 'welcome', 'feed', 'explore', 'search', 'notifications',
  // brand confusion (a minimal MVP set)
  'devatlas', 'devatlas-app', 'official',
])

export function isReserved(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase())
}
```

The "GitHub login self-match" exception is handled in the change-username Server Action: if the requested username equals the user's `github_login`, ignore reservation.

### 2. Settings page

`app/(authenticated)/settings/page.tsx`:

```tsx
import { requireUser } from '@/lib/auth/session'
import { getUserSettings, listUserRepos } from '@/lib/db/queries/users'
import { PublicToggleSection } from './_sections/public-toggle'
import { EmailRecapSection } from './_sections/email-recap'
import { TimezoneSection } from './_sections/timezone'
import { UsernameSection } from './_sections/username'
import { IncludedReposSection } from './_sections/included-repos'
import { DisconnectSection } from './_sections/disconnect'
import { DeleteAccountSection } from './_sections/delete-account'

export default async function SettingsPage() {
  const user = await requireUser()
  const settings = await getUserSettings(user.id)
  const repos = await listUserRepos(user.id)
  return (
    <div>
      <PublicToggleSection initial={settings.is_public} username={settings.display_username} />
      <EmailRecapSection initial={settings.email_recap_enabled} />
      <TimezoneSection initial={settings.timezone} />
      <UsernameSection initial={settings.display_username} githubLogin={settings.github_login} />
      <IncludedReposSection repos={repos} />
      <DisconnectSection />
      <DeleteAccountSection />
    </div>
  )
}
```

Each section is its own client component with its own Server Action wired in. Styles: each section is a card with title + description + control + save button (or inline save on toggle change).

### 3. Server Actions

`app/(authenticated)/settings/_actions.ts`:

```ts
'use server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { revalidatePublicProfile } from '@/lib/cache/revalidate-profile'
import { isReserved } from '@/lib/utils/reserved-usernames'

const TogglePublicSchema = z.object({ next: z.boolean() })
export async function togglePublic(input: unknown) {
  const { next } = TogglePublicSchema.parse(input)
  const user = await requireUser()
  await updateUserField(user.id, 'is_public', next)
  if (next) revalidatePublicProfile(user.display_username)
}

const ToggleEmailRecapSchema = z.object({ next: z.boolean() })
export async function toggleEmailRecap(input: unknown) { ... }

const ChangeTimezoneSchema = z.object({ timezone: z.string() })
export async function changeTimezone(input: unknown) {
  // validate via Intl.supportedValuesOf('timeZone') (Node 20+)
  // reject if not in the list
}

const ChangeUsernameSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-z0-9-_]+$/),
})
export async function changeUsername(input: unknown) {
  const { username } = ChangeUsernameSchema.parse(input)
  const user = await requireUser()
  if (username !== user.github_login && isReserved(username)) {
    throw new Error('This name is reserved.')
  }
  // attempt UNIQUE insert; on conflict throw 'This name is taken.'
  const oldUsername = user.display_username
  await updateUserField(user.id, 'display_username', username)
  if (user.is_public) {
    revalidatePublicProfile(oldUsername)
    revalidatePublicProfile(username)
  }
}

const UpdateIncludedReposSchema = z.object({
  repoIds: z.array(z.string().uuid()),
  includedIds: z.array(z.string().uuid()),
})
export async function updateIncludedRepos(input: unknown) {
  // 1. validate ownership of every id
  // 2. UPDATE repositories SET is_included = (id IN included)
  // 3. dispatch sync/backfill.requested event to reclassify activities since included set changed
}

export async function disconnectGithub() {
  const user = await requireUser()
  // 1. UPDATE users SET github_access_token_enc = NULL, github_refresh_token_enc = NULL, github_token_expires_at = NULL, is_public = false
  // 2. revalidatePublicProfile if was public
}

const DeleteAccountSchema = z.object({ confirmation: z.literal('DELETE') })
export async function deleteAccount(input: unknown) {
  DeleteAccountSchema.parse(input)
  const user = await requireUser()
  // 1. supabase.auth.admin.deleteUser(user.id) — cascades through public.users → all child tables
  // 2. redirect to /
}
```

All actions parse input via Zod first; any throw becomes a user-facing toast in the calling client component.

### 4. Repo Selection onboarding screen

`app/(authenticated)/onboarding/repos/page.tsx`:

```tsx
import { requireUser } from '@/lib/auth/session'
import { fetchReposViaGitHub } from '@/lib/github/onboarding-fetch'
import { RepoSelector } from './_repo-selector'

export default async function OnboardingReposPage() {
  const user = await requireUser()
  const repos = await fetchReposViaGitHub(user.id)   // server-side, uses access token
  return <RepoSelector repos={repos} userId={user.id} />
}
```

`lib/github/onboarding-fetch.ts` — uses `GitHubSourceClient.listAuthoredRepos()` filtered by `MVP_INCLUDE_PRIVATE`. Returns per-repo: `{ externalRepoId, owner, name, primaryLanguage, lastUpdated, ninetyDayCommitCount }`. Sort by `lastUpdated DESC`.

`app/(authenticated)/onboarding/repos/_repo-selector.tsx` (client):

- List of repos with checkboxes, all checked by default.
- Search box appears once length > 20.
- Two buttons: "Skip & Build" (proceed with all currently checked, including all-default state), "Build my world" (same action, but text changes if user has toggled at least one).
- On submit: call Server Action `saveRepoSelectionAndStartSync({ includedIds })`.

`app/(authenticated)/onboarding/repos/_actions.ts`:

```ts
'use server'
export async function saveRepoSelectionAndStartSync(input: unknown) {
  // 1. Zod parse { includedIds: string[] }
  // 2. UPSERT repositories rows for ALL repos fetched (set is_included accordingly)
  // 3. inngest.send({ name: EVENTS.SYNC_INITIAL_REQUESTED, data: { userId, includedRepoIds } })
  // 4. redirect('/')
}
```

After the redirect, the home page (Phase 8) handles the reveal experience as `firstReveal = true` because `last_login_at` is still null until the home page updates it.

### 5. Confirmation modals

`app/(authenticated)/settings/_sections/disconnect.tsx` and `_sections/delete-account.tsx`:

- Disconnect: simple confirm modal ("Disconnect GitHub? Your map will be preserved. You can reconnect anytime.").
- Delete: typed confirmation ("Type DELETE to confirm. This cannot be undone."). Submit button disabled until input exactly equals `DELETE`.

Both use a shared `ConfirmModal` primitive in `app/_components/ConfirmModal.tsx`.

### 6. Unit test for reserved usernames

`tests/unit/reserved-usernames.test.ts`:

- `isReserved('settings')` → true
- `isReserved('Juho')` → false (case insensitive normalization — write the test, decide behavior; recommended: lowercase only)
- The set contains the documented system paths.

`tests/integration/change-username.test.ts`:

- User A whose github_login is `'admin'` can set their `display_username` to `'admin'` (self-match exception).
- User B whose github_login is `'foo'` cannot set their `display_username` to `'admin'` (reserved).
- Duplicate username attempt throws.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- reserved-usernames
npm test -- change-username
grep -q "DELETE" app/\(authenticated\)/settings/_sections/delete-account.tsx
grep -q "github_login" app/\(authenticated\)/settings/_actions.ts
grep -q "revalidatePublicProfile" app/\(authenticated\)/settings/_actions.ts
```

## How to verify AC

Run the AC commands. Tests must pass.

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT implement custom domain UI (deferred to v0.3 per ADR — comment in the Username section that this is intentional).
- Do NOT delete `auth.users` rows from app code without going through `supabase.auth.admin.deleteUser` — direct delete may not cascade properly.
- Repo Selection page is only reachable from the OAuth callback redirect; reaching it again later is fine but the user can also re-trigger via Settings → Included repos (which uses `updateIncludedRepos`, not the full onboarding flow).
- After `updateIncludedRepos`, dispatching backfill ensures `activity_territories` reflects the new include set. The backfill function (Phase 6) handles this.
- Email-recap toggle is a single boolean; do not introduce per-email-type preferences in MVP.
- All identifiers, comments, copy in English.
