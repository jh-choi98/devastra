'use client'

import dynamic from 'next/dynamic'
import { BrightnessScale } from './BrightnessScale'
import { Skeleton } from './Skeleton'
import type { ConstellationProps } from './types'

export type { ConstellationData } from './types'
export type { ConstellationProps }

type RendererProps = Omit<ConstellationProps, 'renderer'>

const ConstellationSVG = dynamic<RendererProps>(
  () =>
    import(/* webpackChunkName: "constellation-svg" */ './ConstellationSVG').then(
      (mod) => mod.ConstellationSVG,
    ),
  { ssr: false, loading: () => <Skeleton /> },
)

const ConstellationWebGL = dynamic<RendererProps>(
  () =>
    import(/* webpackChunkName: "constellation-webgl" */ './ConstellationWebGL').then(
      (mod) => mod.ConstellationWebGL,
    ),
  { ssr: false, loading: () => <Skeleton /> },
)

export function Constellation({
  renderer = 'webgl',
  showBrightnessScale = true,
  ...props
}: ConstellationProps) {
  return (
    <div className="relative h-full w-full">
      {renderer === 'svg' ? <ConstellationSVG {...props} /> : <ConstellationWebGL {...props} />}
      {showBrightnessScale && <BrightnessScale data={props.data} />}
    </div>
  )
}
