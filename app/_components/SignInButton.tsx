'use client'

import { createBrowserClient } from '@/lib/auth/supabase-browser'
import { captureClientEvent } from './posthog-lite'

export function SignInButton() {
  async function handleSignIn() {
    captureClientEvent('oauth.clicked')

    const supabase = createBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'read:user user:email',
      },
    })
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleSignIn}
        className="rounded-xl bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-700 transition-colors border border-gray-700"
      >
        Sign in with GitHub
      </button>
      <p className="max-w-md text-center text-xs leading-5 text-slate-500">
        We request only GitHub profile/email access and public repo metadata. No private repos,
        code, diffs, commit messages, or PR bodies are stored.
      </p>
    </div>
  )
}
