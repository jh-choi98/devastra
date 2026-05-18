# Phase 9: Public Profile & Sharing

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` §Flow 3
- `/docs/adr.md` (ADR-7, ADR-11 (for visibility filter), ADR-20)
- `/docs/data-schema.md` §Users (`users_public_view`)
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 8's output:

- `app/(authenticated)/page.tsx` renders `LivingMapContainer`
- `app/_components/Header.tsx` includes a Share button stub
- `lib/realtime/use-realtime-map-data.ts` exists
- `npm test -- reveal-flow` passes

## Work

Public profile pages, OG image generation, share modal, and rate-limited image endpoints.

### 1. Public profile page

`app/[username]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getPublicProfileByUsername } from '@/lib/db/queries/public-profile'
import { LivingMap } from '@/app/_components/Map/LivingMap'
import { TerritoryDrawer } from '@/app/_components/TerritoryDrawer'
import { PublicStickyBar } from '@/app/_components/PublicStickyBar'
import { PrivateProfile } from '@/app/_components/PrivateProfile'

export const revalidate = 3600  // 1 hour ISR

export async function generateMetadata({ params }) {
  // dynamic og:image pointing to /api/og/profile/{username}
  // og:title, og:description, twitter:card = summary_large_image
}

export default async function PublicProfilePage({ params }) {
  const profile = await getPublicProfileByUsername(params.username)
  if (!profile) notFound()
  if (!profile.isPublic) return <PrivateProfile username={params.username} />
  return (
    <>
      <LivingMap data={profile.map} />
      <TerritoryDrawer ... />        {/* read-only drawer */}
      <PublicStickyBar />
    </>
  )
}
```

`lib/db/queries/public-profile.ts` (`import 'server-only'`):

- Use `users_public_view` to resolve `display_username → users.id`.
- If row not found → return null (caller renders 404).
- If `is_public = false` → return `{ isPublic: false, username }`. (Note: this branch shouldn't trigger since `users_public_view` filters `is_public = true`, so the not-found case covers both. But the route must STILL distinguish "private user we know exists" from "unknown username" if we ever expand. For MVP, both map to the same not-found-style UX page but with different copy. Easiest: always render `PrivateProfile` when the row is missing — the messaging "This DevAtlas is private or doesn't exist" covers both.)

For MVP scope: a single `PrivateProfile` page used for both not-found and not-public cases is acceptable. Copy: "This DevAtlas is private. Create your own DevAtlas →"

- Otherwise fetch `territories`, `landmarks` for that user_id (these RLS-allow public reads when owner `is_public = true`).
- Return `MapData` shape consumed by `LivingMap`.

### 2. On-demand revalidate triggers

Already mentioned in earlier phases; consolidate here:

- After sync completes (Phase 6) → `revalidatePath('/' + display_username)` if user is public.
- After public toggle on (Phase 11) → `revalidatePath('/' + display_username)`.
- After username change (Phase 11) → revalidate both old and new path.

For Phase 9 itself: just export and use a helper:

```ts
// lib/cache/revalidate-profile.ts
import { revalidatePath } from 'next/cache'
import 'server-only'
export function revalidatePublicProfile(username: string) {
  revalidatePath('/' + username)
}
```

Phase 6 and Phase 11 import this helper.

### 3. OG image components

`lib/og/ProfileImage.tsx`:

```tsx
import { ImageResponse } from 'next/og'
import { TERRITORIES } from '@/features/territories/registry'

export function renderProfileImage(data: { displayUsername: string; avatarUrl: string; map: MapData }): ImageResponse
```

Returns a 1200×630 image showing:
- A static (non-animated) version of the map: same procedural island shapes, with stage-based sizing, without Framer Motion.
- Username + avatar in a corner.
- Top three territories with their stage badges.
- Subtle DevAtlas wordmark.

`lib/og/RecapImage.tsx` — similar shape but emphasizes the week's diff. Used by Phase 10's email. Both files share helpers via `lib/og/shared.tsx` for the procedural shape rendering on a server-side surface.

### 4. OG endpoints

`app/api/og/profile/[username]/route.tsx`:

```ts
import { renderProfileImage } from '@/lib/og/ProfileImage'
import { getPublicProfileByUsername } from '@/lib/db/queries/public-profile'

export const runtime = 'edge'

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  // 1. referrer check: allow social crawler UA or our origin; otherwise return 403 (or serve cached fallback)
  // 2. rate limit: 60/min/IP (Vercel Edge Middleware enforces; this route mostly trusts that)
  // 3. fetch profile via getPublicProfileByUsername
  // 4. if not public → return a generic "private" placeholder image
  // 5. else → renderProfileImage(data)
}
```

`app/api/og/recap/[recap_id]/route.tsx` — same skeleton; profile-by-id; image is immutable so set `Cache-Control: public, max-age=31536000, immutable`.

### 5. Share modal

`app/_components/ShareModal.tsx`:

```tsx
'use client'
export function ShareModal(props: {
  open: boolean
  onClose: () => void
  username: string
  isPublic: boolean
  onTogglePublic: (next: boolean) => Promise<void>      // Server Action passed in
}): JSX.Element
```

Layout:
- Top: preview `<img src={`/api/og/profile/${username}?preview=1`} />` (1200×630 thumbnail).
- If `!isPublic`: a callout "Your DevAtlas is private. Make it public to share?" with a toggle that calls `onTogglePublic(true)`. Once toggled, the buttons below become enabled.
- Buttons (disabled until public):
  - Copy link → copies `https://devatlas.app/{username}` to clipboard, shows toast.
  - Twitter → opens `https://twitter.com/intent/tweet?text={prefilled}&url={profileUrl}`.
  - LinkedIn → opens LinkedIn share dialog.
  - Download → fetches `/api/og/profile/{username}` and triggers a PNG download.

Prefilled tweet text: `"I'm building my developer world on DevAtlas. See my map →"` (English, kept short to leave room for hashtags / URL).

The "togglePublic" Server Action is owned by Phase 11; the modal accepts it as a prop so this phase doesn't need to implement that action yet. Header (Phase 8) imports `ShareModal` and passes the toggle prop using a temporary local Server Action stub if the real one is not yet ready — Phase 11 replaces the stub.

### 6. Public sticky bar

`app/_components/PublicStickyBar.tsx`:

```tsx
'use client'
export function PublicStickyBar() {
  // sticky bottom on viewport
  // "Get your own DevAtlas →"
  // links to /
}
```

Visible only on `/{username}` routes for unauthenticated visitors (the page server-renders this component without a session check; the bar is purely informational and harmless to display always).

### 7. Private profile page

`app/_components/PrivateProfile.tsx`:

```tsx
export function PrivateProfile({ username }: { username: string }) {
  // hero: "This DevAtlas is private."
  // sub: "Create your own DevAtlas →"
  // CTA links to /
}
```

### 8. Rate limiting in middleware

Extend `middleware.ts` (existing from Phase 1) with route-scoped rate limits. For now, a simple in-memory token bucket per IP suffices for previews. Production rate limiting uses Vercel Edge — document the trade-off as a comment. Specifically:

- `/{username}` route: 60 req/min/IP
- `/api/og/*` route: 60 req/min/IP + check `User-Agent` for known social crawler patterns (Twitterbot, LinkedInBot, Discordbot, facebookexternalhit, Slackbot)

Use the `@vercel/kv` rate limiter if available; otherwise fall back to a noop-with-warning. Document this in a `// TODO` so Phase 12 can plug in the real limiter.

### 9. Visibility integration test

`tests/integration/public-profile-visibility.test.ts`:

- User A is public. User B is private.
- Anonymous GET `/api/og/profile/A` → 200 with image.
- Anonymous GET `/api/og/profile/B` → 200 with placeholder/private image (or 404 — pick one and assert).
- `getPublicProfileByUsername('A')` returns map data without email or sync state fields.
- `getPublicProfileByUsername('B')` returns null.

Skip if no Supabase available.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- public-profile-visibility
grep -q "users_public_view" lib/db/queries/public-profile.ts
grep -q "edge" app/api/og/profile/\[username\]/route.tsx
grep -q "Twitterbot\|LinkedInBot" middleware.ts
```

## How to verify AC

Run the AC commands. The visibility test must pass (or skip if no DB available). The grep checks confirm the public profile path uses the safe view and the OG endpoint runs at the edge with crawler-aware logic.

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- The OG image generator MUST NOT read from `users` directly bypassing `users_public_view`. Stay disciplined — every public read goes through the view.
- Recap OG image is rendered here (route) but the upstream `weekly_recaps.og_image_url` field is just `/api/og/recap/{id}` — it never points to Storage.
- Do NOT pre-generate / cache OG images in our own storage. ADR-7 mandates on-demand.
- The "togglePublic" Server Action is shared with Phase 11. If you ship a temporary stub here, leave a `// TODO: replaced in Phase 11` comment so Phase 11 knows where to wire the final action.
- All identifiers, comments, copy in English.
- Be careful with `notFound()` vs returning a private placeholder — both have legitimate uses. The decision per `/docs/flow.md` is: render the "private or unknown" page (200 with private/unknown copy) rather than a hard 404 for `/{username}` because the URL might be valid but the owner just toggled private. Reserve 404 for clearly impossible routes.
