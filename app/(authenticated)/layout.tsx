import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/auth/supabase-server'

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
  return <>{children}</>
}
