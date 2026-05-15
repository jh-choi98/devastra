'use client'
import { useEffect, useState } from 'react'

export function useWebGLDetect(): boolean {
  // null = checking (SSR / pre-mount), true/false = result
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    let ok = false
    try {
      const canvas = document.createElement('canvas')
      const gl =
        (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
      ok = Boolean(gl)
    } catch {
      ok = false
    }
    setSupported(ok)
  }, [])

  // Optimistic: while checking (null), assume supported to avoid flash of fallback
  return supported ?? true
}
