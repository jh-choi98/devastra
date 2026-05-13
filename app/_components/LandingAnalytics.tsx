'use client'

import { useEffect } from 'react'
import { posthog, initPosthog } from '@/lib/posthog'

export default function LandingAnalytics() {
  useEffect(() => {
    initPosthog()
    posthog.capture('landing.viewed')
  }, [])

  return null
}
