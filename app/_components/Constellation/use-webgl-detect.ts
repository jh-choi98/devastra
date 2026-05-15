'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true if WebGL2 (or WebGL1 fallback) is available.
 * Defaults to true during SSR so Scene mounts optimistically;
 * once client-side, runs the actual capability check.
 */
export function useWebGLDetect(): boolean {
  const [supported, setSupported] = useState<boolean>(true)
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      setSupported(Boolean(gl))
    } catch {
      setSupported(false)
    }
  }, [])
  return supported
}
