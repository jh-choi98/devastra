'use client'

import { useEffect } from 'react'
import { posthog, initPosthog } from '@/lib/posthog'

export function PosthogIdentifier({ userId }: { userId: string }) {
  useEffect(() => {
    initPosthog()
    posthog.identify(userId)
  }, [userId])

  return null
}
