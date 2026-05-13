# Phase 3: Auth Layer

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` §Flow 1 (steps 2-4)
- `/docs/adr.md` (ADR-3, ADR-11)
- `/docs/data-schema.md` §Users
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 2's output:

- `lib/db/schema/users.ts` and other schema files exist
- `drizzle/migrations/*.sql` includes `handle_new_user` trigger and RLS policies
- `npm run typecheck && npm run build` passes

## Work

Wire up Supabase Auth with GitHub OAuth. Requested scopes are limited to `read:user` and `user:email` only.

### 1. Supabase clients

Create `lib/auth/supabase.ts` (or split into `supabase-server.ts` and `supabase-browser.ts` per `@supabase/ssr` conventions). Provide:

```ts
// Server-side client used in Server Components, Server Actions, Route Handlers
export function createServerClient()

// Service-role admin client used only in Inngest functions / admin tasks
import 'server-only'
export function createAdminClient()

// Browser client used in client components
'use client'
export function createBrowserClient()
```

The admin client uses `SUPABASE_SERVICE_ROLE_KEY` and MUST be importable only from server code. Add `import 'server-only'` at the top.

### 2. Sign-in entry point

Update `app/page.tsx` (landing) so that the "Sign in with GitHub" button triggers `signInWithOAuth({ provider: 'github', options: { scopes: 'read:user user:email', redirectTo: '/auth/callback' } })`. Do NOT request `public_repo`.

### 3. OAuth callback route

`app/api/auth/callback/route.ts` — handle the OAuth code exchange:

```ts
export async function GET(request: Request) {
  // 1. extract `code` and optional `next` from URL
  // 2. exchange via createServerClient().auth.exchangeCodeForSession(code)
  // 3. on error → redirect('/?auth_error=cancelled')
  // 4. on success → check if public.users row has last_event_id
  //    - if null → redirect('/onboarding/repos')
  //    - else → redirect('/')
}
```

`handle_new_user` trigger (Phase 2) creates the `public.users` row on first sign-in. This route only needs to read it back to decide the redirect target.

### 4. Authenticated layout gate

Update `app/(authenticated)/layout.tsx` to check the session server-side and redirect to `/` if absent:

```tsx
export default async function AuthenticatedLayout({ children }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  return <>{children}</>
}
```

### 5. Auth helpers

`lib/auth/session.ts`:

```ts
import 'server-only'
export async function requireUser(): Promise<User>   // throws redirect to / if no session
export async function getOptionalUser(): Promise<User | null>
```

These wrap `createServerClient().auth.getUser()` and the corresponding `public.users` lookup so callers do not duplicate code.

### 6. Sign-out

Server Action `signOut()` in `lib/auth/actions.ts` (`'use server'` at top of file). Calls `supabase.auth.signOut()` and redirects to `/`.

### 7. Constants

`features/sync/sources/github.ts` (or a sibling `constants.ts`) — define the hardcoded MVP guard:

```ts
import 'server-only'
export const MVP_INCLUDE_PRIVATE = false as const
```

This is referenced by the GitHub source client in Phase 4. Defining it in Phase 3 makes ADR-11 visible early. The constant lives in `features/sync/sources/` so it is colocated with the code that enforces it.

### 8. Onboarding placeholder

`app/(authenticated)/onboarding/repos/page.tsx` — minimal placeholder Server Component that displays "Repo selection — implemented in Phase 11". The redirect target needs to exist as a real route so the callback does not 404.

### 9. OAuth callback integration test

`tests/integration/oauth-callback.test.ts` — use mocked Supabase client (do not require a real Supabase project for unit test). Test:

- Successful code exchange → 302 redirect to `/onboarding/repos` (when `last_event_id` is null)
- Successful code exchange → 302 redirect to `/` (when `last_event_id` exists)
- Failed code exchange → 302 redirect to `/?auth_error=cancelled`

Use Vitest. Mock `@supabase/ssr` and the DB query.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- oauth-callback
grep -r "public_repo" app lib features 2>/dev/null; test $? -eq 1  # must NOT find public_repo scope anywhere
grep -q "MVP_INCLUDE_PRIVATE" features/sync/sources/github.ts || grep -q "MVP_INCLUDE_PRIVATE" features/sync/sources/constants.ts
```

## How to verify AC

Run the AC commands above. The `grep -r "public_repo"` check must NOT find any matches (it should exit 1). If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`.

If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT request the `public_repo` scope. Public GitHub data is accessible with `read:user` + `user:email` for the authenticated user's rate limit.
- Do NOT bypass the `(authenticated)/layout.tsx` redirect by reading from cookies elsewhere. One gate, one place.
- Do NOT call any GitHub API in this phase. That is Phase 4.
- `handle_new_user` trigger is the only path that writes to `public.users.id`. Application code must not INSERT to `public.users` directly.
- Sign-in button in `app/page.tsx` is functional but the landing page visual design is finalized in Phase 12.
- All copy in English.
