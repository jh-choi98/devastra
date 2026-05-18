# Phase 10: OG Renderer Refactor

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-7 (OG image strategy), ADR-52 (OG cache versioning), ADR-62 (SVG OG divergence at ~80% fidelity, "Stellarium-inspired static poster" framing)
- `/docs/screens.md` §C Canvas (the rendering primitives the OG renderer must approximate)
- `/CLAUDE.md` — `features/constellation/render/*` isomorphic exception
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- Phase 2: `features/constellation/render/*` modules are complete and tested
- Phase 5: `public/textures/milky-way-fallback.jpg` exists

Read the current code:

- `lib/og/ConstellationImage.tsx` (server-only) — current OG SVG renderer
- `app/api/og/profile/[username]/route.tsx` — current OG route
- `app/api/og/recap/[recap_id]/route.tsx` — recap OG route

## Work

This phase refactors the OG SVG renderer to import from `features/constellation/render/*` so anchors, palette, Voronoi boundaries, magnitude, label rule, MST stay in lockstep with the WebGL renderer.

### 1. Refactor `lib/og/ConstellationImage.tsx`

Replace inline duplication of math with imports from the shared module:

```tsx
import 'server-only'
import { anchorsFor, anchorFor } from '@/features/constellation/render/anchors'
import { spectralColorFor, spectralHex } from '@/features/constellation/render/palette'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { magnitudeFor, topQuintileThreshold } from '@/features/constellation/render/magnitude'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { mstEdges } from '@/features/constellation/render/mst'
// (no field-stars in OG — adds complexity for marginal gain at this resolution)
```

Use `viewport='og'` for all `features/constellation/render/*` calls.

### 2. Render layers in SVG

The OG renderer must produce a static Stellarium-inspired poster at 1200×630 (or 800×420 for recap variants — whichever the route specifies). The SVG mirrors the WebGL Scene layer order:

```tsx
<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">
  <defs>
    {/* Sky gradient */}
    <linearGradient id="og-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#020207" />
      <stop offset="1" stopColor="#050307" />
    </linearGradient>
    {/* Star glow filters — gaussian blur stacks for bloom approximation */}
    <filter id="og-bloom-soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur1" />
      <feGaussianBlur stdDeviation="4" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2" />
        <feMergeNode in="blur1" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="og-bloom-strong" ...>
      {/* heavier stack for brightest stars */}
    </filter>
  </defs>

  {/* (0) Sky background */}
  <rect width="1000" height="700" fill="url(#og-sky)" />

  {/* (1) Milky Way — baked PNG embedded inline as <image href=".../milky-way-fallback.jpg"/> */}
  <image
    href="/textures/milky-way-fallback.jpg"
    x="0" y="0" width="1000" height="700"
    preserveAspectRatio="xMidYMid slice"
    opacity="0.85"
    style={{ mixBlendMode: 'screen' }}
  />

  {/* (3) Territory boundary lines — Voronoi cells */}
  {voronoiCells('og').map(cell => (
    <polygon
      key={cell.type}
      points={cell.polygon.map(p => `${p.x},${p.y}`).join(' ')}
      fill="none"
      stroke="#4a5566"
      strokeOpacity="0.10"
      strokeWidth="0.7"
    />
  ))}

  {/* (4) Connections (MST) */}
  {mstEdgesByCluster(data, 'og').map((e, i) => (
    <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke="#5a6c80" strokeWidth="0.7" opacity="0.22" />
  ))}

  {/* (5) Tech stars — circles with bloom filter */}
  {litStars.map(s => {
    const mag = magnitudeFor(s.weight, threshold)
    const color = spectralHex(spectralColorFor(s.tech_key))
    return (
      <g key={s.tech_key} filter={mag.showSpikes ? 'url(#og-bloom-strong)' : 'url(#og-bloom-soft)'}>
        <circle cx={s.pos.x} cy={s.pos.y} r={mag.coreRadius} fill={color} />
        {mag.showSpikes && (
          <>
            <line x1={s.pos.x - mag.spikeLength} y1={s.pos.y} x2={s.pos.x + mag.spikeLength} y2={s.pos.y} stroke={color} strokeWidth="0.5" opacity="0.85" />
            <line x1={s.pos.x} y1={s.pos.y - mag.spikeLength} x2={s.pos.x} y2={s.pos.y + mag.spikeLength} stroke={color} strokeWidth="0.5" opacity="0.85" />
          </>
        )}
      </g>
    )
  })}

  {/* (8) Labels — small blue-white text */}
  {/* Cluster labels — always rendered */}
  {anchorsFor('og').map(a => (
    <text key={a.type} x={a.x} y={a.y + a.spread + 18} fontSize="12" fill="#8aa0b8" textAnchor="middle" fontFamily="system-ui">
      {clusterDisplayName(a.type)}
    </text>
  ))}
  {/* Persistent star labels — from selectPersistentLabels rule */}
  {persistentLabelLandmarks.map(l => (
    <text key={l.tech_key} x={l.pos.x} y={l.pos.y - 14} fontSize="10" fill="#d8e0ec" textAnchor="middle" fontFamily="system-ui">
      {techDisplayName(l.tech_key)}
    </text>
  ))}
</svg>
```

Hard rules:
- Imports MUST come from `features/constellation/render/*` (not duplicated inline).
- Layer order matches WebGL Scene (sky → milky way → boundaries → connections → tech stars → labels).
- Field stars are NOT rendered in OG (omit Layer 2 — adds noise at thumbnail scale for marginal gain).
- Aura is NOT rendered in OG (event-only, no event in static poster). Unless the recap variant explicitly highlights stage-up clusters — in that case render the aura for those clusters only (recap-specific overlay).

### 3. Embed the Milky Way fallback texture

Two strategies for the `<image href>` in @vercel/og:

- (a) Reference `/textures/milky-way-fallback.jpg` directly — the edge runtime fetches it. Verify this works in @vercel/og (it typically does for same-origin assets).
- (b) Base64-encode the JPG and inline it as `data:image/jpeg;base64,...`. Larger payload, but bulletproof.

Try (a) first. If @vercel/og fails to fetch (some edge runtimes have quirks), fall back to (b). Document which path is used in `phase10-output.json`.

### 4. Update `OG_RENDER_VERSION`

Per ADR-52, bump the constant to invalidate cached OG images. Update:

- `lib/og/version.ts` — bump `OG_RENDER_VERSION` constant to a new tag, e.g. `'devastra-stellarium-v1'`
- Verify `ogVersionParam()` is appended to all OG URLs (existing logic)

### 5. Recap OG variant

`app/api/og/recap/[recap_id]/route.tsx` produces the weekly recap email hero image. The base layout is identical, but with:

- This-week diff overlay: changed stars get +1 magnitude (bigger glow)
- Stage-up cluster: aura rendered in cluster color (this is the recap-only exception to "no aura in OG")
- Small top-right stat strip: `+2 stars · Backend +18%` (existing logic)

Verify the existing route still works with the new renderer. The recap-specific overlay is layered on top of the base SVG.

### 6. Test the OG output

```bash
# Start dev server, hit the OG endpoints, save the PNGs locally
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
curl -o tasks/2-stellarium-redesign/visual-checkpoints/og-profile.png \
  "http://localhost:3000/api/og/profile/founder?ogv=devastra-stellarium-v1"
curl -o tasks/2-stellarium-redesign/visual-checkpoints/og-recap.png \
  "http://localhost:3000/api/og/recap/test-recap?ogv=devastra-stellarium-v1"
kill $DEV_PID || true

# Verify each PNG exists and is non-trivial size
test -s tasks/2-stellarium-redesign/visual-checkpoints/og-profile.png
test $(wc -c < tasks/2-stellarium-redesign/visual-checkpoints/og-profile.png) -gt 30000  # >30KB
```

(Use a known test username / recap that the dev server can serve. If founder's data isn't seeded locally, mock the OG route to accept a `?test=1` flag that returns deterministic mock data — useful for testing without DB.)

## Acceptance Criteria

```bash
# (1) OG renderer imports from features/constellation/render/*
grep -q "from '@/features/constellation/render" lib/og/ConstellationImage.tsx

# (2) OG renderer does NOT duplicate the math inline
# (e.g. it does NOT re-define anchor coordinates, voronoi, palette, etc.)
! grep -E "ANCHORS\\s*=" lib/og/ConstellationImage.tsx

# (3) Milky Way fallback texture is embedded
grep -q "milky-way-fallback" lib/og/ConstellationImage.tsx

# (4) OG_RENDER_VERSION bumped to a new value
git diff HEAD~6 lib/og/version.ts | grep "OG_RENDER_VERSION"  # diff shows change

# (5) Build passes
npm run build

# (6) Profile OG endpoint returns a non-trivial PNG
test -f tasks/2-stellarium-redesign/visual-checkpoints/og-profile.png
test $(wc -c < tasks/2-stellarium-redesign/visual-checkpoints/og-profile.png) -gt 30000

# (7) Recap OG endpoint returns a non-trivial PNG
test -f tasks/2-stellarium-redesign/visual-checkpoints/og-recap.png
test $(wc -c < tasks/2-stellarium-redesign/visual-checkpoints/og-recap.png) -gt 30000

# (8) Edge runtime compatibility: lib/og/ConstellationImage.tsx imports work in edge runtime
# (Manually verify: the import chain from features/constellation/render/* MUST NOT pull in node-only APIs)
! grep -rE "from 'fs'|from 'path'|process\\.env\\.HOME" features/constellation/render/
```

## How to verify AC

Run AC commands. All eight must pass. Set phase 10 status to `"completed"`.

## Notes

- **80% fidelity is acceptable.** Per ADR-62, OG is a "Stellarium-inspired static poster" not a pixel-accurate snapshot. The bloom approximation via `<feGaussianBlur>` stacks won't perfectly match WebGL UnrealBloom, and that's OK. Aim for brand consistency.
- **Reuse — do not re-implement.** Every piece of math (anchors, Voronoi, palette, magnitude, labels, MST) MUST come from `features/constellation/render/*`. Re-implementing inline is a regression — the whole point of the shared module is lock-step renderers.
- **Edge runtime compatibility.** `lib/og/ConstellationImage.tsx` runs in @vercel/og's edge runtime. No `fs`, `path`, `crypto.randomBytes`, or other Node-only APIs in its import chain. The `features/constellation/render/*` modules are pure TypeScript and should already comply, but verify.
- **OG_RENDER_VERSION bump.** Bumping invalidates the existing OG cache. After deploy, social-media-shared URLs will start regenerating with the new look. This is intended for a major visual change like this.
- **No field stars in OG.** A 1200×630 thumbnail with 2000 micro-points becomes noise. Skip Layer 2 entirely for OG.
- **No aura in OG (except recap stage-up).** Static images don't have hover/drawer state. Only the recap variant overlays aura for stage-up clusters because that's the recap's explicit purpose.
- **Server-only.** `lib/og/ConstellationImage.tsx` keeps `import 'server-only'` at the top (existing).
- **MIT headers stay.** Files under `features/constellation/render/` keep their SPDX MIT headers; this phase touches them only via import.
