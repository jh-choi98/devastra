import 'server-only'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/auth/supabase-server'
import { getUserById, type DbUser } from '@/lib/db/queries/users'

export type { DbUser as User }

export async function requireUser(): Promise<DbUser> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const dbUser = await getUserById(user.id)
  if (!dbUser) redirect('/')

  return dbUser
}

export async function getOptionalUser(): Promise<DbUser | null> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  return getUserById(user.id)
}
