'use client'
import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  fallback: ReactNode
}
interface State {
  hasError: boolean
}

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    Sentry.captureException(error, {
      tags: {
        feature: 'constellation',
        event_name: 'constellation.webgl.scene_crash',
      },
      contexts: {
        react: { componentStack: info.componentStack },
      },
    })
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
