import Link from 'next/link'

export function PrivateProfile({ username }: { username: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 text-slate-100">
      <h1 className="text-3xl font-bold">This DevAtlas is private.</h1>
      <p className="text-slate-400 text-center max-w-sm">
        {username
          ? `@${username}'s developer world is private or doesn't exist yet.`
          : "This developer world is private or doesn't exist yet."}
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium"
      >
        Create your own DevAtlas →
      </Link>
    </main>
  )
}
