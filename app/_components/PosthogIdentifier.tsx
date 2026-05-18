'use client'

import { useEffect } from 'react'
import { identifyClientUser } from './posthog-lite'

export function PosthogIdentifier({ userId }: { userId: string }) {
  useEffect(() => {
    identifyClientUser(userId)
  }, [userId])

  return null
}
