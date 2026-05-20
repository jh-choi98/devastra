'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  semanticScaleProfileForCanvas,
  type SemanticConstellationScaleProfile,
} from './semantic-scale-profile'
import { responsiveViewportForWidth } from './responsive-viewport'
import type { ConstellationData } from './types'
import type { Viewport } from '@/features/constellation/render/types'

interface ElementSize {
  width: number | null
  height: number | null
}

interface ResponsiveConstellationEnvironment {
  containerRef: RefObject<HTMLDivElement>
  viewport: Viewport
  semanticProfile: SemanticConstellationScaleProfile
  size: ElementSize
}

function initialSize(): ElementSize {
  if (typeof window === 'undefined') return { width: null, height: null }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function nextSize(previous: ElementSize, width: number, height: number): ElementSize {
  if (
    previous.width !== null &&
    previous.height !== null &&
    Math.abs(previous.width - width) < 1 &&
    Math.abs(previous.height - height) < 1
  ) {
    return previous
  }
  return { width, height }
}

export function useResponsiveConstellationEnvironment(
  requestedViewport?: ConstellationData['viewport'],
): ResponsiveConstellationEnvironment {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ElementSize>(initialSize)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateFromRect = () => {
      const rect = element.getBoundingClientRect()
      setSize((previous) => nextSize(previous, rect.width, rect.height))
    }

    updateFromRect()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFromRect)
      return () => window.removeEventListener('resize', updateFromRect)
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) {
        updateFromRect()
        return
      }
      setSize((previous) => nextSize(previous, rect.width, rect.height))
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const viewport = responsiveViewportForWidth(size.width, requestedViewport)
  const semanticProfile = useMemo(
    () => semanticScaleProfileForCanvas(size.width, size.height, viewport),
    [size.width, size.height, viewport],
  )

  return { containerRef, viewport, semanticProfile, size }
}
