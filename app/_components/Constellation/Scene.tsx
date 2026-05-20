'use client'

import * as Sentry from '@sentry/nextjs'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import { SkyBackground } from './layers/SkyBackground'
import { Haze } from './layers/Haze'
import { FieldStars } from './layers/FieldStars'
import { MidStars } from './layers/MidStars'
import { MilkyWay } from './layers/MilkyWay'
import { TerritoryBoundaries } from './layers/TerritoryBoundaries'
import { UnlitAnchors } from './layers/UnlitAnchors'
import { Connections } from './layers/Connections'
import { TechStars } from './layers/TechStars'
import { ClusterAura } from './layers/ClusterAura'
import { Labels } from './layers/Labels'
import { PostStack } from './post/BloomLayer'
import { ParallaxRig } from './camera/ParallaxRig'
import { SparkSequence } from './cinematics/SparkSequence'
import { StageUpRipple } from './cinematics/StageUpRipple'
import { useDataDiff } from './hooks/useDataDiff'
import type { SemanticConstellationScaleProfile } from './semantic-scale-profile'
import type { SparseConstellationView } from './sparse-mode'
import type { ConstellationProps, LayerOverrides } from './types'

interface SceneProps extends Omit<ConstellationProps, 'renderer'> {
  sparseView: SparseConstellationView
  semanticProfile: SemanticConstellationScaleProfile
  canvasSize: { width: number | null; height: number | null }
}

/**
 * Fits the orthographic camera so the [-1, 1] x [-1, 1] world space (output of
 * viewBoxToWorld) is rendered with a `xMidYMid slice` behavior: the smaller axis
 * of the viewBox aspect (10:7) fills the canvas, the larger axis overflows.
 *
 * Without this component, R3F's default orthographic camera uses canvas pixels
 * as world units (1 world unit ≈ 1 px), which compresses the entire [-1, 1]
 * scene into a 2-pixel region at the center.
 */
function CameraFit({ sparseView }: { sparseView: SparseConstellationView }) {
  const { camera, size } = useThree()
  useEffect(() => {
    if (camera.type !== 'OrthographicCamera') return
    const c = camera as THREE.OrthographicCamera
    const aspect = size.width / size.height
    const targetAspect = 1000 / 700 // viewBox aspect = 1.4286
    // `xMidYMid meet` semantics: the ENTIRE viewBox is always visible, with
    // dark-sky padding on whichever axis is over-sized. We use meet (not slice)
    // because cluster stars and labels can sit near the viewBox edges; slice
    // would crop them on widescreen / portrait viewports.
    if (aspect > targetAspect) {
      // canvas WIDER than viewBox → viewBox.height fills canvas.height,
      // horizontal world extends BEYOND [-1, 1] (dark sky on left/right).
      c.top = 1
      c.bottom = -1
      const halfW = aspect / targetAspect // > 1
      c.left = -halfW
      c.right = halfW
    } else {
      // canvas TALLER than viewBox → viewBox.width fills canvas.width,
      // vertical world extends BEYOND [-1, 1] (dark sky on top/bottom).
      c.left = -1
      c.right = 1
      const halfH = targetAspect / aspect // > 1
      c.top = halfH
      c.bottom = -halfH
    }
    c.position.x = sparseView.focusWorld.x
    c.position.y = sparseView.focusWorld.y
    c.position.z = 5
    c.zoom = sparseView.profile.cameraZoom
    c.updateProjectionMatrix()
  }, [camera, size, sparseView])
  return null
}

export default function Scene({
  data,
  layerOverrides,
  sparseView,
  semanticProfile,
  canvasSize,
  onMount,
}: SceneProps) {
  const viewport = data.viewport ?? 'desktop'
  const isMobile = viewport === 'mobile'
  const { profile } = sparseView

  const show = (key: keyof LayerOverrides) =>
    layerOverrides?.[key] ?? (key === 'postprocess' ? false : true)

  const { newlyLit, stagedUp } = useDataDiff(data)

  // Stable opacity fade-in using React state. Avoids the previous pattern of
  // mutating gl.domElement.style.opacity directly, which got overwritten on
  // every parent re-render (React reconciliation reset the inline style).
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <Canvas
      className="absolute inset-0"
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 2}
      gl={{ antialias: true, alpha: true }}
      orthographic
      camera={{ position: [0, 0, 5], zoom: 1, near: 0.1, far: 100 }}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 400ms ease-out' }}
      onCreated={({ gl }) => {
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
        canvas.addEventListener('webglcontextrestored', () => {}, false)
      }}
    >
      <CameraFit sparseView={sparseView} />
      <Suspense fallback={null}>
        {show('sky') && <SkyBackground />}
        {/* Milky Way disabled — user preference (pure dark sky, no nebulosity wash). */}
        {false && show('milkyway') && <MilkyWay />}
        {/* Faint cool haze — depth cue between sky and stars. */}
        {show('haze') && <Haze />}
        {show('fieldstars') && (
          <FieldStars viewport={viewport} opacity={profile.fieldStarOpacity} />
        )}
        {/* Mid-depth tier — slightly bigger stars with stronger parallax. */}
        {show('midstars') && <MidStars viewport={viewport} opacity={profile.midStarOpacity} />}
        {show('boundaries') && <TerritoryBoundaries viewport={viewport} />}
        {show('unlitanchors') && (
          <UnlitAnchors data={data} viewport={viewport} opacity={profile.unlitAnchorOpacity} />
        )}
        {show('connections') && <Connections data={data} viewport={viewport} />}
        {show('techstars') && (
          <TechStars
            data={data}
            viewport={viewport}
            sparseProfile={profile}
            semanticProfile={semanticProfile}
          />
        )}
        {show('aura') && <ClusterAura viewport={viewport} />}
        {show('labels') && (
          <Labels
            data={data}
            viewport={viewport}
            semanticProfile={semanticProfile}
            canvasSize={canvasSize}
          />
        )}
        <SparkSequence newlyLitLandmarks={newlyLit} viewport={viewport} />
        <StageUpRipple stagedUpClusters={stagedUp} viewport={viewport} />
      </Suspense>
      {/* ParallaxRig disabled — user preference (canvas should stay fixed, not
          follow the mouse). Component kept around for potential reuse. */}
      {/* <ParallaxRig /> */}
      <PostStack isMobile={isMobile} enabled={show('postprocess')} />
    </Canvas>
  )
}
