'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/auth/supabase-server'

export async function signIn() {
  const headersList = headers()
  const origin =
    headersList.get('origin') ??
    `${headersList.get('x-forwarded-proto') ?? 'https'}://${headersList.get('host') ?? 'localhost:3000'}`

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user user:email',
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) redirect('/?auth_error=oauth_failed')
  redirect(data.url)
}

export async function signOut() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  redirect('/')
}
