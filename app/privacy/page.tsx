export const metadata = {
  title: 'Privacy Policy — DevAstra',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-2xl mx-auto prose prose-neutral">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-neutral-500">Last updated: May 13, 2026</p>

        <h2>What we collect</h2>
        <p>
          When you sign in with GitHub, we receive your GitHub identity (user ID, login name,
          display name, avatar URL) and email address from the OAuth flow. We also sync metadata
          about your public GitHub activity: commit counts, pull request counts, issue counts,
          and the file paths touched in those commits. We use this data solely to generate your
          developer world map.
        </p>

        <h2>What we do NOT collect</h2>
        <p>
          We do not store commit messages, code diffs, pull request titles or bodies, or any
          content of your code. We do not access or store private repository data — our OAuth
          scope is limited to <code>read:user</code> and <code>user:email</code>. We never sell,
          rent, or share your data with third parties for marketing purposes.
        </p>

        <h2>How we use your data</h2>
        <p>
          Your GitHub activity metadata is used exclusively to build and display your DevAstra
          map, generate your weekly recap email (if enabled), and produce shareable social preview
          images. We do not use your data for advertising, profiling beyond product analytics, or
          any purpose outside the DevAstra service.
        </p>

        <h2>Sub-processors</h2>
        <p>We rely on the following third-party services to operate DevAstra:</p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, and real-time subscriptions</li>
          <li><strong>Vercel</strong> — hosting and serverless compute</li>
          <li><strong>Inngest</strong> — background job processing (sync, recap generation)</li>
          <li><strong>Resend</strong> — transactional email delivery</li>
          <li><strong>Sentry</strong> — error monitoring (PII is scrubbed before transmission)</li>
          <li><strong>PostHog</strong> — product analytics and funnel measurement; session recording is disabled</li>
        </ul>
        <p>
          Each sub-processor receives only the minimum data necessary for their function.
        </p>

        <h2>Cookies</h2>
        <p>
          We use one essential Supabase authentication cookie to maintain your login session.
          This cookie is strictly necessary and exempt from consent requirements. PostHog analytics
          are used without session recording. Vercel Analytics is cookieless. We do not display a
          cookie consent banner because we do not use non-essential cookies.
        </p>

        <h2>Data deletion</h2>
        <p>
          You may delete your account at any time from Settings. Deleting your account permanently
          removes all stored data — your profile, activity records, territories, landmarks, and
          weekly recap history — through a cascading database delete. This action is irreversible.
        </p>

        <h2>Data retention</h2>
        <p>
          We retain your data for the lifetime of your account. If you disconnect GitHub without
          deleting your account, your map data is preserved in its last-known state; reconnecting
          resumes syncing.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? Email us at{' '}
          <a href="mailto:hello@devatlas.app">hello@devatlas.app</a>.
        </p>
      </div>
    </main>
  )
}
