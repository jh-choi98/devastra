import fs from 'fs/promises'
import path from 'path'
import { marked } from 'marked'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata = {
  title: 'Terms of Service — DevAstra',
}

async function loadMarkdown(): Promise<string> {
  const filePath = path.join(process.cwd(), 'docs', 'legal', 'terms.md')
  return fs.readFile(filePath, 'utf-8')
}

export default async function TermsPage(): Promise<JSX.Element> {
  const markdown = await loadMarkdown()
  const html = await marked(markdown, { breaks: true })

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0b1020',
        padding: '48px 16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link
          href="/"
          style={{
            color: '#64748b',
            fontSize: 13,
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 32,
          }}
        >
          ← Back
        </Link>
        <div
          style={{
            background: '#111827',
            borderRadius: 12,
            padding: '48px 40px',
            color: '#e2e8f0',
            lineHeight: 1.7,
          }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  )
}
