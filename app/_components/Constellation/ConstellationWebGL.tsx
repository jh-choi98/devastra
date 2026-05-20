'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useWebGLDetect } from './use-webgl-detect'
import { useConstellationTelemetry } from './use-constellation-telemetry'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { A11yOverlay } from './overlay/A11yOverlay'
import { TooltipHost } from './overlay/TooltipHost'
import { ConstellationContext } from './state'
import { sparseViewForData } from './sparse-mode'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useResponsiveConstellationEnvironment } from './use-responsive-constellation-environment'
import { Skeleton } from './Skeleton'
import type { ConstellationProps } from './types'
import type { SemanticConstellationScaleProfile } from './semantic-scale-profile'
import type { TerritoryType } from '@/features/territories/registry'
import type { CinematicMode } from './state'

function StaticFallbackView(props: {
  data: ConstellationProps['data']
  viewport: 'desktop' | 'mobile' | 'og'
  semanticProfile: SemanticConstellationScaleProfile
  canvasSize: { width: number | null; height: number | null }
  svgTransform?: string
  onClusterClick?: ConstellationProps['onClusterClick']
  onStarClick?: ConstellationProps['onStarClick']
}) {
  return (
    <>
      <Skeleton viewport={props.viewport} />
      <A11yOverlay
        data={props.data}
        viewport={props.viewport}
        semanticProfile={props.semanticProfile}
        canvasSize={props.canvasSize}
        svgTransform={props.svgTransform}
        onClusterClick={props.onClusterClick}
        onStarClick={props.onStarClick}
      />
    </>
  )
}

const Scene = dynamic(() => import(/* webpackChunkName: "constellation-scene" */ './Scene'), {
  ssr: false,
  loading: () => null,
})

function WebGLUnsupportedBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-x-0 top-4 mx-auto max-w-md rounded border border-slate-700 bg-slate-900/85 px-4 py-2 text-center text-xs text-slate-200"
    >
      Your browser doesn&apos;t support advanced graphics; using simplified view. The constellation
      map and labels above are fully interactive.
    </div>
  )
}

function WebGLCrashBanner() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="absolute inset-x-0 bottom-4 mx-auto max-w-md rounded border border-amber-500/40 bg-slate-900/90 px-4 py-3 text-sm text-slate-100"
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
  const { containerRef, viewport, semanticProfile, size } = useResponsiveConstellationEnvironment(
    props.data.viewport,
  )
  const responsiveData = useMemo(
    () => (props.data.viewport === viewport ? props.data : { ...props.data, viewport }),
    [props.data, viewport],
  )
  const reducedMotion = useReducedMotion()

  const [hovered, setHovered] = useState<TerritoryType | null>(null)
  const [hoveredTechKey, setHoveredTechKey] = useState<string | null>(null)
  const [cinematic, setCinematic] = useState<CinematicMode>('idle')
  const [sceneMounted, setSceneMounted] = useState(false)

  useConstellationTelemetry({ webglSupported: webglOK, sceneMounted })
  const sparseView = useMemo(
    () => sparseViewForData(responsiveData, viewport),
    [responsiveData, viewport],
  )

  const ctxValue = useMemo(
    () => ({
      selected: props.selectedCluster ?? null,
      hovered,
      hoveredTechKey,
      cinematic,
      reducedMotion,
      setHovered,
      setHoveredTechKey,
      startCinematic: setCinematic,
    }),
    [props.selectedCluster, hovered, hoveredTechKey, cinematic, reducedMotion],
  )

  return (
    <ConstellationContext.Provider value={ctxValue}>
      <div ref={containerRef} className="relative h-full w-full bg-[#010102]">
        {webglOK ? (
          <SceneErrorBoundary
            fallback={
              <>
                <StaticFallbackView
                  data={responsiveData}
                  viewport={viewport}
                  semanticProfile={semanticProfile}
                  canvasSize={size}
                  svgTransform={sparseView.svgTransform}
                  onClusterClick={props.onClusterClick}
                  onStarClick={props.onStarClick}
                />
                <WebGLCrashBanner />
              </>
            }
          >
            <Scene
              {...props}
              data={responsiveData}
              sparseView={sparseView}
              semanticProfile={semanticProfile}
              canvasSize={size}
              onMount={() => setSceneMounted(true)}
            />
            <A11yOverlay
              data={responsiveData}
              viewport={viewport}
              semanticProfile={semanticProfile}
              canvasSize={size}
              svgTransform={sparseView.svgTransform}
              onClusterClick={props.onClusterClick}
              onStarClick={props.onStarClick}
            />
            <TooltipHost data={responsiveData} />
          </SceneErrorBoundary>
        ) : (
          <>
            <StaticFallbackView
              data={responsiveData}
              viewport={viewport}
              semanticProfile={semanticProfile}
              canvasSize={size}
              svgTransform={sparseView.svgTransform}
              onClusterClick={props.onClusterClick}
              onStarClick={props.onStarClick}
            />
            <WebGLUnsupportedBanner />
          </>
        )}
      </div>
    </ConstellationContext.Provider>
  )
}
