'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { SkyBackground } from './layers/SkyBackground'
import { FieldStars } from './layers/FieldStars'
import { ConstellationContext } from './state'
import { useReducedMotion } from './hooks/useReducedMotion'
import type { ConstellationProps, LayerOverrides } from './types'
import type { TerritoryType } from '@/features/territories/registry'
import type { CinematicMode } from './state'

interface SceneProps extends Omit<ConstellationProps, 'renderer'> {}

export default function Scene({ data, layerOverrides }: SceneProps) {
  const reducedMotion = useReducedMotion()
  const viewport = data.viewport ?? 'desktop'

  const [hovered, setHovered] = useState<TerritoryType | null>(null)
  const [cinematic, setCinematic] = useState<CinematicMode>('idle')

  const show = (key: keyof LayerOverrides) => layerOverrides?.[key] ?? true

  return (
    <Canvas
      className="absolute inset-0"
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 2}
      gl={{ antialias: true, alpha: true }}
      orthographic
      camera={{ position: [0, 0, 5], zoom: 1, near: 0.1, far: 100 }}
      style={{ opacity: 0, transition: 'opacity 400ms ease-out' }}
      onCreated={({ gl }) => {
        requestAnimationFrame(() => {
          gl.domElement.style.opacity = '1'
        })
      }}
    >
      <ConstellationContext.Provider
        value={{
          selected: null,
          hovered,
          cinematic,
          reducedMotion,
          setHovered,
          startCinematic: setCinematic,
        }}
      >
        <Suspense fallback={null}>
          {show('sky') && <SkyBackground />}
          {show('fieldstars') && <FieldStars viewport={viewport} />}
          {/* Phase 5+: <MilkyWay />, <TerritoryBoundaries />, ... */}
        </Suspense>
      </ConstellationContext.Provider>
    </Canvas>
  )
}
