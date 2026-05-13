import 'server-only'

import { PostHog } from 'posthog-node'

let _client: PostHog | null = null

function getClient(): PostHog {
  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    })
  }
  return _client
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  getClient().capture({ distinctId, event, properties })
}
