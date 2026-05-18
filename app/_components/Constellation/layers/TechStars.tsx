'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AIRY_DISK_VERT } from '../shaders/airy-disk.vert'
import { AIRY_DISK_FRAG } from '../shaders/airy-disk.frag'
import { DIFFRACTION_SPIKE_VERT } from '../shaders/diffraction-spike.vert'
import { DIFFRACTION_SPIKE_FRAG } from '../shaders/diffraction-spike.frag'
import { spectralColorFor, spectralHex } from '@/features/constellation/render/palette'
import { magnitudeFor, topQuintileThreshold } from '@/features/constellation/render/magnitude'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { resolveStarViewBoxPosition } from '@/app/_components/Constellation/star-positions'
import { useConstellationState } from '../state'
import type { SparseConstellationProfile } from '@/features/constellation/render/sparse-profile'
import type { ConstellationData } from '../types'

interface TechStarsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
  sparseProfile?: SparseConstellationProfile
}

const REVEAL_DURATION_SECONDS = 1.2
const REVEAL_STAGGER_SECONDS = 0.08

function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - clamped, 3)
}

// Deterministic per-tech_key z-depth in [-0.5, 0.5] — used to give every lit
// tech star a subtly different "distance" so the constellation reads as having
// volume rather than living on a single glass plane. Effect is bounded so
// weight remains the dominant magnitude driver.
function zFor(tech_key: string): number {
  let h = 0x9e3779b9
  for (let i = 0; i < tech_key.length; i++) {
    h ^= tech_key.charCodeAt(i)
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
  }
  // Normalize to [-0.5, 0.5]
  return (h >>> 0) / 4294967296 - 0.5
}

export function TechStars({ data, viewport = 'desktop', sparseProfile }: TechStarsProps) {
  const { reducedMotion } = useConstellationState()
  const initializedRef = useRef(false)
  const revealByTechKey = useRef(new Map<string, number>())
  const coreGeomRef = useRef<THREE.BufferGeometry | null>(null)
  const spikeGeomRef = useRef<THREE.BufferGeometry | null>(null)

  const stars = useMemo(() => {
    const lit = data.landmarks.filter((l) => l.firstUnlockedAt !== null && l.weight >= 5)
    const threshold = topQuintileThreshold(lit.map((l) => l.weight))
    return lit.map((landmark, index) => {
      if (!revealByTechKey.current.has(landmark.tech_key)) {
        revealByTechKey.current.set(
          landmark.tech_key,
          initializedRef.current && !reducedMotion ? -index * REVEAL_STAGGER_SECONDS : 1,
        )
      }
      const vbPos = resolveStarViewBoxPosition(landmark.tech_key, landmark.territory, viewport)
      const worldPos = viewBoxToWorld(vbPos)
      const m = magnitudeFor(landmark.weight, threshold)
      const spectral = spectralColorFor(landmark.tech_key)
      const hex = spectralHex(spectral)
      const c = new THREE.Color(hex)
      const sizeScale = sparseProfile?.techStarScale ?? 1
      const intensityScale = sparseProfile?.techStarIntensity ?? 1
      const spikeScale = sparseProfile?.spikeScale ?? 1
      return {
        techKey: landmark.tech_key,
        worldPos,
        color: c,
        size: m.coreRadius * 2 * sizeScale,
        intensity: m.intensity * intensityScale,
        showSpikes: m.showSpikes,
        spikeLength: m.spikeLength * spikeScale,
        z: zFor(landmark.tech_key),
      }
    })
  }, [data.landmarks, reducedMotion, sparseProfile, viewport])

  useEffect(() => {
    initializedRef.current = true
    const currentKeys = new Set(stars.map((star) => star.techKey))
    for (const key of Array.from(revealByTechKey.current.keys())) {
      if (!currentKeys.has(key)) revealByTechKey.current.delete(key)
    }
  }, [stars])

  const coreGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(stars.length * 3)
    const sizes = new Float32Array(stars.length)
    const colors = new Float32Array(stars.length * 3)
    const intensities = new Float32Array(stars.length)
    const zs = new Float32Array(stars.length)
    const reveals = new Float32Array(stars.length)
    stars.forEach((s, i) => {
      positions[i * 3 + 0] = s.worldPos.x
      positions[i * 3 + 1] = s.worldPos.y
      positions[i * 3 + 2] = s.worldPos.z
      sizes[i] = s.size
      colors[i * 3 + 0] = s.color.r
      colors[i * 3 + 1] = s.color.g
      colors[i * 3 + 2] = s.color.b
      intensities[i] = s.intensity
      zs[i] = s.z
      reveals[i] = easeOutCubic(revealByTechKey.current.get(s.techKey) ?? 1)
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
    g.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1))
    g.setAttribute('aZ', new THREE.Float32BufferAttribute(zs, 1))
    g.setAttribute('aReveal', new THREE.Float32BufferAttribute(reveals, 1))
    coreGeomRef.current = g
    return g
  }, [stars])

  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: AIRY_DISK_VERT,
        fragmentShader: AIRY_DISK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  const spikeStars = useMemo(() => stars.filter((s) => s.showSpikes), [stars])

  const spikeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(spikeStars.length * 3)
    const spikeLengths = new Float32Array(spikeStars.length)
    const colors = new Float32Array(spikeStars.length * 3)
    const intensities = new Float32Array(spikeStars.length)
    const zs = new Float32Array(spikeStars.length)
    const reveals = new Float32Array(spikeStars.length)
    spikeStars.forEach((s, i) => {
      positions[i * 3 + 0] = s.worldPos.x
      positions[i * 3 + 1] = s.worldPos.y
      positions[i * 3 + 2] = s.worldPos.z
      spikeLengths[i] = s.spikeLength
      colors[i * 3 + 0] = s.color.r
      colors[i * 3 + 1] = s.color.g
      colors[i * 3 + 2] = s.color.b
      intensities[i] = s.intensity
      zs[i] = s.z
      reveals[i] = easeOutCubic(revealByTechKey.current.get(s.techKey) ?? 1)
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aSpikeLength', new THREE.Float32BufferAttribute(spikeLengths, 1))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
    g.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1))
    g.setAttribute('aZ', new THREE.Float32BufferAttribute(zs, 1))
    g.setAttribute('aReveal', new THREE.Float32BufferAttribute(reveals, 1))
    spikeGeomRef.current = g
    return g
  }, [spikeStars])

  useFrame((_, delta) => {
    if (reducedMotion) return
    let changed = false
    for (const [key, age] of Array.from(revealByTechKey.current.entries())) {
      if (age >= 1) continue
      revealByTechKey.current.set(key, Math.min(1, age + delta / REVEAL_DURATION_SECONDS))
      changed = true
    }
    if (!changed) return

    const coreRevealAttr = coreGeomRef.current?.getAttribute('aReveal') as
      | THREE.BufferAttribute
      | undefined
    if (coreRevealAttr) {
      stars.forEach((star, index) => {
        coreRevealAttr.setX(index, easeOutCubic(revealByTechKey.current.get(star.techKey) ?? 1))
      })
      coreRevealAttr.needsUpdate = true
    }

    const spikeRevealAttr = spikeGeomRef.current?.getAttribute('aReveal') as
      | THREE.BufferAttribute
      | undefined
    if (spikeRevealAttr) {
      spikeStars.forEach((star, index) => {
        spikeRevealAttr.setX(index, easeOutCubic(revealByTechKey.current.get(star.techKey) ?? 1))
      })
      spikeRevealAttr.needsUpdate = true
    }
  })

  const spikeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: DIFFRACTION_SPIKE_VERT,
        fragmentShader: DIFFRACTION_SPIKE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  return (
    <group renderOrder={10}>
      <points args={[coreGeom, coreMaterial]} />
      {spikeStars.length > 0 && <points args={[spikeGeom, spikeMaterial]} />}
    </group>
  )
}
