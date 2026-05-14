export const metadata = {
  title: 'Terms of Service — DevAstra',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-2xl mx-auto prose prose-neutral">
        <h1>Terms of Service</h1>
        <p className="text-sm text-neutral-500">Last updated: May 13, 2026</p>

        <h2>Service description</h2>
        <p>
          DevAstra is a developer portfolio tool that visualizes your public GitHub activity as an
          interactive world map. By signing in with GitHub, you authorize DevAstra to read your
          public repository metadata, commit counts, and pull request and issue counts, which we
          use to generate and display your map.
        </p>

        <h2>GitHub data usage</h2>
        <p>
          We access GitHub data only as authorized by your OAuth grant. We use this data solely
          to provide the DevAstra service to you. We do not resell GitHub data, share it with
          third parties for commercial purposes, or perform bulk exports of user data outside the
          service. Data access is limited to public repositories.
        </p>

        <h2>Acceptable use</h2>
        <p>By using DevAstra you agree not to:</p>
        <ul>
          <li>Attempt to scrape, crawl, or bulk-download DevAstra data or user profiles</li>
          <li>Impersonate another user or claim a username that belongs to someone else</li>
          <li>Interfere with or disrupt the service or its infrastructure</li>
          <li>Use the service for any unlawful purpose or in violation of GitHub&apos;s terms</li>
          <li>Circumvent any rate limits, access controls, or security measures</li>
        </ul>

        <h2>Account termination</h2>
        <p>
          You may delete your account at any time from Settings. We reserve the right to suspend
          or terminate accounts that violate these terms without prior notice. Upon termination,
          your data is deleted as described in our Privacy Policy.
        </p>

        <h2>Disclaimer of warranties</h2>
        <p>
          DevAstra is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, express
          or implied. We do not warrant that the service will be uninterrupted, error-free, or
          that any defects will be corrected. Your use of the service is at your sole risk.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, DevAstra and its operators shall not be liable
          for any indirect, incidental, special, or consequential damages arising from your use
          of the service, even if we have been advised of the possibility of such damages.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by applicable law. Governing jurisdiction to be determined
          as the service scales. Any disputes will be resolved in good faith.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Continued use of DevAstra after changes
          are posted constitutes acceptance of the revised terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Email us at{' '}
          <a href="mailto:hello@devatlas.app">hello@devatlas.app</a>.
        </p>
      </div>
    </main>
  )
}
