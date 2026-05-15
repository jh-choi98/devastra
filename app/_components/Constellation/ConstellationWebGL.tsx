'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from './Skeleton'
import { useWebGLDetect } from './use-webgl-detect'
import { A11yOverlay } from './overlay/A11yOverlay'
import { TooltipHost } from './overlay/TooltipHost'
import { ConstellationContext } from './state'
import { useReducedMotion } from './hooks/useReducedMotion'
import type { ConstellationProps } from './types'
import type { TerritoryType } from '@/features/territories/registry'
import type { CinematicMode } from './state'

const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => null,
})

function WebGLUnsupportedBanner() {
  return (
    <div
      role="status"
      className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-slate-800/90 px-4 py-2 text-sm text-slate-300"
    >
      Your browser doesn&apos;t support advanced graphics; using simplified view.
    </div>
  )
}

export function ConstellationWebGL(props: Omit<ConstellationProps, 'renderer'>) {
  const webglOK = useWebGLDetect()
  const viewport = props.data.viewport ?? 'desktop'
  const reducedMotion = useReducedMotion()

  const [hovered, setHovered] = useState<TerritoryType | null>(null)
  const [cinematic, setCinematic] = useState<CinematicMode>('idle')

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
          <>
            <Scene {...props} />
            <A11yOverlay
              data={props.data}
              viewport={viewport}
              onClusterClick={props.onClusterClick}
              onStarClick={props.onStarClick}
            />
            <TooltipHost data={props.data} />
          </>
        ) : (
          <WebGLUnsupportedBanner />
        )}
      </div>
    </ConstellationContext.Provider>
  )
}
