import Link from 'next/link'

export function LandingFooter(): JSX.Element {
  return (
    <footer
      style={{
        padding: 24,
        color: '#64748b',
        fontSize: 12,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <Link href="/privacy" style={{ color: '#94a3b8', marginRight: 12 }}>
        Privacy
      </Link>
      <Link href="/terms" style={{ color: '#94a3b8', marginRight: 12 }}>
        Terms
      </Link>
      <a
        href="https://github.com/devastra/devastra"
        style={{ color: '#94a3b8' }}
        target="_blank"
        rel="noopener"
      >
        GitHub
      </a>
    </footer>
  )
}
