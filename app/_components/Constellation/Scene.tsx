'use client'

import { Canvas } from '@react-three/fiber'
import type { ConstellationProps } from './types'

export default function Scene(_props: Omit<ConstellationProps, 'renderer'>) {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 2}
      gl={{ antialias: true, alpha: true }}
      style={{ opacity: 0, transition: 'opacity 400ms ease-out' }}
      onCreated={({ gl }) => {
        // Phase 4+: layers mount here. Fade in once R3F initializes.
        requestAnimationFrame(() => {
          const wrapper = gl.domElement.parentElement
          if (wrapper?.style) wrapper.style.opacity = '1'
        })
      }}
    >
      {/* Phase 4+: <SkyBackground />, <MilkyWay />, <FieldStars />, etc. */}
    </Canvas>
  )
}
