'use client'

import { useEffect } from 'react'
import { captureClientEvent } from './posthog-lite'

export default function LandingAnalytics() {
  useEffect(() => {
    captureClientEvent('landing.viewed', {
      properties: {
        $pathname: '/',
      },
    })
  }, [])

  return null
}
