import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn(),
}))

vi.mock('@/lib/auth/supabase-server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/db/queries/users', () => ({ listUserRepos: vi.fn() }))
vi.mock('@/lib/db/queries/sync-jobs', () => ({
  createSyncJob: vi.fn(),
  failSyncJob: vi.fn(),
}))
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: vi.fn() },
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { deleteAccount } from '@/app/(authenticated)/settings/_actions'
import { requireUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/auth/supabase-server'
import { redirect } from 'next/navigation'

describe('deleteAccount', () => {
  const deleteUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-to-delete',
      displayUsername: 'delete-me',
    } as Awaited<ReturnType<typeof requireUser>>)
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          deleteUser,
        },
      },
    } as unknown as ReturnType<typeof createAdminClient>)
    deleteUser.mockResolvedValue({ error: null })
  })

  it('deletes the authenticated Supabase auth user and redirects to the deleted page', async () => {
    await deleteAccount()

    expect(deleteUser).toHaveBeenCalledWith('user-to-delete')
    expect(redirect).toHaveBeenCalledWith('/account-deleted')
  })

  it('does not redirect when Supabase admin deletion fails', async () => {
    deleteUser.mockResolvedValue({ error: { message: 'permission denied' } })

    await expect(deleteAccount()).rejects.toThrow(
      'Account deletion failed; please contact support.',
    )
    expect(redirect).not.toHaveBeenCalled()
  })
})
