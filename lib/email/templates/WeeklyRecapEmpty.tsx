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

type Props = {
  recapId?: string
  username: string
}

export function WeeklyRecapEmpty({ recapId, username }: Props) {
  const heroSrc = recapId
    ? `https://devatlas.app/api/og/recap/${recapId}`
    : 'https://devatlas.app/og-ocean.png'

  return (
    <Html lang="en">
      <Head />
      <Preview>Your DevAtlas — this week</Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src={heroSrc}
            width="600"
            alt={`@${username}'s DevAtlas world`}
            style={{ width: '100%', borderRadius: '8px', display: 'block' }}
          />

          <Section style={section}>
            <Text style={highlight}>Steady week — see you next Sunday.</Text>
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
              Sent by DevAtlas
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default WeeklyRecapEmpty

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
  color: '#94a3b8',
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
