'use client'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { generateFieldStarPool } from '@/features/constellation/render/field-stars'
import { spectralHex } from '@/features/constellation/render/palette'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { backgroundStarProfileForCanvas } from '../background-star-profile'
import { TWINKLE_VERT } from '../shaders/twinkle.vert'
import { TWINKLE_FRAG } from '../shaders/twinkle.frag'
import { useConstellationState } from '../state'

interface FieldStarsProps {
  viewport?: 'desktop' | 'mobile' | 'og'
  opacity?: number
}

// Background tier — smallest mouse parallax (~1px equivalent in world units).
// Tech stars stay completely fixed; the parallax delta between layers is what
// produces the "I'm looking into space" depth cue without ever moving the
// user's identity surface (the lit tech constellation).
const PARALLAX_BG = 0.002

export function FieldStars({ viewport = 'desktop', opacity = 1 }: FieldStarsProps) {
  const { reducedMotion } = useConstellationState()
  const { size } = useThree()
  const profile = useMemo(
    () => backgroundStarProfileForCanvas(size.width, size.height, viewport),
    [size.width, size.height, viewport],
  )
  const stars = useMemo(() => generateFieldStarPool(viewport), [viewport])
  const groupRef = useRef<THREE.Group>(null)

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

  useLayoutEffect(() => {
    geom.setDrawRange(0, Math.min(profile.fieldCount, stars.length))
  }, [geom, profile.fieldCount, stars.length])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uTwinkleAmplitude: { value: 0.1 },
          uTwinkleEnabled: { value: 1.0 },
          uSizeScale: { value: 1.0 },
          uOpacity: { value: 1.0 },
        },
        vertexShader: TWINKLE_VERT,
        fragmentShader: TWINKLE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  const matRef = useRef(material)
  matRef.current = material

  useFrame(({ mouse, clock }, dt) => {
    matRef.current.uniforms.uTime.value = clock.elapsedTime
    matRef.current.uniforms.uTwinkleEnabled.value = reducedMotion ? 0.0 : 1.0
    matRef.current.uniforms.uTwinkleAmplitude.value = profile.twinkleAmplitude
    matRef.current.uniforms.uSizeScale.value = profile.fieldSizeScale
    matRef.current.uniforms.uOpacity.value = opacity * profile.fieldOpacity

    if (groupRef.current) {
      groupRef.current.scale.x = profile.fieldSpreadX
      groupRef.current.scale.y = profile.fieldSpreadY

      if (reducedMotion) {
        groupRef.current.position.x = 0
        groupRef.current.position.y = 0
      } else {
        const tx = -mouse.x * PARALLAX_BG
        const ty = -mouse.y * PARALLAX_BG
        const lerp = Math.min(1, dt * 3)
        groupRef.current.position.x += (tx - groupRef.current.position.x) * lerp
        groupRef.current.position.y += (ty - groupRef.current.position.y) * lerp
      }
    }
  })

  return (
    <group ref={groupRef}>
      <points args={[geom, material]} />
    </group>
  )
}
