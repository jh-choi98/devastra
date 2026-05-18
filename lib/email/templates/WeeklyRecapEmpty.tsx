import 'server-only'

import { Html, Head, Preview, Body, Container, Text, Img, Link, Section } from '@react-email/components'

type Props = {
  ogUrl: string
  highlights: unknown
  ctaUrl: string
  unsubscribeUrl: string
  displayUsername: string
}

export function WeeklyRecapEmpty({ ogUrl, ctaUrl, unsubscribeUrl }: Props): JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Steady week — your constellation is the same.</Preview>
      <Body style={{ backgroundColor: '#0b1020', fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px', color: '#f1f5f9' }}>
          <Text style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', margin: 0, marginBottom: 24 }}>
            DevAstra
          </Text>

          <Img
            src={ogUrl}
            alt="Your DevAstra constellation, this week"
            width="552"
            height="290"
            style={{ width: '100%', height: 'auto', borderRadius: 12, marginBottom: 24 }}
          />

          <Text style={{ color: '#cbd5e1', fontSize: 16 }}>
            Steady week — your constellation is the same.
          </Text>

          <Section style={{ marginTop: 24 }}>
            <Link
              href={ctaUrl}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              See your sky →
            </Link>
          </Section>

          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 32 }}>
            <Link href={unsubscribeUrl} style={{ color: '#64748b' }}>
              Unsubscribe
            </Link>
            {' · '}
            <Link href="https://devastra.app/privacy" style={{ color: '#64748b' }}>
              Privacy
            </Link>
            {' · '}
            <Link href="https://devastra.app/settings" style={{ color: '#64748b' }}>
              Settings
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default WeeklyRecapEmpty
