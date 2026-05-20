'use client'

import { useState } from 'react'
import { GitHubDisconnectedBanner } from './GitHubDisconnectedBanner'
import { SystemStatusBanner } from './SystemStatusBanner'
import { WelcomeBackStrip } from './WelcomeBackStrip'
import { ThisWeekStrip } from './ThisWeekStrip'
import { SyncFailedBanner } from './SyncFailedBanner'

export type BannerState = {
  githubDisconnected?: { variant: 'disconnected' | 'token_expired' }
  systemStatus?: { id: string; message: string; severity: 'info' | 'warning' | 'error' }
  welcomeBack?: {
    diffSummary: { new_stars_count: number; expanded_clusters: string[] }
    lastLoginIso: string
  }
  thisWeek?: { highlights: Parameters<typeof ThisWeekStrip>[0]['highlights']; weekStartIso: string }
  syncFailed?: boolean
}

export function BannerStack(props: {
  state: BannerState
  onRetry: () => void
}): JSX.Element {
  const [syncFailedDismissed, setSyncFailedDismissed] = useState(false)
  const { state } = props

  // Top-strip priority: disconnected > systemStatus > welcomeBack > thisWeek
  let topBanner: React.ReactNode = null

  if (state.githubDisconnected) {
    topBanner = <GitHubDisconnectedBanner variant={state.githubDisconnected.variant} />
  } else if (state.systemStatus) {
    topBanner = (
      <SystemStatusBanner
        id={state.systemStatus.id}
        message={state.systemStatus.message}
        severity={state.systemStatus.severity}
      />
    )
  } else if (state.welcomeBack) {
    topBanner = (
      <WelcomeBackStrip
        diffSummary={state.welcomeBack.diffSummary}
        lastLoginIso={state.welcomeBack.lastLoginIso}
        onDismiss={() => {}}
      />
    )
  } else if (state.thisWeek) {
    topBanner = (
      <ThisWeekStrip
        highlights={state.thisWeek.highlights}
        weekStartIso={state.thisWeek.weekStartIso}
        onDismiss={() => {}}
      />
    )
  }

  const showSyncFailed = state.syncFailed && !syncFailedDismissed

  return (
    <>
      {topBanner && (
        <div className="absolute inset-x-0 top-16 z-40 sm:top-20">
          {topBanner}
        </div>
      )}
      {showSyncFailed && (
        <SyncFailedBanner
          onRetry={props.onRetry}
          onDismiss={() => setSyncFailedDismissed(true)}
        />
      )}
    </>
  )
}
