import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/auth/supabase-server'
import { getUserById } from '@/lib/db/queries/users'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=cancelled', request.url))
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/?auth_error=cancelled', request.url))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/?auth_error=cancelled', request.url))
  }

  const dbUser = await getUserById(user.id)

  if (!dbUser?.lastEventId) {
    return NextResponse.redirect(new URL('/onboarding/repos', request.url))
  }

  return NextResponse.redirect(new URL('/', request.url))
}
