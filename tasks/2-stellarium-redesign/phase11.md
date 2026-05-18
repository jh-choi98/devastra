# Phase 11: Observability, Error Boundary, WebGL Detect, Fallback Banner

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-49 (Sentry baseline), ADR-62 (Sentry events + Error Boundary)
- `/docs/code-architecture.md` — Observability section (constellation.webgl.* events)
- `/docs/security-checklist.md` W3, W7
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- Phase 3: `use-webgl-detect.ts` exists with basic feature detect
- `WebGLUnsupportedBanner` placeholder exists in `ConstellationWebGL.tsx`
- Phases 4–10 produced a working WebGL renderer

Read the current code:

- `sentry.client.config.ts` — current Sentry config
- `lib/sentry-scrub.ts` — `beforeSend` scrubbing (ADR-49)

## Work

This phase adds production-grade error handling and observability for the WebGL renderer.

### 1. Implement React Error Boundary around Scene

Create `app/_components/Constellation/SceneErrorBoundary.tsx`:

```tsx
'use client'
import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  fallback: ReactNode
}
interface State {
  hasError: boolean
}

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    Sentry.captureException(error, {
      tags: {
        feature: 'constellation',
        event_name: 'constellation.webgl.scene_crash',
      },
      contexts: {
        react: { componentStack: info.componentStack },
      },
    })
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
```

### 2. Wrap Scene in `ConstellationWebGL.tsx`

```tsx
import { SceneErrorBoundary } from './SceneErrorBoundary'

return (
  <div className="relative w-full h-full">
    <Skeleton {...props} />
    {webglOK ? (
      <SceneErrorBoundary fallback={<WebGLCrashBanner />}>
        <Scene {...props} />
        <A11yOverlay ... />
        <TooltipHost ... />
      </SceneErrorBoundary>
    ) : (
      <WebGLUnsupportedBanner />
    )}
  </div>
)
```

`WebGLCrashBanner` is a new small component:

```tsx
function WebGLCrashBanner() {
  return (
    <div role="alert" className="absolute inset-x-0 bottom-4 mx-auto max-w-md bg-slate-900/90 border border-amber-500/40 text-slate-100 text-sm px-4 py-3 rounded">
      Constellation graphics hit an error. The map is still visible above.
      <button onClick={() => window.location.reload()} className="ml-3 underline">Retry</button>
    </div>
  )
}
```

### 3. Sentry events instrumentation

Create `app/_components/Constellation/use-constellation-telemetry.ts`:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import * as Sentry from '@sentry/nextjs'

export function useConstellationTelemetry(opts: {
  webglSupported: boolean
  sceneMounted: boolean
}) {
  const reported = useRef({ success: false, failure: false })

  useEffect(() => {
    if (!opts.webglSupported && !reported.current.failure) {
      Sentry.captureMessage('constellation.webgl.init_failure', {
        level: 'info',
        tags: {
          feature: 'constellation',
          event_name: 'constellation.webgl.init_failure',
          reason: 'unsupported',
        },
      })
      reported.current.failure = true
    }
    if (opts.webglSupported && opts.sceneMounted && !reported.current.success) {
      Sentry.captureMessage('constellation.webgl.init_success', {
        level: 'info',
        tags: {
          feature: 'constellation',
          event_name: 'constellation.webgl.init_success',
        },
      })
      reported.current.success = true
    }
  }, [opts.webglSupported, opts.sceneMounted])
}
```

### 4. Wire context-lost recovery in `Scene.tsx`

```tsx
import * as Sentry from '@sentry/nextjs'

return (
  <Canvas
    ...
    onCreated={({ gl }) => {
      // existing fade-in code

      const canvas = gl.domElement
      const handleLost = (e: Event) => {
        e.preventDefault()
        Sentry.captureMessage('constellation.webgl.context_lost', {
          level: 'warning',
          tags: { feature: 'constellation', event_name: 'constellation.webgl.context_lost' },
        })
      }
      const handleRestored = () => {
        // R3F internally re-creates resources; ensure no app-level uniforms
        // are left in a stale state. Most common pattern: trigger a forceUpdate
        // via state if needed. For our scene the uniforms are reset by useFrame.
      }
      canvas.addEventListener('webglcontextlost', handleLost, false)
      canvas.addEventListener('webglcontextrestored', handleRestored, false)
    }}
  >
```

### 5. Refine `use-webgl-detect.ts`

The Phase 3 placeholder defaults to `true` during SSR. Make sure the client-side check is robust:

```tsx
'use client'
import { useEffect, useState } from 'react'

export function useWebGLDetect(): boolean {
  // null = checking (SSR / pre-mount), true/false = result
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    let ok = false
    try {
      const canvas = document.createElement('canvas')
      const gl = (canvas.getContext('webgl2') as WebGL2RenderingContext | null)
              ?? (canvas.getContext('webgl') as WebGLRenderingContext | null)
              ?? (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
      ok = Boolean(gl)
      // Optional: check for required extensions
      if (gl && 'getSupportedExtensions' in gl) {
        const exts = gl.getSupportedExtensions() ?? []
        // We don't strictly need any specific extension; UnrealBloom degrades gracefully
      }
    } catch {
      ok = false
    }
    setSupported(ok)
  }, [])

  // Optimistic: while checking (null), assume supported so we mount Scene without flash
  return supported ?? true
}
```

### 6. Bundle size CI gate

Verify `size-limit` config (added Phase 1) and run it.

```bash
npm run build
npm run size
```

Adjust the size-limit `path` globs in `package.json` based on the actual `.next/static/chunks/` output. The Scene lazy chunk should be findable via a glob like `.next/static/chunks/app/_components/Constellation/*` or via the chunk-name from the dynamic import.

If the build fails the size limit:

- (a) The limit is realistic but the implementation has bloat — inspect with `npx @next/bundle-analyzer` and trim.
- (b) The limit is too tight — adjust the `limit` field with a justification noted in `phase11-output.json`.

### 7. WebGLUnsupportedBanner polish

Use the version from Phase 3 but make sure it's accessible:

```tsx
function WebGLUnsupportedBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-x-0 top-4 mx-auto max-w-md text-center bg-slate-900/85 text-slate-200 text-xs px-4 py-2 rounded border border-slate-700"
    >
      Your browser doesn't support advanced graphics; using simplified view.
      The constellation map and labels above are fully interactive.
    </div>
  )
}
```

### 8. Browser test

Use Playwright with a launch flag that disables WebGL to verify the fallback path:

```ts
// tests/e2e/webgl-fallback.spec.ts
import { test, expect } from '@playwright/test'

test('WebGL fallback shows banner + skeleton', async ({ browser }) => {
  const context = await browser.newContext()
  // Override WebGL availability by injecting a script that nulls the contexts
  await context.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args: any[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(args[0])) return null
      return (orig as any).apply(this, args)
    }
  })
  const page = await context.newPage()
  await page.goto('http://localhost:3000/dev/map')
  await expect(page.getByRole('status').first()).toContainText("doesn't support advanced graphics")
  // Skeleton still renders
  await expect(page.locator('svg').first()).toBeVisible()
})
```

## Acceptance Criteria

```bash
# (1) SceneErrorBoundary exists
test -f app/_components/Constellation/SceneErrorBoundary.tsx
grep -q "componentDidCatch" app/_components/Constellation/SceneErrorBoundary.tsx
grep -q "constellation.webgl.scene_crash" app/_components/Constellation/SceneErrorBoundary.tsx

# (2) Telemetry hook exists
test -f app/_components/Constellation/use-constellation-telemetry.ts
grep -q "init_success" app/_components/Constellation/use-constellation-telemetry.ts
grep -q "init_failure" app/_components/Constellation/use-constellation-telemetry.ts

# (3) Scene listens for webglcontextlost
grep -q "webglcontextlost" app/_components/Constellation/Scene.tsx
grep -q "context_lost" app/_components/Constellation/Scene.tsx

# (4) ConstellationWebGL wraps Scene in error boundary
grep -q "SceneErrorBoundary" app/_components/Constellation/ConstellationWebGL.tsx

# (5) Build passes
npm run build

# (6) Bundle budget passes (size-limit)
npm run size

# (7) Fallback test passes
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npx playwright test tests/e2e/webgl-fallback.spec.ts
kill $DEV_PID || true

# (8) Sentry config not regressed
grep -q "beforeSend" sentry.client.config.ts
```

## How to verify AC

Run AC commands. All eight must pass. Set phase 11 status to `"completed"`.

## Notes

- **Sentry sampling.** The `init_success` event will fire on every page load — make sure Sentry sample rate for these messages is reasonable. Consider setting `tracesSampleRate` low (e.g. 0.01) for these informational events to avoid quota blowback. Tweak in `sentry.client.config.ts` if needed.
- **PII scrubbing.** ADR-49's `beforeSend` already scrubs auth tokens and cookies. The new events don't add any user-identifying data — only feature flags. No scrubbing changes required.
- **Error boundary scope.** The boundary wraps only `<Scene>` (the WebGL canvas). Outer DOM (Skeleton, A11yOverlay, TooltipHost) is NOT wrapped, so a render error in those still bubbles to the global Next.js error boundary at `app/error.tsx` — that's correct.
- **Context-lost is common on mobile.** When the user backgrounds the tab for a while, the browser may reclaim the WebGL context. R3F handles re-creation; our handler just logs the event for monitoring.
- **WebGL detect optimism.** We default to `true` during SSR + initial mount to avoid a flash of the fallback. The real check runs in `useEffect`, downgrading to `false` if WebGL is missing. The transient mount-then-downgrade is harmless (Scene mounts briefly, then unmounts).
- **size-limit reality check.** First Phase 11 run may fail because the actual chunk path differs from Phase 1's guess. Inspect the build output and adjust the glob. Document the final size in `phase11-output.json`.
- **Banner accessibility.** Both `WebGLUnsupportedBanner` and `WebGLCrashBanner` use `role="status"` / `role="alert"` with `aria-live` so screen readers announce them. Don't lose this on polish.
