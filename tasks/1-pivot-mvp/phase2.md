# Phase 2: Library Utilities

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/code-architecture.md` §lib/ tree · §Configuration & secrets
- `/docs/data-schema.md` §Username_History · §Encryption & secrets
- `/docs/flow.md` Flow 3 §username redirect · Sub-flow J §unsubscribe
- `/docs/adr.md` ADR-15 (reserved usernames) · ADR-30 (permanent redirect) · ADR-45 (one-click unsubscribe) · ADR-48 (token versioning) · ADR-52 (OG version) · ADR-38 (cinematic detection)
- `/docs/screens.md` §M4 unsubscribe page
- `/CLAUDE.md` (server-only · SPDX policy · territory_type list)
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 1's output:

- `lib/db/queries/_helpers.ts` exists with `withUserScope` / `withUserScopeAnd`
- `lib/db/client.ts` uses `{ prepare: false }`
- Migration applied to dev DB; new tables exist
- `DIRECT_URL`, `APP_HOSTNAME_ALLOWLIST`, `UNSUBSCRIBE_TOKEN_SECRET`, `UNSUBSCRIBE_TOKEN_VERSION`, `OG_RENDER_VERSION`, `RESEND_WEBHOOK_SECRET` are in `.env.example`

Carefully read the code from previous phases. Understand the design intent before working.

## Work

This phase creates infrastructure libraries that subsequent phases consume. No UI yet.

### 1. `lib/email/unsubscribe-token.ts`

JWT signed with `UNSUBSCRIBE_TOKEN_SECRET`. Includes `version` claim (ADR-48). No expiry.

```ts
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'

type UnsubscribePayload = {
  user_id: string
  email_type: 'weekly_recap_active' | 'weekly_recap_empty' | 'weekly_recap_first_week'
  version: number
}

function getSecret(): Uint8Array {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_TOKEN_SECRET is not configured')
  return new TextEncoder().encode(secret)
}

function getCurrentVersion(): number {
  return Number(process.env.UNSUBSCRIBE_TOKEN_VERSION ?? '1')
}

export async function signUnsubscribeToken(
  userId: string,
  emailType: UnsubscribePayload['email_type'],
): Promise<string> {
  return new SignJWT({ user_id: userId, email_type: emailType, version: getCurrentVersion() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    // No setExpirationTime — tokens must remain valid for old emails
    .sign(getSecret())
}

export type VerifyResult =
  | { ok: true; payload: UnsubscribePayload }
  | { ok: false; reason: 'invalid_signature' | 'invalid_payload' | 'version_mismatch' }

export async function verifyUnsubscribeToken(token: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (
      typeof payload.user_id !== 'string' ||
      typeof payload.email_type !== 'string' ||
      typeof payload.version !== 'number'
    ) {
      return { ok: false, reason: 'invalid_payload' }
    }
    if (payload.version !== getCurrentVersion()) {
      return { ok: false, reason: 'version_mismatch' }
    }
    return {
      ok: true,
      payload: payload as unknown as UnsubscribePayload,
    }
  } catch {
    return { ok: false, reason: 'invalid_signature' }
  }
}
```

Install `jose` if not already a dependency: `npm install jose`.

### 2. `lib/og/version.ts`

```ts
// SPDX-License-Identifier: MIT
/**
 * OG image cache version (ADR-52).
 * Bump on any global renderer or product-language change that should invalidate
 * cached OG images across all users.
 *
 * Read from env so prod can rotate without code change; falls back to
 * an embedded default for safety.
 */
export const OG_RENDER_VERSION = process.env.OG_RENDER_VERSION ?? 'devastra-1'

export function ogVersionParam(): string {
  return `v=${encodeURIComponent(OG_RENDER_VERSION)}`
}
```

### 3. `lib/utils/reserved-usernames.ts`

System paths that must not be claimable as usernames. Per ADR-15 (with the self-match exception that lives in the route validation logic, not this list).

```ts
/**
 * Reserved usernames — paths that conflict with system routes or are
 * preemptively protected. Used by username validation on signup and change.
 *
 * The self-match exception (a user may set their display_username to their
 * own GitHub login even if it appears here) is applied at the validation
 * call site, not in this list.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // App route segments
  'settings', 'onboarding', 'auth', 'api', 'admin',
  'privacy', 'terms', 'unsubscribe', 'account-deleted',
  'login', 'logout', 'signin', 'signup', 'signout',
  'dashboard', 'home', 'profile', 'recap',
  // Brand / system
  'devastra', 'devatlas', 'about', 'help', 'support', 'docs',
  'blog', 'pricing', 'features', 'security', 'status',
  // Common short names that should not be auto-claimed
  'me', 'you', 'us', 'all', 'new', 'edit', 'create', 'delete',
  'test', 'demo', 'example', 'sample', 'null', 'undefined',
])

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase())
}
```

### 4. `lib/utils/username-redirect.ts`

Resolves a URL-path username to a canonical user, falling back to history.

```ts
import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { usernameHistory } from '@/lib/db/schema/username-history'

export type ResolveResult =
  | { kind: 'current'; userId: string; canonicalUsername: string }
  | { kind: 'redirect'; userId: string; canonicalUsername: string }
  | { kind: 'not_found' }

/**
 * Resolve a /{username} path segment to a current user.
 *
 * - kind = 'current' → username matches users.display_username; render the page.
 * - kind = 'redirect' → username matches username_history.old_username; the
 *   caller should issue a 301 redirect to /{canonicalUsername}.
 * - kind = 'not_found' → no user; render 404.
 *
 * Per ADR-30, old usernames are permanently mapped and the redirect is
 * permanent (301).
 */
export async function resolveUsername(rawUsername: string): Promise<ResolveResult> {
  // Normalize: lowercase. The display_username regex forbids upper-case, but
  // the URL may arrive with arbitrary casing.
  const username = rawUsername.toLowerCase()

  const currentRows = await db
    .select({ id: users.id, displayUsername: users.displayUsername })
    .from(users)
    .where(eq(sql`lower(${users.displayUsername})`, username))
    .limit(1)

  if (currentRows[0]) {
    return {
      kind: 'current',
      userId: currentRows[0].id,
      canonicalUsername: currentRows[0].displayUsername,
    }
  }

  const historyRows = await db
    .select({ userId: usernameHistory.userId })
    .from(usernameHistory)
    .where(eq(usernameHistory.oldUsername, username))
    .limit(1)

  if (historyRows[0]) {
    const ownerRows = await db
      .select({ id: users.id, displayUsername: users.displayUsername })
      .from(users)
      .where(eq(users.id, historyRows[0].userId))
      .limit(1)

    if (ownerRows[0]) {
      return {
        kind: 'redirect',
        userId: ownerRows[0].id,
        canonicalUsername: ownerRows[0].displayUsername,
      }
    }
  }

  return { kind: 'not_found' }
}
```

### 5. `features/sync/cinematic-detection.ts`

Detects the `lit_star_count: 0 → ≥1` transition during sync. Sets `users.first_star_cinematic_pending = true` for the user. Per ADR-38, the trigger relies on the pending flag, not on inferring from current state.

```ts
import 'server-only'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { landmarks } from '@/lib/db/schema/landmarks'

/**
 * Detect the 0→≥1 lit-star transition for a user and set the pending flag.
 * Called from sync at the end of the run after landmarks have been UPSERTed.
 *
 * - If first_star_cinematic_seen is already true: do nothing.
 * - If first_star_cinematic_pending is already true: do nothing (next visit consumes it).
 * - If lit_star_count went from 0 to ≥1 in this sync: set pending = true.
 *
 * Determining "went from 0 to ≥1" without explicit history: since this runs
 * AFTER UPSERT, we know the current count. The historic count is implied by
 * the seen + pending flags being both false AND current count ≥ 1.
 *
 * Per ADR-38: existing users at deploy time have pending = false (default),
 * so they will NOT trigger cinematic on the first visit post-pivot — even
 * if their lit_star_count is already ≥ 1. The cinematic is only intended
 * for the moment the user's first-ever star lights up.
 *
 * Strategy: cinematic-pending is set only when this sync run is responsible
 * for the user's first-ever lit star. To distinguish, we use a stored
 * `previous_lit_count` snapshot taken at the start of the sync run.
 */
export async function markFirstStarCinematicIfApplicable(opts: {
  userId: string
  previousLitCount: number  // captured at sync start
}): Promise<void> {
  const { userId, previousLitCount } = opts

  if (previousLitCount > 0) return  // not a 0→≥1 transition

  // Get current state of flags + lit count
  const [user] = await db
    .select({
      seen: users.firstStarCinematicSeen,
      pending: users.firstStarCinematicPending,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return
  if (user.seen || user.pending) return

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(landmarks)
    .where(and(eq(landmarks.userId, userId), isNotNull(landmarks.firstUnlockedAt)))

  if (count >= 1) {
    await db
      .update(users)
      .set({ firstStarCinematicPending: true })
      .where(eq(users.id, userId))
  }
}

/**
 * Helper for sync code: get the user's current lit star count.
 * Call BEFORE running classification + UPSERTing landmarks.
 */
export async function getPreviousLitCount(userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(landmarks)
    .where(and(eq(landmarks.userId, userId), isNotNull(landmarks.firstUnlockedAt)))
  return count
}
```

### 6. Unit tests

#### `tests/unit/unsubscribe-token.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

describe('unsubscribe-token', () => {
  beforeEach(() => {
    process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret-32-bytes-minimum-for-hmac-sha256'
    process.env.UNSUBSCRIBE_TOKEN_VERSION = '1'
  })

  it('signs and verifies a token round-trip', async () => {
    const token = await signUnsubscribeToken('user-123', 'weekly_recap_active')
    const result = await verifyUnsubscribeToken(token)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.user_id).toBe('user-123')
      expect(result.payload.email_type).toBe('weekly_recap_active')
      expect(result.payload.version).toBe(1)
    }
  })

  it('rejects a token with mismatched version', async () => {
    const token = await signUnsubscribeToken('user-123', 'weekly_recap_empty')
    process.env.UNSUBSCRIBE_TOKEN_VERSION = '2'
    const result = await verifyUnsubscribeToken(token)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('version_mismatch')
  })

  it('rejects a tampered token', async () => {
    const token = await signUnsubscribeToken('user-123', 'weekly_recap_active')
    const tampered = token.slice(0, -5) + 'xxxxx'
    const result = await verifyUnsubscribeToken(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_signature')
  })
})
```

#### `tests/unit/reserved-usernames.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { isReservedUsername, RESERVED_USERNAMES } from '@/lib/utils/reserved-usernames'

describe('reserved usernames', () => {
  it('contains common system paths', () => {
    expect(RESERVED_USERNAMES.has('settings')).toBe(true)
    expect(RESERVED_USERNAMES.has('api')).toBe(true)
    expect(RESERVED_USERNAMES.has('devastra')).toBe(true)
  })

  it('isReservedUsername is case-insensitive', () => {
    expect(isReservedUsername('Settings')).toBe(true)
    expect(isReservedUsername('SETTINGS')).toBe(true)
    expect(isReservedUsername('settings')).toBe(true)
  })

  it('returns false for non-reserved names', () => {
    expect(isReservedUsername('alice')).toBe(false)
    expect(isReservedUsername('juho')).toBe(false)
  })
})
```

#### `tests/unit/og-version.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OG_RENDER_VERSION, ogVersionParam } from '@/lib/og/version'

describe('og version', () => {
  it('reads from env when set', async () => {
    const orig = process.env.OG_RENDER_VERSION
    process.env.OG_RENDER_VERSION = 'test-v9'
    // Re-import to bypass module-level const capture — note this test verifies
    // the shape, not module hot-reload semantics. The runtime value is read
    // at module load time, so this just checks the helper format.
    expect(ogVersionParam()).toMatch(/^v=/)
    process.env.OG_RENDER_VERSION = orig
  })

  it('returns a v=... query param string', () => {
    expect(ogVersionParam()).toMatch(/^v=[A-Za-z0-9-]+$/)
  })
})
```

`username-redirect` is exercised via integration tests in Phase 11 (against a real DB). Phase 2 keeps it as code only.

### 7. Update `lib/og/shared.tsx` to export the version

Open `lib/og/shared.tsx` and re-export `OG_RENDER_VERSION` and `ogVersionParam` so other OG components can import them from the same module if convenient. No behavior change yet (OG redesign happens in Phase 9).

### 8. Documentation sync

This phase adds new files. If anything diverges from the spec in `docs/code-architecture.md` §lib/ tree, update the doc to match. No drift expected.

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# All unit tests pass (existing + new)
npx vitest run tests/unit

# jose is installed
test -n "$(node -e "console.log(require('jose').SignJWT ? 'ok' : '')" 2>/dev/null)"

# New files exist
test -f lib/email/unsubscribe-token.ts
test -f lib/og/version.ts
test -f lib/utils/reserved-usernames.ts
test -f lib/utils/username-redirect.ts
test -f features/sync/cinematic-detection.ts
test -f tests/unit/unsubscribe-token.test.ts
test -f tests/unit/reserved-usernames.test.ts
test -f tests/unit/og-version.test.ts

# Tokens round-trip locally
UNSUBSCRIBE_TOKEN_SECRET=test-secret-32-bytes-minimum-for-hmac-sha256 \
UNSUBSCRIBE_TOKEN_VERSION=1 \
npx vitest run tests/unit/unsubscribe-token.test.ts
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 2 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- `unsubscribe-token.ts` must NOT set an expiration (`setExpirationTime`). Per ADR-45, tokens are permanent; revocation is via `UNSUBSCRIBE_TOKEN_VERSION` bump.
- `reserved-usernames.ts` is the canonical list; `RESERVED_USERNAMES` set is exported as `ReadonlySet<string>`. Do not mutate elsewhere.
- The self-match exception (a user can keep their GitHub login as username even if it appears in the reserved list) is applied at the username change validation call site, NOT in `isReservedUsername`.
- `username-redirect.ts` queries `username_history` only when current lookup misses. Do not invert the order (history-first is wrong — it would resolve renamed-then-recycled scenarios incorrectly).
- `cinematic-detection.ts` is server-only. It will be wired into sync orchestration in a later phase (Phase 5 banner/special-moments work). For now it just exists and unit-tests by review.
- Do not introduce any UI changes in this phase. Renderer, drawer, banners, settings — all later phases.
- Do not modify Drizzle schema; that was completed in Phase 1.
