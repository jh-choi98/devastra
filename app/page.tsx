import { signIn } from '@/lib/auth/actions'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">DevAtlas</h1>
      <p className="text-gray-600">Turn your GitHub into a developer world map</p>
      <form action={signIn}>
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          Sign in with GitHub
        </button>
      </form>
    </main>
  )
}
