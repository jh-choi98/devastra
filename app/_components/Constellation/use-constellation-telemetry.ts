'use client'
import { useEffect, useRef } from 'react'
import * as Sentry from '@sentry/nextjs'

export function useConstellationTelemetry(opts: {
  webglSupported: boolean
  sceneMounted: boolean
}) {
  const reported = useRef({ success: false, failure: false })

  useEffect(() => {
    if (!opts.webglSupported && !reported.current.failure) {
      Sentry.captureMessage('constellation.webgl.init_failure', {
        level: 'info',
        tags: {
          feature: 'constellation',
          event_name: 'constellation.webgl.init_failure',
          reason: 'unsupported',
        },
      })
      reported.current.failure = true
    }
    if (opts.webglSupported && opts.sceneMounted && !reported.current.success) {
      Sentry.captureMessage('constellation.webgl.init_success', {
        level: 'info',
        tags: {
          feature: 'constellation',
          event_name: 'constellation.webgl.init_success',
        },
      })
      reported.current.success = true
    }
  }, [opts.webglSupported, opts.sceneMounted])
}
