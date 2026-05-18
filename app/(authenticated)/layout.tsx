import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/auth/supabase-server'
import { PosthogIdentifier } from '@/app/_components/PosthogIdentifier'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')
  return (
    <>
      <PosthogIdentifier userId={user.id} />
      {children}
    </>
  )
}
