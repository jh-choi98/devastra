import { notFound } from 'next/navigation'

export async function POST() {
  if (process.env.NODE_ENV === 'production') notFound()

  if (process.env.ALLOW_TEST_SYNC !== '1') {
    return new Response('Not Found', { status: 404 })
  }

  const { requireUser } = await import('@/lib/auth/session')
  const { run } = await import('@/features/sync/manual')

  const user = await requireUser()
  const step = {
    run: async (_name: string, fn: () => Promise<unknown> | unknown) => fn(),
  }

  const result = await run({ data: { userId: user.id } }, step as never)

  return Response.json({ status: 'completed', result })
}
