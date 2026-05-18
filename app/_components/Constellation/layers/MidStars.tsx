'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { spectralHex } from '@/features/constellation/render/palette'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { useConstellationState } from '../state'

interface MidStarsProps {
  viewport?: 'desktop' | 'mobile' | 'og'
  opacity?: number
}

// Mid-depth tier — sits between FieldStars and TechStars in parallax response.
// Slightly fewer / slightly bigger than FieldStars, with a stronger mouse
// parallax (~3px) so the front-to-back gradient is felt.
const COUNTS: Record<'desktop' | 'mobile' | 'og', number> = {
  desktop: 420,
  mobile: 220,
  og: 280,
}

const PARALLAX_MID = 0.006

// Same deterministic seed family as FieldStars but distinct sub-seed.
function cyrb53(str: string): number {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MID_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uTwinkleEnabled;
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float t = uTime * 0.4 + aPhase * 6.2831853;
    float twinkle = 1.0 + sin(t) * 0.06 * uTwinkleEnabled;
    gl_PointSize = aSize * 3.0 * twinkle;
    vColor = aColor;
    vIntensity = twinkle;
  }
`
const MID_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float inv = 1.0 - r;
    float core = pow(inv, 5.5) * 0.35;
    float halo = pow(inv, 1.25);
    float alpha = clamp(core + halo * 0.82, 0.0, 1.0);
    gl_FragColor = vec4(vColor * vIntensity * (1.0 + core), alpha * 0.74 * uOpacity);
  }
`

export function MidStars({ viewport = 'desktop', opacity = 1 }: MidStarsProps) {
  const { reducedMotion } = useConstellationState()
  const groupRef = useRef<THREE.Group>(null)

  const data = useMemo(() => {
    const count = COUNTS[viewport]
    const seed = cyrb53(`devastra:mid-stars:v1:${viewport}`)
    const rng = mulberry32(seed >>> 0)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Spread across the same expanded generation rectangle FieldStars uses.
      const vbX = -400 + rng() * 1800
      const vbY = -250 + rng() * 1200
      const w = viewBoxToWorld({ x: vbX, y: vbY })
      positions[i * 3 + 0] = w.x
      positions[i * 3 + 1] = w.y
      positions[i * 3 + 2] = w.z

      // Size: 70% size 2, 30% size 3 (no size 1 — that's the BG tier)
      const sv = rng()
      sizes[i] = sv < 0.7 ? 2 : 3

      // Color: slightly bluer than FieldStars on average — these read as the
      // "front" of the background field.
      const cv = rng()
      const color =
        cv < 0.55 ? 'white' : cv < 0.85 ? 'blue-white' : cv < 0.95 ? 'yellow-white' : 'orange'
      const c = new THREE.Color(spectralHex(color))
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b

      phases[i] = rng()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
    return g
  }, [viewport])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uTwinkleEnabled: { value: 1.0 },
          uOpacity: { value: 1.0 },
        },
        vertexShader: MID_VERT,
        fragmentShader: MID_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useFrame(({ mouse, clock }, dt) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uTwinkleEnabled.value = reducedMotion ? 0.0 : 1.0
    material.uniforms.uOpacity.value = opacity
    if (groupRef.current) {
      if (reducedMotion) {
        groupRef.current.position.x = 0
        groupRef.current.position.y = 0
      } else {
        const tx = -mouse.x * PARALLAX_MID
        const ty = -mouse.y * PARALLAX_MID
        const lerp = Math.min(1, dt * 3)
        groupRef.current.position.x += (tx - groupRef.current.position.x) * lerp
        groupRef.current.position.y += (ty - groupRef.current.position.y) * lerp
      }
    }
  })

  return (
    <group ref={groupRef}>
      <points args={[data, material]} />
    </group>
  )
}
