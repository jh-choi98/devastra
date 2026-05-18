'use client'

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useReducedMotion } from '../hooks/useReducedMotion'

const MAX_TILT_DEG = 2.5

export function ParallaxRig() {
  const { camera } = useThree()
  const target = useRef({ x: 0, y: 0 })
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      target.current = { x: nx * MAX_TILT_DEG, y: ny * MAX_TILT_DEG }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reducedMotion])

  useFrame((_, dt) => {
    if (reducedMotion) return
    const t = Math.min(1, dt * 3)
    camera.rotation.x += (target.current.y * Math.PI / 180 - camera.rotation.x) * t
    camera.rotation.y += (target.current.x * Math.PI / 180 - camera.rotation.y) * t
  })

  return null
}
