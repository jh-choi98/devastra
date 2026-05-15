'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from './Skeleton'
import { useWebGLDetect } from './use-webgl-detect'
import { useConstellationTelemetry } from './use-constellation-telemetry'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { A11yOverlay } from './overlay/A11yOverlay'
import { TooltipHost } from './overlay/TooltipHost'
import { ConstellationContext } from './state'
import { useReducedMotion } from './hooks/useReducedMotion'
import type { ConstellationProps } from './types'
import type { TerritoryType } from '@/features/territories/registry'
import type { CinematicMode } from './state'

const Scene = dynamic(
  () => import(/* webpackChunkName: "constellation-scene" */ './Scene'),
  { ssr: false, loading: () => null },
)

function WebGLUnsupportedBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-x-0 top-4 mx-auto max-w-md text-center bg-slate-900/85 text-slate-200 text-xs px-4 py-2 rounded border border-slate-700"
    >
      Your browser doesn&apos;t support advanced graphics; using simplified view.
      The constellation map and labels above are fully interactive.
    </div>
  )
}

function WebGLCrashBanner() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="absolute inset-x-0 bottom-4 mx-auto max-w-md bg-slate-900/90 border border-amber-500/40 text-slate-100 text-sm px-4 py-3 rounded"
    >
      Constellation graphics hit an error. The map is still visible above.
      <button onClick={() => window.location.reload()} className="ml-3 underline">
        Retry
      </button>
    </div>
  )
}

export function ConstellationWebGL(props: Omit<ConstellationProps, 'renderer'>) {
  const webglOK = useWebGLDetect()
  const viewport = props.data.viewport ?? 'desktop'
  const reducedMotion = useReducedMotion()

  const [hovered, setHovered] = useState<TerritoryType | null>(null)
  const [cinematic, setCinematic] = useState<CinematicMode>('idle')
  const [sceneMounted, setSceneMounted] = useState(false)

  useConstellationTelemetry({ webglSupported: webglOK, sceneMounted })

  const ctxValue = useMemo(
    () => ({
      selected: props.selectedCluster ?? null,
      hovered,
      cinematic,
      reducedMotion,
      setHovered,
      startCinematic: setCinematic,
    }),
    [props.selectedCluster, hovered, cinematic, reducedMotion],
  )

  return (
    <ConstellationContext.Provider value={ctxValue}>
      <div className="relative w-full h-full">
        <Skeleton viewport={viewport} />
        {webglOK ? (
          <SceneErrorBoundary fallback={<WebGLCrashBanner />}>
            <Scene {...props} onMount={() => setSceneMounted(true)} />
            <A11yOverlay
              data={props.data}
              viewport={viewport}
              onClusterClick={props.onClusterClick}
              onStarClick={props.onStarClick}
            />
            <TooltipHost data={props.data} />
          </SceneErrorBoundary>
        ) : (
          <WebGLUnsupportedBanner />
        )}
      </div>
    </ConstellationContext.Provider>
  )
}
