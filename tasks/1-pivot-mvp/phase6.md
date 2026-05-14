# Phase 6: Public Profile Variants + 404 / 429 / Private

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` Flow 3 (public profile visitor) · Sub-flow F (cross-device)
- `/docs/screens.md` §A.2 404 · §A.3 Private placeholder · §A.4 429 · §G Public profile (3 variants)
- `/docs/adr.md` ADR-20 (ISR + revalidate) · ADR-30 (username permanent redirect) · ADR-47 (origin/host validation) · ADR-54 (a11y baseline)
- `/CLAUDE.md` §UI vs internal naming · §Cross-doc consistency
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 5's output:

- `app/_components/StateBanners/` and `app/_components/SpecialMoments/` exist
- `markFirstStarCinematicIfApplicable` is called from sync entry points
- Authenticated main page integrates banners + cinematics
- `npm run build` passes

Read the existing code:

- `app/[username]/page.tsx` — current public profile page (uses old TerritoryDrawer; needs full refresh)
- `app/_components/PrivateProfile.tsx` — current private placeholder
- `app/_components/PublicStickyBar.tsx` — current sticky CTA
- `app/not-found.tsx` — current 404
- `lib/db/queries/public-profile.ts` — current data query
- `lib/utils/username-redirect.ts` (created Phase 2)

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Implement three variants of `/{username}` and update 404 / 429 / private placeholder pages. Wire username history redirect.

### 1. Update `app/[username]/page.tsx`

Server component that:

1. Resolves the username via `resolveUsername()` (Phase 2 `lib/utils/username-redirect.ts`).
2. Branches by result:
   - `kind: 'redirect'` → `permanentRedirect('/${canonicalUsername}')` (Next.js `permanentRedirect` returns 308; for SEO we want 301 — use `redirect(...)` with `RedirectType.permanent` if the framework supports, otherwise rely on `permanentRedirect`).
   - `kind: 'not_found'` → return Next.js `notFound()`.
   - `kind: 'current'` → load profile data and render.
3. For `'current'`: query `users_public_view` via Supabase service-role client (to confirm `is_public = true`). If `is_public = false`, render the `PrivateProfile` component with the `username` prop. Do NOT render the constellation.
4. If `is_public = true`, query `territories` + `landmarks` for the owner (via Drizzle direct, scoped with `withUserScope`), plus `users.avatar_url` and `users.display_username` (from view).
5. Determine the viewer variant:
   - `'visitor'` — unauthenticated.
   - `'owner_self'` — `requireUser()` returns the same user as the profile owner.
   - `'logged_in_visitor'` — authenticated but a different user.
6. Render layout:
   - `<header>`: logo (link to /). Variant-specific actions:
     - visitor: nothing else.
     - owner-self: strip below header with `This is how others see your constellation` + `← Back to my private view` linking to `/`.
     - logged-in visitor: header-right `Back to my sky →` linking to `/`.
   - Identity block (top-left compact): avatar + `@username` + stats line `N stars lit · M clusters active`.
   - Below-identity small text: `Viewing {username}'s constellation` (visitor + logged-in visitor; hidden for owner-self because the back-strip already conveys context).
   - `<Constellation data={...} viewport="desktop">` with `onClusterClick` and `onStarClick` that open the visitor-variant drawer.
   - `<ClusterDrawer variant={variant === 'visitor' ? 'visitor' : 'owner'}>` — visitor and logged-in-visitor both use the `visitor` variant; owner-self uses `owner`.
   - `<PublicStickyBar />` only when variant === `'visitor'`. Hidden for owner-self and logged-in-visitor.
   - Footer: none.

### 2. First-time reveal per session (visitor)

Per `docs/flow.md` Flow 3 step 1, visitors see a short 3–5s reveal animation on first visit per session.

Implement via a small client component `app/[username]/_components/VisitorReveal.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

export function VisitorReveal(props: { username: string }): JSX.Element | null {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const key = `visitor_reveal_${props.username}`
    const last = sessionStorage.getItem(key)
    if (!last) {
      setShow(true)
      sessionStorage.setItem(key, '1')
      const t = setTimeout(() => setShow(false), 4000)
      return () => clearTimeout(t)
    }
  }, [props.username])

  if (!show) return null
  // Render a subtle 3–5s fade-in animation overlay on top of the constellation.
  // Reduced-motion: skip; return null immediately.
  return /* ... */ null as any
}
```

### 3. Update `app/_components/PrivateProfile.tsx`

```tsx
export function PrivateProfile(props: { username: string }): JSX.Element {
  // Layout:
  //   Dim sky background.
  //   Top-left: minimal logo link to `/`.
  //   Centerpiece: an "unlit/locked constellation" visualization — render six dim cluster outlines (using the same Constellation primitives) with all stars rendered as faint placeholder dots. No connections. Use a static <Constellation> with synthetic `data` that has `landmarks = []` and a `viewport` mode rendering everything in low opacity.
  //   Copy below the visualization:
  //     "{username}'s sky is private"
  //   CTA: <a href="/">Create yours, free →</a> (single primary)
  //
  //   Identity is intentionally limited to the @username text — no avatar, no joined-date.
  return /* ... */ null as any
}
```

A simpler implementation: a smaller hand-drawn SVG with six dim circles labeled with cluster names — does not need to reuse `Constellation.tsx`. Either path is acceptable as long as it conveys "constellation exists but is locked".

### 4. Update `app/_components/PublicStickyBar.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'

export function PublicStickyBar(props: {
  inviterUsername: string  // the owner of the profile being viewed
  /** When the visitor opens their first drawer, set this to true → trigger a single pulse animation. */
  pulse: boolean
}): JSX.Element {
  // Bottom-fixed full-width bar.
  // Single CTA: <a href={`/?from=profile&inviter=${encodeURIComponent(props.inviterUsername)}`}>Create yours, free →</a>
  // On pulse=true: framer-motion 1-cycle pulse (scale 1 → 1.02 → 1, opacity 1 → 0.95 → 1) over 1s.
  // Reduced motion: skip the pulse.
  return /* ... */ null as any
}
```

The pulse trigger lives in the parent page state: when `ClusterDrawer` opens for the first time during the visit, set `pulse=true` for ~1s then revert.

### 5. Update `app/not-found.tsx`

```tsx
export default function NotFoundPage(): JSX.Element {
  // Dim sky background + faint dim constellation outline (decorative only).
  // Copy: "No constellation at this address"
  // Two CTAs:
  //   - "Create yours, free →" (primary) → "/"
  //   - "Browse other constellations →" (secondary) → "/" with anchor to the gallery section
  // Header: same logo as Landing.
  return /* ... */ null as any
}
```

### 6. Create the 429 page

429 status is returned by `middleware.ts` for IP-rate-limited public-profile routes. Next.js' App Router doesn't expose a customizable 429 page directly; the middleware returns a `NextResponse` with custom HTML or redirects to `/rate-limited`. Use the redirect approach:

`middleware.ts` change: on rate limit hit, `NextResponse.redirect(new URL('/rate-limited', request.url), 303)`.

`app/rate-limited/page.tsx`:

```tsx
export default function RateLimitedPage(): JSX.Element {
  // Dim sky background.
  // Copy: "Too many requests — try again in a moment"
  // Button: "Retry" → reload current page (or location.replace to navigate back). Use a small client component for the retry button.
  return /* ... */ null as any
}
```

### 7. Server-side query: profile data

`lib/db/queries/public-profile.ts` already exists from the pre-pivot code. Update it to return the new `ConstellationData` shape consumed by `Constellation.tsx`. The exact transformation should already work (territories, landmarks rows are unchanged), but verify:

- Returns `null` (or some sentinel) when `is_public = false`.
- Resolves through `users_public_view` for visibility (does NOT bypass it via Drizzle).
- Joins owner's `users.id` → territories + landmarks via Drizzle direct (scoped with `withUserScope`).

If you must bypass the view in the future, document why in an ADR — for MVP, view is the canonical path.

### 8. Owner self-view detection

In `app/[username]/page.tsx`:

```ts
import { getOptionalUser } from '@/lib/auth/session'

const viewer = await getOptionalUser()
const variant: 'visitor' | 'owner_self' | 'logged_in_visitor' =
  !viewer ? 'visitor'
  : viewer.id === ownerUserId ? 'owner_self'
  : 'logged_in_visitor'
```

### 9. ISR & on-demand revalidation

The page uses ISR with 1h revalidation:

```ts
export const revalidate = 3600
```

The `users.is_public` toggle Server Action (Phase 7) calls `revalidatePath('/${username}')` to bust the cache on toggle. The username change Server Action (Phase 7) calls `revalidatePath('/${oldUsername}')` AND `revalidatePath('/${newUsername}')`. The sync completion Inngest step calls `revalidatePath('/${username}')` server-side too.

### 10. OG meta tags on the profile page

```tsx
import type { Metadata } from 'next'
import { ogVersionParam } from '@/lib/og/version'

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const username = params.username.toLowerCase()
  const ogUrl = `/api/og/profile/${encodeURIComponent(username)}?${ogVersionParam()}`
  return {
    title: `${username} on DevAstra`,
    description: 'A developer skill constellation that lights up as you code.',
    openGraph: {
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      siteName: 'DevAstra',
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogUrl],
    },
    alternates: {
      canonical: `/${username}`,
    },
  }
}
```

For owner-self / logged-in visitor / private placeholder, the metadata still points to the user's OG (or a generic DevAstra preview for private).

### 11. Update integration tests

`tests/integration/public-profile-visibility.test.ts` exists from the pre-pivot. Update:

- Assert that an unauth user sees the constellation when `is_public = true`.
- Assert 404 for a username that exists nowhere.
- Assert 301 redirect from old username (via `username_history`) to new.
- Assert PrivateProfile shows the `{username}'s sky is private` copy when `is_public = false`.

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Updated public profile + variants
test -f app/[username]/page.tsx
test -f app/[username]/_components/VisitorReveal.tsx
test -f app/_components/PrivateProfile.tsx
test -f app/_components/PublicStickyBar.tsx

# Recovery pages
test -f app/not-found.tsx
test -f app/rate-limited/page.tsx

# Username redirect works (covered by integration test)
npx vitest run tests/integration/public-profile-visibility.test.ts

# All other tests still pass
npx vitest run tests/unit
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 6 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **Owner-self view's sticky CTA is hidden.** The back-strip is the only contextual cue.
- **Visitor view's sticky CTA is full-width fixed-bottom.** No floating pill variant.
- **Drawer footer differs by variant.** Visitor view shows `Want to see yours? Create yours, free →` at drawer bottom; owner-self has nothing there.
- **Private profile shows username** (e.g. `juho's sky is private`), but NOT avatar. Per Flow 3 §53 decision.
- **Username permanent redirect** is a 301 — Next.js `permanentRedirect()` returns 308 which is also permanent and search-engine-acceptable. Either is OK; document which one.
- **Logged-in visitor's `Back to my sky →` is in the header.** No sticky CTA at the bottom.
- **First-visit reveal animation is per-session, not per-user.** Visitor opens 5 different profiles in one session → sees the short reveal on each.
- **Rate limit page is server-rendered** (no animation on page load). Brand-consistent dim sky + retry button.
- **Don't add any auth UI** to the public profile. It's a read-only surface for unauthenticated users; sign-in goes through landing.
- **Don't fetch GitHub data** on the public profile request — `recap_id`/profile uses already-synced DB rows.
