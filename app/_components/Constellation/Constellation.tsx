'use client'

import dynamic from 'next/dynamic'
import { BrightnessScale } from './BrightnessScale'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { Skeleton } from './Skeleton'
import type { ConstellationProps } from './types'

export type { ConstellationData } from './types'
export type { ConstellationProps }

type RendererProps = Omit<ConstellationProps, 'renderer'>

const ConstellationSVG = dynamic<RendererProps>(
  () => import('./ConstellationSVG').then((mod) => mod.ConstellationSVG),
  { ssr: false, loading: () => <Skeleton /> },
)

const ConstellationWebGL = dynamic<RendererProps>(
  () => import('./ConstellationWebGL').then((mod) => mod.ConstellationWebGL),
  { ssr: false, loading: () => <Skeleton /> },
)

export function Constellation({
  renderer = 'webgl',
  showBrightnessScale = true,
  ...props
}: ConstellationProps) {
  const fallback = <Skeleton viewport={props.data.viewport} />

  return (
    <div className="relative h-full w-full">
      <SceneErrorBoundary key={renderer} fallback={fallback}>
        {renderer === 'svg' ? <ConstellationSVG {...props} /> : <ConstellationWebGL {...props} />}
      </SceneErrorBoundary>
      {showBrightnessScale && <BrightnessScale data={props.data} />}
    </div>
  )
}
