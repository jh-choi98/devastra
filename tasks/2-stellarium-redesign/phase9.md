# Phase 9: Cinematics (Spark, Stage-Up, First-Ever, Reveal)

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-38 (first-ever star cinematic detection), ADR-39 (long-absence threshold), ADR-61 (event-only aura)
- `/docs/screens.md` §I.1 First-time reveal, §I.2 First-ever star cinematic, §I.3 Stage-up moment
- `/docs/flow.md` Flow 1 step 6 (reveal), Sub-flow A (stage-up), Sub-flow B (first-ever)
- `/CLAUDE.md` — "First-ever star cinematic detection (ADR-38)"
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- Phase 8: Labels, TooltipHost, A11yOverlay mounted. Interaction wires functional.
- Phase 3-7: ClusterAura responds to `cinematic` state from ConstellationContext.

Read the current code:

- `app/_components/SpecialMoments/FirstEverStarCinematic.tsx` — current placeholder (returns `null`)
- `app/_components/SpecialMoments/FirstTimeReveal.tsx` — current first-time reveal cinematic
- `app/_components/SpecialMoments/StageUpMoment.tsx` — current stage-up cinematic
- `app/_components/Constellation/SparkAnimation.tsx` — current spark animation logic (legacy SVG path)
- `features/sync/cinematic-detection.ts` — server-side detection of first-ever cinematic eligibility
- `app/(authenticated)/_map-container.tsx` — current `showCinematic` state plumbing

## Work

This phase migrates cinematic visuals from the SpecialMoments DOM components into the WebGL Scene where it makes sense, and keeps orchestration (timers, can-skip logic, server flag wire-up) in React state as it is today.

### 1. `cinematics/SparkSequence.tsx` — new star unlock

Triggered automatically when a landmark transitions from non-lit → lit OR newly-unlocked-this-week. Detected via prop diff against the previous render.

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useConstellationState } from '../state'

interface SparkInstance {
  tech_key: string
  worldPos: { x: number; y: number; z: number }
  age: number          // 0..1 (animation progress)
  color: THREE.Color
}

interface SparkSequenceProps {
  newlyLitTechKeys: string[]   // computed by parent: diff against previous data
}

export function SparkSequence({ newlyLitTechKeys }: SparkSequenceProps) {
  const { reducedMotion } = useConstellationState()
  const sparks = useRef<SparkInstance[]>([])

  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: skip spark, just mark as lit instantly (the TechStars layer
      // already renders them). No sparks added.
      return
    }
    // Add a spark for each newly lit star
    newlyLitTechKeys.forEach((tk, i) => {
      // Resolve position via star-positions helper
      sparks.current.push({ tech_key: tk, worldPos: /* resolve */, age: 0, color: /* spectral */ })
    })
  }, [newlyLitTechKeys, reducedMotion])

  useFrame((_, dt) => {
    // Age each spark; remove when age >= 1
    sparks.current.forEach(s => { s.age = Math.min(1, s.age + dt / 0.6) })  // 600ms total
    sparks.current = sparks.current.filter(s => s.age < 1)
  })

  // Render: each spark = expanding ring + flash core, fading out
  return (
    <group renderOrder={15}>
      {sparks.current.map((s, i) => (
        <mesh key={`${s.tech_key}-${i}`} position={[s.worldPos.x, s.worldPos.y, 0]}>
          <ringGeometry args={[0.005 + s.age * 0.04, 0.006 + s.age * 0.04, 32]} />
          <meshBasicMaterial
            color={s.color}
            transparent
            opacity={1 - s.age}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
```

(Implementation hint: managing animation state via ref + useFrame is the R3F idiom; React state would re-render the whole tree per frame which is wasteful.)

### 2. `cinematics/StageUpRipple.tsx` — cluster stage-up moment

Triggered when `territories[i].stage` increases compared to previous render. Sets `cinematic = 'stage-up'` for 1.5s and emits a ripple wave from the cluster center.

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useConstellationState } from '../state'
import { anchorFor } from '@/features/constellation/render/anchors'
import { viewBoxToWorld } from '@/features/constellation/render/coords'

interface StageUpRippleProps {
  stagedUpClusters: TerritoryType[]   // diff against previous render
  viewport?: 'desktop' | 'mobile' | 'og'
}

interface RippleInstance {
  type: TerritoryType
  age: number
  color: THREE.Color
}

export function StageUpRipple({ stagedUpClusters, viewport = 'desktop' }: StageUpRippleProps) {
  const { setCinematic, reducedMotion } = useConstellationState()
  const ripples = useRef<RippleInstance[]>([])

  useEffect(() => {
    if (stagedUpClusters.length === 0) return
    if (reducedMotion) {
      // Skip ripple; just briefly set cinematic mode so the aura flashes on
      setCinematic('stage-up')
      setTimeout(() => setCinematic('idle'), 200)
      return
    }
    setCinematic('stage-up')
    // 0.3s stagger between clusters
    stagedUpClusters.forEach((type, i) => {
      setTimeout(() => {
        ripples.current.push({ type, age: 0, color: /* cluster color */ })
      }, i * 300)
    })
    // Total cinematic duration: 1.5s + (n-1) * 0.3s stagger
    const dur = 1500 + (stagedUpClusters.length - 1) * 300
    const t = setTimeout(() => setCinematic('idle'), dur)
    return () => clearTimeout(t)
  }, [stagedUpClusters, setCinematic, reducedMotion])

  useFrame((_, dt) => {
    ripples.current.forEach(r => { r.age = Math.min(1, r.age + dt / 1.5) })
    ripples.current = ripples.current.filter(r => r.age < 1)
  })

  return (
    <group renderOrder={12}>
      {ripples.current.map((r, i) => {
        const a = anchorFor(viewport, r.type)
        const center = viewBoxToWorld({ x: a.x, y: a.y })
        const radius = (a.spread / 1000) * (0.3 + r.age * 1.6)
        return (
          <mesh key={`${r.type}-${i}`} position={[center.x, center.y, 0]}>
            <ringGeometry args={[radius * 0.95, radius, 64]} />
            <meshBasicMaterial color={r.color} transparent opacity={(1 - r.age) * 0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}
```

### 3. `cinematics/FirstEverCinematic.tsx` — replaces the existing placeholder

This is the 8-second cannot-skip first-ever moment per ADR-38 / `docs/screens.md` §I.2.

The CURRENT file `app/_components/SpecialMoments/FirstEverStarCinematic.tsx` returns `null`. Move logic to `app/_components/Constellation/cinematics/FirstEverCinematic.tsx` and have the SpecialMoments file re-export it (or delete the old file and update callers).

```tsx
'use client'
import { useEffect } from 'react'
import { useConstellationState } from '../state'

interface FirstEverCinematicProps {
  firstStarTechKeys: string[]    // up to 3 stars that lit in this sync (per ADR-38)
  onComplete: () => void          // callback to clear users.first_star_cinematic_pending
}

export function FirstEverCinematic({ firstStarTechKeys, onComplete }: FirstEverCinematicProps) {
  const { setCinematic, reducedMotion } = useConstellationState()

  useEffect(() => {
    setCinematic('first-ever')
    if (reducedMotion) {
      // Snap to final state immediately
      const t = setTimeout(() => { setCinematic('idle'); onComplete() }, 200)
      return () => clearTimeout(t)
    }
    // 8-second sequence:
    //   0..0.5s   cluster outlines (boundaries) brighten +0.5 opacity
    //   0.5..3.5s first star sparks fire with 0.3s stagger
    //   3.5..6s   strip copy fades in: "Your first star lit: Docker" / "Your first stars: ..."
    //   6..7.5s   "Your constellation has begun" fades in/out
    //   7.5..8s   long glow on first stars
    // Implement via setTimeout sequence; visuals are produced by the in-scene layers
    // (ClusterAura for outlines, SparkSequence for sparks, a DOM strip outside Scene for copy).
    const t = setTimeout(() => { setCinematic('idle'); onComplete() }, 8000)
    return () => clearTimeout(t)
  }, [reducedMotion, setCinematic, onComplete])

  // Render the bottom strip copy (DOM, outside Scene):
  return (
    <div className="fixed inset-x-0 bottom-12 flex justify-center pointer-events-none z-40">
      <div className="text-slate-100 text-sm">
        {/* phase-appropriate copy here, driven by elapsed time */}
      </div>
    </div>
  )
}
```

The visual effects (cluster outline brightening, sparks, etc.) are driven by the in-scene layers reading `cinematic === 'first-ever'` from ConstellationContext + the `firstStarTechKeys` passed to SparkSequence. The DOM strip is the only piece outside Scene.

Update callers — `app/(authenticated)/_map-container.tsx` currently imports `FirstEverStarCinematic` from `app/_components/SpecialMoments/`. Update the import path to the new location (or keep the SpecialMoments file as a thin re-export).

### 4. `cinematics/RevealSequence.tsx` — first-time reveal (Flow 1 step 6)

Triggered on a user's first lifetime entry to `/` after onboarding (currently handled by `FirstTimeReveal.tsx` in `SpecialMoments/`). The new implementation:

```tsx
'use client'
import { useEffect } from 'react'
import { useConstellationState } from '../state'

interface RevealSequenceProps {
  totalCommits?: number
  totalRepos?: number
  litClusters?: TerritoryType[]
  onComplete: () => void
}

export function RevealSequence({ totalCommits, totalRepos, litClusters, onComplete }: RevealSequenceProps) {
  const { setCinematic, reducedMotion } = useConstellationState()
  useEffect(() => {
    setCinematic('reveal')
    if (reducedMotion) {
      const t = setTimeout(() => { setCinematic('idle'); onComplete() }, 200)
      return () => clearTimeout(t)
    }
    // 12s minimum, 30s max per `docs/screens.md` Flow 1 step 6.
    const t = setTimeout(() => { setCinematic('idle'); onComplete() }, 12000)
    return () => clearTimeout(t)
  }, [reducedMotion, setCinematic, onComplete])

  // Bottom-right counter + bottom strip ("Lit: Frontend · Backend · Testing"). DOM, outside Scene.
  return (
    <>
      <div className="fixed bottom-6 right-6 text-slate-300 text-sm pointer-events-none">
        {totalCommits ?? '—'} commits analyzed in {totalRepos ?? '—'} repos
      </div>
      <div className="fixed inset-x-0 bottom-12 flex justify-center pointer-events-none">
        <div className="text-slate-100 text-sm">
          Lit: {litClusters?.map(c => clusterDisplayName(c)).join(' · ')}
        </div>
      </div>
    </>
  )
}
```

### 5. Wire diff detection in `Scene.tsx` (or a thin wrapper)

The diff `newlyLitTechKeys` and `stagedUpClusters` are computed from prop changes. Add a hook:

```tsx
// hooks/useDataDiff.ts
import { useRef } from 'react'
import type { ConstellationData } from '../types'

export function useDataDiff(data: ConstellationData) {
  const prev = useRef<ConstellationData | null>(null)
  const newlyLit: string[] = []
  const stagedUp: TerritoryType[] = []

  if (prev.current) {
    const wasLit = new Set(
      prev.current.landmarks
        .filter(l => l.firstUnlockedAt && l.weight >= 5)
        .map(l => l.tech_key)
    )
    data.landmarks.forEach(l => {
      if (l.firstUnlockedAt && l.weight >= 5 && !wasLit.has(l.tech_key)) {
        newlyLit.push(l.tech_key)
      }
    })
    const prevStages = new Map(prev.current.territories.map(t => [t.type, t.stage]))
    data.territories.forEach(t => {
      const prevStage = prevStages.get(t.type) ?? 1
      if (t.stage > prevStage) stagedUp.push(t.type)
    })
  }

  // Update ref for next render (in useEffect to avoid stale-on-mount issues)
  // ... (or do this lazily; see existing useRealtimeMapData merge logic for the pattern)
  prev.current = data

  return { newlyLit, stagedUp }
}
```

Wire `SparkSequence` + `StageUpRipple` in Scene:

```tsx
const { newlyLit, stagedUp } = useDataDiff(data)
// ...
<SparkSequence newlyLitTechKeys={newlyLit} />
<StageUpRipple stagedUpClusters={stagedUp} viewport={viewport} />
```

### 6. Wire FirstEverCinematic + RevealSequence at the parent level

These are not part of Scene (they orchestrate at app-level, fire once). Keep the existing trigger pattern from `_map-container.tsx`:

```tsx
// _map-container.tsx
const [showCinematic, setShowCinematic] = useState(false)
const [showReveal, setShowReveal] = useState(false)

// existing first_star_cinematic_pending check → setShowCinematic(true)
// existing reveal check → setShowReveal(true)

return (
  <>
    <Constellation data={data} renderer={renderer} onClusterClick={...} ... />
    {showCinematic && (
      <FirstEverCinematic
        firstStarTechKeys={...}
        onComplete={() => setShowCinematic(false) /* + server action to clear flag */}
      />
    )}
    {showReveal && (
      <RevealSequence
        totalCommits={...}
        totalRepos={...}
        litClusters={...}
        onComplete={() => setShowReveal(false)}
      />
    )}
  </>
)
```

These DOM components also access `useConstellationState` for the `setCinematic` action. For that to work, they must be rendered INSIDE the Constellation context. Either:

- (a) Move the `<ConstellationContext.Provider>` from inside Scene to wrap the whole `<Constellation>` and its sibling cinematics in `_map-container.tsx`. Cleaner.
- (b) Lift cinematic state to the parent and pass it via prop.

Option (a) is cleaner — the Context provider is hoisted to the parent of `<Constellation>` and `<FirstEverCinematic>`. Scene reads the same Context.

### 7. Server flag clearing

When `FirstEverCinematic.onComplete` fires, call a Server Action that sets `users.first_star_cinematic_pending = false, first_star_cinematic_seen = true`. The existing `features/sync/cinematic-detection.ts` is detection; create or extend a Server Action (e.g. `features/sync/cinematic-acknowledge.ts`) that performs the clear.

The Server Action signature:

```ts
'use server'
export async function acknowledgeFirstEverCinematic(): Promise<void>
```

Wire it as the `onComplete` callback.

### 8. Visual checkpoint

Capture two screenshots:

- `tasks/2-stellarium-redesign/visual-checkpoints/phase9-spark.png` — `/dev/map?layers=all&cinematic=spark&tech=react` (mock setup)
- `tasks/2-stellarium-redesign/visual-checkpoints/phase9-stage-up.png` — `/dev/map?layers=all&cinematic=stage-up&cluster=backend_fortress`

Add query-param handling in `/dev/map` if needed for these test fixtures.

## Acceptance Criteria

```bash
# (1) Cinematic files have real bodies
test "$(wc -l < app/_components/Constellation/cinematics/SparkSequence.tsx)" -gt 40
test "$(wc -l < app/_components/Constellation/cinematics/StageUpRipple.tsx)" -gt 40
test "$(wc -l < app/_components/Constellation/cinematics/FirstEverCinematic.tsx)" -gt 30
test "$(wc -l < app/_components/Constellation/cinematics/RevealSequence.tsx)" -gt 20

# (2) Diff hook exists
test -f app/_components/Constellation/hooks/useDataDiff.ts

# (3) Scene wires Spark + Ripple
grep -q "SparkSequence" app/_components/Constellation/Scene.tsx
grep -q "StageUpRipple" app/_components/Constellation/Scene.tsx

# (4) Reduced motion handled
grep -q "reducedMotion" app/_components/Constellation/cinematics/SparkSequence.tsx
grep -q "reducedMotion" app/_components/Constellation/cinematics/StageUpRipple.tsx
grep -q "reducedMotion" app/_components/Constellation/cinematics/FirstEverCinematic.tsx
grep -q "reducedMotion" app/_components/Constellation/cinematics/RevealSequence.tsx

# (5) FirstEverCinematic placeholder replaced
# (the file at SpecialMoments/FirstEverStarCinematic.tsx should now either re-export or be removed)
! grep -q "return null" app/_components/SpecialMoments/FirstEverStarCinematic.tsx || \
  grep -q "FirstEverCinematic" app/_components/SpecialMoments/FirstEverStarCinematic.tsx

# (6) Server action exists to clear the cinematic flag
grep -rl "first_star_cinematic_seen" features/sync/ lib/db/queries/

# (7) Build passes
npm run build

# (8) Visual checkpoints captured
test -f tasks/2-stellarium-redesign/visual-checkpoints/phase9-spark.png
test -f tasks/2-stellarium-redesign/visual-checkpoints/phase9-stage-up.png

# (9) Console errors = 0
```

## How to verify AC

Run AC commands. All nine must pass. Set phase 9 status to `"completed"`.

## Notes

- **Cinematic orchestration is React; visuals are R3F.** Don't try to put 8-second timers inside the WebGL render loop — `setTimeout` in React is the right tool for cinematic sequencing.
- **Idempotency.** SparkSequence diff against prev should be robust to React's double-effect in dev mode (Strict Mode). Use `useRef` to track which tech_keys have already fired a spark this session.
- **Stage-up stagger.** 0.3s between clusters when multiple stage up in the same sync. Don't fire all ripples simultaneously.
- **First-ever cinematic cannot be skipped.** Do NOT add a "skip" button or click-to-dismiss. ADR-38 / screens.md §I.2 are firm on this.
- **Reveal sequence has a 12s minimum.** If real sync completes faster, hold the cinematic for 12s. If sync takes longer than 30s, batch fade-in remaining stars over 0.5s and end the cinematic.
- **Server flag clearing is one-shot.** Make `acknowledgeFirstEverCinematic` idempotent — calling it twice doesn't cause an error.
- **Existing `_map-container.tsx` `showCinematic` flow.** Preserve the existing trigger logic (the `useEffect` that checks `firstStarCinematicPending && !firstStarCinematicSeen`). Just point it at the new cinematic component.
- **DOM strip copy.** Both FirstEverCinematic and RevealSequence render DOM strips OUTSIDE the WebGL canvas. They sit absolute-positioned at the bottom of the viewport. Do NOT try to render this text in WebGL — use HTML/CSS for crisp typography.
