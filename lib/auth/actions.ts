'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/auth/supabase-server'

const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  (process.env.APP_HOSTNAME_ALLOWLIST ?? 'localhost:3000').split(',').map((s) => s.trim()),
)

function pickOrigin(): string {
  const h = headers()
  const origin = h.get('origin')
  if (origin) {
    const url = new URL(origin)
    if (ALLOWED_HOSTS.has(url.host)) return origin
  }
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  if (!ALLOWED_HOSTS.has(host)) throw new Error('Disallowed host in OAuth callback origin')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export async function signIn() {
  let origin: string
  try {
    origin = pickOrigin()
  } catch {
    redirect('/?auth_error=disallowed_host')
  }
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
  redirect('/?signed_out=true')
}
