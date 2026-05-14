# Phase 9: OG Redesign + Landing + Legal + Error/Sitemap

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` Flow 1 §Landing · Flow 3 §Public profile · Sub-flow H (watermark)
- `/docs/screens.md` §A.1 Landing · §C constellation rendering · §M1 Privacy/Terms · §M2 500 page
- `/docs/adr.md` ADR-7 (OG on-demand) · ADR-26 (layered-circles glow) · ADR-44 (markdown legal) · ADR-52 (OG version) · ADR-59 (SEO sitemap + canonical)
- `/CLAUDE.md` §SPDX license headers
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 8's output:

- Email templates (3 variants) exist and snapshot tests pass
- `slot-builder.ts`, `subject-line.ts` exist
- `npm run build` passes

Read the existing code:

- `app/api/og/profile/[username]/route.tsx` and `app/api/og/recap/[recap_id]/route.tsx` — current OG endpoints
- `lib/og/ProfileImage.tsx`, `lib/og/RecapImage.tsx`, `lib/og/shared.tsx` — current renderers (card-based)
- `app/page.tsx` — current landing
- `app/_components/LandingDemo.tsx`, `app/_components/LandingAnalytics.tsx`, `app/_components/SignInButton.tsx`
- `app/privacy/page.tsx`, `app/terms/page.tsx` — pre-pivot legal stub pages

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Redesign OG images to render constellations. Rebuild the landing page around the DevAstra hero. Render legal pages from markdown. Add error.tsx / sitemap / robots / health endpoints.

### 1. `lib/og/ConstellationImage.tsx` (shared OG renderer)

Renders a constellation as an `@vercel/og`-compatible JSX tree (CSS-flexbox + inline SVG). Uses layered-circles for glow because satori does not support SVG `<filter>` elements. Per ADR-26 OG spike conclusion.

```tsx
import 'server-only'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES, ALL_TERRITORY_TYPES } from '@/features/territories/registry'
import { getStarPositions } from '@/features/territories/star-positions'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

// Same cluster centers as in Constellation.tsx, but for OG aspect (1200×630, ratio 1.9:1).
const CLUSTER_CENTERS: Record<TerritoryType, { cx: number; cy: number; r: number }> = {
  frontend_land:      { cx: 0.18, cy: 0.34, r: 0.13 },
  backend_fortress:   { cx: 0.50, cy: 0.34, r: 0.13 },
  data_pipeline_zone: { cx: 0.82, cy: 0.34, r: 0.13 },
  testing_lab:        { cx: 0.18, cy: 0.72, r: 0.13 },
  devops_harbor:      { cx: 0.50, cy: 0.72, r: 0.13 },
  docs_library:       { cx: 0.82, cy: 0.72, r: 0.13 },
}

export function ConstellationOG(props: {
  width: number   // typically 1200
  height: number  // typically 630
  territories: Array<{ type: TerritoryType; stage: number; growth30d: number; totalWeight: number }>
  landmarks: Array<{ tech_key: string; territory: TerritoryType; weight: number; firstUnlockedAt: string | null }>
  diffSince?: string | null  // for recap OG, highlight changed stars
  showHeroLabels?: boolean   // landing/profile = true; recap = optional
}): JSX.Element {
  const { width, height, territories, landmarks } = props
  const starsByCluster = new Map<TerritoryType, typeof landmarks>()
  for (const t of ALL_TERRITORY_TYPES) starsByCluster.set(t, [])
  for (const l of landmarks) starsByCluster.get(l.territory)?.push(l)

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0b1020', position: 'relative' }}>
      {/* Decorative dim sky gradient overlay */}
      {/* Use a single nested <svg> for the constellation visuals */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background gradient — satori supports linearGradient */}
        <defs>
          <linearGradient id="og-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1020" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#og-sky)" />

        {ALL_TERRITORY_TYPES.map((type) => {
          const center = CLUSTER_CENTERS[type]
          const cx = center.cx * width
          const cy = center.cy * height
          const radius = center.r * Math.min(width, height)
          const stars = starsByCluster.get(type) ?? []
          const litStars = stars.filter((s) => s.weight > 0)
          const positions = getStarPositions().filter((p) => p.territory === type)

          // Cluster aura: faint radial outline (single low-opacity circle to approximate glow)
          // satori does NOT support <radialGradient> reliably; use stacked circles.
          const auraColor = TERRITORIES[type].color
          const labelText = TERRITORIES[type].name

          return (
            <g key={type} transform={`translate(${cx}, ${cy})`}>
              {/* Cluster outline */}
              <circle r={radius} fill="none" stroke={auraColor} strokeWidth="1.5"
                      opacity={litStars.length > 0 ? 0.4 : 0.15} />

              {/* Stars */}
              {litStars.map((s) => {
                const pos = positions.find((p) => p.tech_key === s.tech_key)
                if (!pos) return null
                // pos.x, pos.y in [0,1] → cluster-local in [-radius, +radius]
                const sx = (pos.x - 0.5) * 2 * radius
                const sy = (pos.y - 0.5) * 2 * radius
                const r = Math.min(10, 3 + Math.log(Math.max(1, s.weight)) * 2)
                const isHighlighted = props.diffSince && s.firstUnlockedAt && s.firstUnlockedAt > props.diffSince
                const baseOpacity = isHighlighted ? 1 : 0.85
                return (
                  <g key={s.tech_key} transform={`translate(${sx}, ${sy})`}>
                    {/* Layered glow (3 concentric circles) */}
                    <circle r={r * 3} fill={auraColor} opacity={isHighlighted ? 0.16 : 0.06} />
                    <circle r={r * 2} fill={auraColor} opacity={isHighlighted ? 0.30 : 0.14} />
                    <circle r={r * 1.4} fill={auraColor} opacity={isHighlighted ? 0.55 : 0.35} />
                    <circle r={r} fill={auraColor} opacity={baseOpacity} />
                  </g>
                )
              })}

              {/* Cluster label */}
              {litStars.length > 0 && (
                <text x={0} y={radius + 22} textAnchor="middle" fontSize="14" fill="#cbd5e1" fontFamily="system-ui">
                  {labelText}
                </text>
              )}

              {/* Hero labels — top 1-2 stars by weight */}
              {props.showHeroLabels !== false &&
                [...litStars].sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
                  .slice(0, 2)
                  .map((s) => {
                    const pos = positions.find((p) => p.tech_key === s.tech_key)
                    if (!pos) return null
                    const sx = (pos.x - 0.5) * 2 * radius
                    const sy = (pos.y - 0.5) * 2 * radius
                    const name = getPublicTech(s.tech_key)?.displayName ?? s.tech_key
                    return (
                      <text key={`label-${s.tech_key}`} x={sx + 10} y={sy + 4}
                            fontSize="11" fill="#e2e8f0" fontFamily="system-ui">
                        {name}
                      </text>
                    )
                  })}
            </g>
          )
        })}

        {/* Watermark bottom-right */}
        <text x={width - 24} y={height - 20} textAnchor="end" fontSize="14" fill="#475569" fontFamily="system-ui">
          ⭐ devastra.app
        </text>
      </svg>
    </div>
  )
}
```

### 2. Update `lib/og/ProfileImage.tsx`

```tsx
import 'server-only'
import { ImageResponse } from 'next/og'
import { ConstellationOG } from './ConstellationImage'
import type { TerritoryType } from '@/features/territories/registry'

export type OgMapData = {
  territories: Array<{ type: TerritoryType; stage: number; totalWeight: number; growth30d: number; stageChangedAt: string | null }>
  landmarks: Array<{ tech_key: string; territory: TerritoryType; weight: number; firstUnlockedAt: string | null }>
}

export function renderProfileImage(opts: {
  displayUsername: string
  avatarUrl: string | null
  map: OgMapData
}): ImageResponse {
  const width = 1200
  const height = 630
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#0b1020' }}>
        <ConstellationOG
          width={width}
          height={height}
          territories={opts.map.territories}
          landmarks={opts.map.landmarks}
          showHeroLabels={true}
        />
        {/* Optional small username overlay top-left, if avatarUrl present */}
        {/* (Render as a positioned <div> outside the <svg>; satori absolute positioning works.) */}
      </div>
    ),
    { width, height },
  )
}

export function renderPrivatePlaceholder(): ImageResponse {
  // A subtle dim-sky image with text "Private constellation on DevAstra"
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#0b1020' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: 32, fontWeight: 600, fontFamily: 'system-ui' }}>Private constellation</span>
          <span style={{ color: '#64748b', fontSize: 20, marginTop: 8, fontFamily: 'system-ui' }}>devastra.app</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
```

### 3. Update `lib/og/RecapImage.tsx`

Renders the recap hero with diff overlay + stat strip.

```tsx
import 'server-only'
import { ImageResponse } from 'next/og'
import { ConstellationOG } from './ConstellationImage'
import type { OgMapData } from './ProfileImage'

export function renderRecapImage(opts: {
  map: OgMapData
  weekStart: Date
  statStripText: string  // e.g. "+2 stars · Backend +18%" — caller composes from highlights
}): ImageResponse {
  const width = 1200
  const height = 630
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#0b1020' }}>
        <ConstellationOG
          width={width}
          height={height}
          territories={opts.map.territories}
          landmarks={opts.map.landmarks}
          diffSince={opts.weekStart.toISOString()}
          showHeroLabels={false}
        />
        {/* Stat strip top-right */}
        <div style={{ position: 'absolute', top: 24, right: 28, color: '#e2e8f0', fontFamily: 'system-ui', fontSize: 16, fontWeight: 600 }}>
          {opts.statStripText}
        </div>
      </div>
    ),
    { width, height },
  )
}
```

### 4. Update OG route handlers

#### `app/api/og/profile/[username]/route.tsx`

```ts
export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { renderProfileImage, renderPrivatePlaceholder } from '@/lib/og/ProfileImage'
import type { TerritoryType } from '@/features/territories/registry'

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const { username } = params
  // ... existing logic, updated to render new ConstellationOG-based image ...
  // Verify user is public via users_public_view; fetch territories + landmarks via service-role client.
  // If is_public = false or username not found: return renderPrivatePlaceholder().
  // Otherwise call renderProfileImage(...).
  // Final return type: ImageResponse.
  // ...
}
```

#### `app/api/og/recap/[recap_id]/route.tsx`

Adapt to fetch the `weekly_recaps` row by ID, derive `OgMapData` snapshot (use the user's current territories + landmarks for the hero; the diff overlay uses `weekStart`), and call `renderRecapImage` with a stat-strip composed from `highlights`.

`statStripText` composition:
- If `highlights.slot_1.kind === 'stage_up'`: `Backend expanded`
- Append new-star count: `+2 stars` (from `slot_2.tech_keys.length`)
- Append growth pct if `slot_1.kind === 'brightest_cluster'`: `Backend +18%`

Compose into a single string like `+2 stars · Backend +18%` for the strip.

### 5. Landing page rebuild — `app/page.tsx`

```tsx
import { Suspense } from 'react'
import { LandingHero } from './_components/LandingHero'
import { SampleProfilesGallery } from './_components/SampleProfilesGallery'
import { SignInButton } from './_components/SignInButton'
import { LandingFooter } from './_components/LandingFooter'

export default function LandingPage(): JSX.Element {
  return (
    <main style={{ minHeight: '100vh', background: '#0b1020', color: '#f1f5f9' }}>
      <LandingHero />
      <SignInButton />
      <Suspense fallback={null}>
        <SampleProfilesGallery />
      </Suspense>
      <LandingFooter />
    </main>
  )
}
```

#### `app/_components/LandingHero.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Constellation, type ConstellationData } from '@/app/_components/Constellation/Constellation'

const REVEAL_LOCAL_KEY = 'landing_reveal_last_at'
const REVEAL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export function LandingHero(): JSX.Element {
  const [revealKey, setRevealKey] = useState(0)
  const [showStatic, setShowStatic] = useState(false)

  useEffect(() => {
    const last = localStorage.getItem(REVEAL_LOCAL_KEY)
    const ts = last ? Number(last) : 0
    if (Date.now() - ts > REVEAL_INTERVAL_MS) {
      // Reveal animation runs once
      localStorage.setItem(REVEAL_LOCAL_KEY, String(Date.now()))
      setRevealKey((k) => k + 1)
    } else {
      setShowStatic(true)
    }
  }, [])

  // Data: the founder's real constellation, fetched at build/SSR time.
  // For client component simplicity here, accept the data as prop from the server component parent,
  // OR call a server function via a wrapping client island. The simplest path is to make LandingHero
  // a SERVER component that passes data to a client subcomponent for the reveal trigger.
  //
  // (See implementation note in §6 below.)

  return /* ... */ null as any
}
```

**Implementation note:** restructure so that `LandingHero` is a Server Component that fetches the founder's constellation data (or a hardcoded demo if no founder identity is set), then passes to a small client wrapper that handles the 7-day localStorage gate and the reveal animation timing.

For MVP, the founder identity can be hardcoded as an env var: `LANDING_DEMO_GITHUB_LOGIN=juhochoi`. Resolve to a `users` row via `github_login` and load their territories + landmarks. If the env var is not set or the user is not public, fall back to a synthetic empty constellation (six cluster outlines, no lit stars).

`lib/db/queries/landing-demo.ts`:

```ts
import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { territories } from '@/lib/db/schema/territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { withUserScope } from './_helpers'

export async function getLandingDemoData() {
  const demoLogin = process.env.LANDING_DEMO_GITHUB_LOGIN
  if (!demoLogin) return null

  const [user] = await db.select({ id: users.id, isPublic: users.isPublic }).from(users)
    .where(sql`lower(${users.githubLogin}) = lower(${demoLogin})`).limit(1)

  if (!user || !user.isPublic) return null

  const [territoriesRows, landmarksRows] = await Promise.all([
    db.select().from(territories).where(withUserScope(user.id, territories.userId)),
    db.select().from(landmarks).where(withUserScope(user.id, landmarks.userId)),
  ])

  return { user, territories: territoriesRows, landmarks: landmarksRows }
}
```

The landing page server component:

```tsx
import { getLandingDemoData } from '@/lib/db/queries/landing-demo'
import { LandingHero } from './_components/LandingHero'

export default async function LandingPage() {
  const demo = await getLandingDemoData()
  // demo can be null → render an empty 6-cluster sky as placeholder
  return /* ... LandingHero gets `data` prop ... */
}
```

The hero content includes:
- Headline: `A developer skill constellation that lights up as you code.` (size 40+px, bold)
- Sub-line: `Connect GitHub. See what you've built, brighter every week.` (size 18px, muted)
- Founder constellation rendering (60-70% of viewport)
- `Sign in with GitHub` CTA button (centered below sub-line)

#### `app/_components/SignInButton.tsx`

If not already present, ensure it triggers the `signIn()` Server Action (Phase 7 wires this).

#### `app/_components/SampleProfilesGallery.tsx`

```tsx
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { eq } from 'drizzle-orm'

// Curated set (MVP: hardcoded usernames). Per ADR — Flow 1 #107: founder picks.
const CURATED_USERNAMES: string[] = [
  // populate with 3 real usernames once they're available; empty array → don't render the section
]

export async function SampleProfilesGallery() {
  if (CURATED_USERNAMES.length === 0) return null

  // Fetch curated users (must be is_public=true)
  // Render 3 cards horizontally; each card: small constellation preview (use ConstellationOG inline as <img src="/api/og/profile/{username}?v=..." />)
  return /* ... */ null as any
}
```

If the curated list is empty (initial deploy), the gallery section simply does not render. Founder fills it in over time.

#### `app/_components/LandingFooter.tsx`

```tsx
import Link from 'next/link'

export function LandingFooter(): JSX.Element {
  return (
    <footer style={{ padding: 24, color: '#64748b', fontSize: 12, textAlign: 'center' }}>
      <Link href="/privacy" style={{ color: '#94a3b8', marginRight: 12 }}>Privacy</Link>
      <Link href="/terms" style={{ color: '#94a3b8', marginRight: 12 }}>Terms</Link>
      <a href="https://github.com/devastra/devastra" style={{ color: '#94a3b8' }} target="_blank" rel="noopener">GitHub</a>
    </footer>
  )
}
```

### 6. Legal pages — render markdown

#### `app/privacy/page.tsx`

```tsx
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-static'

async function loadPrivacy(): Promise<string> {
  const filePath = path.join(process.cwd(), 'docs', 'legal', 'privacy.md')
  return fs.readFile(filePath, 'utf-8')
}

export default async function PrivacyPage(): Promise<JSX.Element> {
  const markdown = await loadPrivacy()
  // Render markdown to HTML. Use a lightweight library like `react-markdown` or pre-render at build via `marked`.
  // For MVP, install `marked` if not present.
  //
  // Layout: dim sky background + a light-text-on-white "document card" centered (max 760px).
  // Render the markdown HTML inside a styled <div>.
  return /* ... */ null as any
}
```

Same shape for `app/terms/page.tsx`.

If `marked` (or `react-markdown`) is not installed, run `npm install marked` in this phase. The renderer is server-only; no client bundle impact.

### 7. `app/error.tsx` — generic 500 page

```tsx
'use client'
import Link from 'next/link'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }): JSX.Element {
  return (
    <main style={{ minHeight: '100vh', background: '#0b1020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Something went wrong on our end.</h1>
        <p style={{ color: '#94a3b8', marginTop: 12 }}>We&apos;ve been notified. Please try again in a moment.</p>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={reset} style={{ background: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: 6 }}>Retry</button>
          <Link href="/" style={{ color: '#94a3b8', padding: '8px 16px' }}>Home</Link>
        </div>
      </div>
    </main>
  )
}
```

### 8. Sitemap + robots

#### `app/sitemap.ts`

```ts
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

export const revalidate = 86400  // daily cache

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Public users
  const publicUsers = await db.execute<{ display_username: string; updated_at: string }>(
    sql`SELECT display_username, GREATEST(created_at, last_incremental_sync_at, last_login_at) as updated_at
        FROM public.users
        WHERE is_public = true
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 10000`,
  )

  const userEntries: MetadataRoute.Sitemap = (publicUsers as any[]).map((u) => ({
    url: `${base}/${u.display_username}`,
    lastModified: u.updated_at ? new Date(u.updated_at) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticEntries, ...userEntries]
}
```

#### `app/robots.ts`

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/auth/', '/settings', '/onboarding/', '/unsubscribe'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
```

### 9. `app/api/health/route.ts`

```ts
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 503 })
  }
}
```

### 10. Authenticated main page meta + sign-out toast (`/?signed_out=true`)

In `app/(authenticated)/page.tsx` and `app/page.tsx`, surface a small toast if `?signed_out=true` is present in the URL (read once on mount, show "Signed out" via `sonner` toast, then strip the param from the URL).

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Existing tests still pass
npx vitest run tests/unit

# New OG files exist
test -f lib/og/ConstellationImage.tsx

# Landing pieces exist
test -f app/_components/LandingHero.tsx
test -f app/_components/LandingFooter.tsx
test -f app/_components/SampleProfilesGallery.tsx
test -f lib/db/queries/landing-demo.ts

# Legal + error + sitemap + robots + health
test -f app/privacy/page.tsx
test -f app/terms/page.tsx
test -f app/error.tsx
test -f app/sitemap.ts
test -f app/robots.ts
test -f app/api/health/route.ts

# Markdown library installed
node -e "require('marked')" 2>/dev/null && echo ok || (echo "marked not installed" && false)

# OG endpoints still resolve
# (Not a build-time check — verified by Phase 11 E2E)
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 9 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **`@vercel/og` runs in Edge runtime.** All imports in OG route files must be edge-compatible. `lib/og/*` is edge-compatible by design. Do NOT import `lib/db/client.ts` from edge — query Supabase via `@supabase/supabase-js` client with the service role key instead.
- **Layered-circles glow (3 concentric)** is the proven approach from the OG spike (`docs/adr.md` ADR-26). SVG `<filter>` is not supported by satori.
- **Watermark format**: `⭐ devastra.app` (or `⭐ devastra.app/{username}` for profile images, per Sub-flow H). Bottom-right corner, dim gray text, small font.
- **Founder demo for landing**: env var `LANDING_DEMO_GITHUB_LOGIN`. If unset or user not public, fallback to synthetic empty sky. Do not crash.
- **7-day reveal interval**: localStorage gates per-visitor reveal animation. Reduced-motion preference disables the animation regardless.
- **`SampleProfilesGallery`**: curated list is empty for initial deploy → section does not render. Founder updates the array in code over time. Not a CMS, not a DB-backed gallery for MVP.
- **Sitemap**: daily cache (revalidate: 86400). Includes up to 10k public users. Beyond that, paginated sitemaps are a v0.2 concern.
- **Robots**: disallow `/api/`, `/auth/`, `/settings`, `/onboarding/`, `/unsubscribe`. Allow `/` and `/{username}`.
- **Error page is a client component** because Next.js requires `app/error.tsx` to be a client boundary (it receives the error object).
- **Markdown renderer**: `marked` is a tiny synchronous lib that suits `force-static` legal pages. If `react-markdown` is preferred for component customization, also acceptable.
- **No new dependencies** beyond `marked` (or `react-markdown`). Avoid adding image-processing libs.
- **OG profile route currently uses `next/og` with the supabase service-role client.** Keep that pattern; only the rendering body changes.
