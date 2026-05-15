'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { generateFieldStars } from '@/features/constellation/render/field-stars'
import { spectralHex } from '@/features/constellation/render/palette'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { TWINKLE_VERT } from '../shaders/twinkle.vert'
import { TWINKLE_FRAG } from '../shaders/twinkle.frag'
import { useConstellationState } from '../state'

interface FieldStarsProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function FieldStars({ viewport = 'desktop' }: FieldStarsProps) {
  const { reducedMotion } = useConstellationState()
  const stars = useMemo(() => generateFieldStars(viewport), [viewport])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(stars.length * 3)
    const sizes = new Float32Array(stars.length)
    const colors = new Float32Array(stars.length * 3)
    const phases = new Float32Array(stars.length)
    stars.forEach((s, i) => {
      const w = viewBoxToWorld(s.pos)
      positions[i * 3 + 0] = w.x
      positions[i * 3 + 1] = w.y
      positions[i * 3 + 2] = w.z
      sizes[i] = s.size
      const c = new THREE.Color(spectralHex(s.color))
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      phases[i] = s.twinklePhase
    })
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    return g
  }, [stars])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkleAmplitude: { value: 0.10 },
      uTwinkleEnabled: { value: 1.0 },
    },
    vertexShader: TWINKLE_VERT,
    fragmentShader: TWINKLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  const matRef = useRef(material)
  matRef.current = material

  useFrame((state) => {
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    matRef.current.uniforms.uTwinkleEnabled.value = reducedMotion ? 0.0 : 1.0
  })

  return <points args={[geom, material]} />
}
