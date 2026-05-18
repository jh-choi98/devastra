'use client'
import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setR(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setR(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return r
}
