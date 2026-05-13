'use client'

import { createBrowserClient } from '@/lib/auth/supabase-browser'
import { posthog, initPosthog } from '@/lib/posthog'

export function SignInButton() {
  async function handleSignIn() {
    initPosthog()
    posthog.capture('oauth.clicked')

    const supabase = createBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: 'read:user user:email',
      },
    })
  }

  return (
    <button
      onClick={handleSignIn}
      className="rounded-xl bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-700 transition-colors border border-gray-700"
    >
      Sign in with GitHub
    </button>
  )
}
