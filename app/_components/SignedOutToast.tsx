'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export function SignedOutToast(): null {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('signed_out') === 'true') {
      toast('Signed out')
      const url = new URL(window.location.href)
      url.searchParams.delete('signed_out')
      router.replace(url.pathname + (url.search || ''))
    }
  }, [searchParams, router])

  return null
}
