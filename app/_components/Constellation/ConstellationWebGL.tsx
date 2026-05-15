'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from './Skeleton'
import { useWebGLDetect } from './use-webgl-detect'
import type { ConstellationProps } from './types'

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

  return (
    <div className="relative w-full h-full">
      <Skeleton viewport={viewport} />
      {webglOK ? <Scene {...props} /> : <WebGLUnsupportedBanner />}
    </div>
  )
}
