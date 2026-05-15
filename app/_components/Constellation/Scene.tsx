'use client'

import * as Sentry from '@sentry/nextjs'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { SkyBackground } from './layers/SkyBackground'
import { FieldStars } from './layers/FieldStars'
import { MilkyWay } from './layers/MilkyWay'
import { TerritoryBoundaries } from './layers/TerritoryBoundaries'
import { Connections } from './layers/Connections'
import { TechStars } from './layers/TechStars'
import { ClusterAura } from './layers/ClusterAura'
import { Labels } from './layers/Labels'
import { PostStack } from './post/BloomLayer'
import { ParallaxRig } from './camera/ParallaxRig'
import { SparkSequence } from './cinematics/SparkSequence'
import { StageUpRipple } from './cinematics/StageUpRipple'
import { useDataDiff } from './hooks/useDataDiff'
import type { ConstellationProps, LayerOverrides } from './types'

interface SceneProps extends Omit<ConstellationProps, 'renderer'> {}

export default function Scene({ data, layerOverrides, onMount }: SceneProps) {
  const viewport = data.viewport ?? 'desktop'
  const isMobile = viewport === 'mobile'

  const show = (key: keyof LayerOverrides) => layerOverrides?.[key] ?? true

  const { newlyLit, stagedUp } = useDataDiff(data)

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
        onMount?.()

        const canvas = gl.domElement
        const handleLost = (e: Event) => {
          e.preventDefault()
          Sentry.captureMessage('constellation.webgl.context_lost', {
            level: 'warning',
            tags: { feature: 'constellation', event_name: 'constellation.webgl.context_lost' },
          })
        }
        canvas.addEventListener('webglcontextlost', handleLost, false)
        // R3F re-creates resources on restore; uniforms reset by useFrame
        canvas.addEventListener('webglcontextrestored', () => {}, false)
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
        {show('labels') && <Labels data={data} viewport={viewport} />}
        <SparkSequence newlyLitLandmarks={newlyLit} viewport={viewport} />
        <StageUpRipple stagedUpClusters={stagedUp} viewport={viewport} />
      </Suspense>
      <ParallaxRig />
      <PostStack isMobile={isMobile} />
    </Canvas>
  )
}
