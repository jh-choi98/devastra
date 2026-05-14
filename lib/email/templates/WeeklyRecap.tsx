import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { RecapHighlights } from '@/features/recap/generate'
import { summarizeForEmail } from '@/features/recap/diff'

type Props = {
  recapId: string
  username: string
  highlights: RecapHighlights
}

export function WeeklyRecap({ recapId, username, highlights }: Props) {
  const { lines } = summarizeForEmail(highlights, true)

  return (
    <Html lang="en">
      <Head />
      <Preview>Your DevAstra — this week</Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src={`https://devatlas.app/api/og/recap/${recapId}`}
            width="600"
            alt={`@${username}'s weekly DevAstra recap`}
            style={{ width: '100%', borderRadius: '8px', display: 'block' }}
          />

          <Section style={section}>
            {lines.map((line, i) => (
              <Text key={i} style={highlight}>
                • {line}
              </Text>
            ))}
          </Section>

          <Section style={{ textAlign: 'center' as const, padding: '16px 0' }}>
            <Button href="https://devatlas.app/" style={button}>
              See your full world →
            </Button>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              <Link href="https://devatlas.app/settings#email" style={footerLink}>
                Unsubscribe
              </Link>
              {' · '}
              Sent by DevAstra
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default WeeklyRecap

const body = {
  backgroundColor: '#0f172a',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  margin: '0',
  padding: '24px 0',
}

const container = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  maxWidth: '600px',
  margin: '0 auto',
  overflow: 'hidden' as const,
}

const section = {
  padding: '24px 32px 8px',
}

const highlight = {
  color: '#e2e8f0',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const button = {
  backgroundColor: '#7C9DFF',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '12px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}

const hr = {
  borderColor: '#334155',
  margin: '24px 32px 0',
}

const footer = {
  padding: '16px 32px 24px',
}

const footerText = {
  color: '#64748b',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
}

const footerLink = {
  color: '#64748b',
  textDecoration: 'underline',
}
