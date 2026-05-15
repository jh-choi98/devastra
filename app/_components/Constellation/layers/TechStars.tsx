'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { AIRY_DISK_VERT } from '../shaders/airy-disk.vert'
import { AIRY_DISK_FRAG } from '../shaders/airy-disk.frag'
import { DIFFRACTION_SPIKE_VERT } from '../shaders/diffraction-spike.vert'
import { DIFFRACTION_SPIKE_FRAG } from '../shaders/diffraction-spike.frag'
import { spectralColorFor, spectralHex } from '@/features/constellation/render/palette'
import { magnitudeFor, topQuintileThreshold } from '@/features/constellation/render/magnitude'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { resolveStarViewBoxPosition } from '@/app/_components/Constellation/star-positions'
import type { ConstellationData } from '../types'

interface TechStarsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function TechStars({ data, viewport = 'desktop' }: TechStarsProps) {
  const stars = useMemo(() => {
    const lit = data.landmarks.filter(l => l.firstUnlockedAt !== null && l.weight >= 5)
    const threshold = topQuintileThreshold(lit.map(l => l.weight))
    return lit.map(landmark => {
      const vbPos = resolveStarViewBoxPosition(landmark.tech_key, landmark.territory, viewport)
      const worldPos = viewBoxToWorld(vbPos)
      const m = magnitudeFor(landmark.weight, threshold)
      const spectral = spectralColorFor(landmark.tech_key)
      const hex = spectralHex(spectral)
      const c = new THREE.Color(hex)
      return {
        worldPos,
        color: c,
        size: m.coreRadius * 2,
        intensity: m.intensity,
        showSpikes: m.showSpikes,
        spikeLength: m.spikeLength,
      }
    })
  }, [data.landmarks, viewport])

  const coreGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(stars.length * 3)
    const sizes = new Float32Array(stars.length)
    const colors = new Float32Array(stars.length * 3)
    const intensities = new Float32Array(stars.length)
    stars.forEach((s, i) => {
      positions[i * 3 + 0] = s.worldPos.x
      positions[i * 3 + 1] = s.worldPos.y
      positions[i * 3 + 2] = s.worldPos.z
      sizes[i] = s.size
      colors[i * 3 + 0] = s.color.r
      colors[i * 3 + 1] = s.color.g
      colors[i * 3 + 2] = s.color.b
      intensities[i] = s.intensity
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
    g.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1))
    return g
  }, [stars])

  const coreMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: AIRY_DISK_VERT,
    fragmentShader: AIRY_DISK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  const spikeStars = useMemo(() => stars.filter(s => s.showSpikes), [stars])

  const spikeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(spikeStars.length * 3)
    const spikeLengths = new Float32Array(spikeStars.length)
    const colors = new Float32Array(spikeStars.length * 3)
    const intensities = new Float32Array(spikeStars.length)
    spikeStars.forEach((s, i) => {
      positions[i * 3 + 0] = s.worldPos.x
      positions[i * 3 + 1] = s.worldPos.y
      positions[i * 3 + 2] = s.worldPos.z
      spikeLengths[i] = s.spikeLength
      colors[i * 3 + 0] = s.color.r
      colors[i * 3 + 1] = s.color.g
      colors[i * 3 + 2] = s.color.b
      intensities[i] = s.intensity
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aSpikeLength', new THREE.Float32BufferAttribute(spikeLengths, 1))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
    g.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1))
    return g
  }, [spikeStars])

  const spikeMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: DIFFRACTION_SPIKE_VERT,
    fragmentShader: DIFFRACTION_SPIKE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  return (
    <group renderOrder={10}>
      <points args={[coreGeom, coreMaterial]} />
      {spikeStars.length > 0 && <points args={[spikeGeom, spikeMaterial]} />}
    </group>
  )
}
