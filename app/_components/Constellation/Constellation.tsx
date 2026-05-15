'use client'

import { ConstellationSVG } from './ConstellationSVG'
import { ConstellationWebGL } from './ConstellationWebGL'
import type { ConstellationProps } from './types'

export type { ConstellationData } from './types'
export type { ConstellationProps }

export function Constellation({ renderer = 'webgl', ...props }: ConstellationProps) {
  if (renderer === 'svg') return <ConstellationSVG {...props} />
  return <ConstellationWebGL {...props} />
}
