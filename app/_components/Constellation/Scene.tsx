'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense, useState, useMemo } from 'react'
import { SkyBackground } from './layers/SkyBackground'
import { FieldStars } from './layers/FieldStars'
import { MilkyWay } from './layers/MilkyWay'
import { TerritoryBoundaries } from './layers/TerritoryBoundaries'
import { Connections } from './layers/Connections'
import { TechStars } from './layers/TechStars'
import { ClusterAura } from './layers/ClusterAura'
import { PostStack } from './post/BloomLayer'
import { ParallaxRig } from './camera/ParallaxRig'
import { ConstellationContext } from './state'
import { useReducedMotion } from './hooks/useReducedMotion'
import type { ConstellationProps, LayerOverrides } from './types'
import type { TerritoryType } from '@/features/territories/registry'
import type { CinematicMode } from './state'

interface SceneProps extends Omit<ConstellationProps, 'renderer'> {}

export default function Scene({ data, layerOverrides, selectedCluster }: SceneProps) {
  const reducedMotion = useReducedMotion()
  const viewport = data.viewport ?? 'desktop'
  const isMobile = viewport === 'mobile'

  const [hovered, setHovered] = useState<TerritoryType | null>(null)
  const [cinematic, setCinematic] = useState<CinematicMode>('idle')

  const show = (key: keyof LayerOverrides) => layerOverrides?.[key] ?? true

  const ctxValue = useMemo(() => ({
    selected: selectedCluster ?? null,
    hovered,
    cinematic,
    reducedMotion,
    setHovered,
    startCinematic: setCinematic,
  }), [selectedCluster, hovered, cinematic, reducedMotion])

  return (
    <ConstellationContext.Provider value={ctxValue}>
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
        <Suspense fallback={null}>
          {show('sky') && <SkyBackground />}
          {show('milkyway') && <MilkyWay />}
          {show('fieldstars') && <FieldStars viewport={viewport} />}
          {show('boundaries') && <TerritoryBoundaries viewport={viewport} />}
          {show('connections') && <Connections data={data} viewport={viewport} />}
          {show('techstars') && <TechStars data={data} viewport={viewport} />}
          {show('aura') && <ClusterAura viewport={viewport} />}
        </Suspense>
        <ParallaxRig />
        <PostStack isMobile={isMobile} />
      </Canvas>
    </ConstellationContext.Provider>
  )
}
