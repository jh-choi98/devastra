import { Html, Head, Preview, Body, Container, Heading, Text, Img, Link, Section } from '@react-email/components'
import type { HighlightsPayload } from '@/features/recap/slot-builder'
import { TERRITORIES } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

type Props = {
  ogUrl: string
  highlights: HighlightsPayload
  ctaUrl: string
  unsubscribeUrl: string
  displayUsername: string
}

export function WeeklyRecapActive({ highlights: h, ogUrl, ctaUrl, unsubscribeUrl }: Props): JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>{h.preview_text}</Preview>
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

          {h.slot_1 && (
            <Heading as="h2" style={{ color: '#f8fafc', fontSize: 20, margin: '8px 0' }}>
              {h.slot_1.kind === 'stage_up'
                ? `${TERRITORIES[h.slot_1.cluster_type].name} cluster expanded`
                : `${TERRITORIES[h.slot_1.cluster_type].name} brightened most this week`}
            </Heading>
          )}

          {h.slot_2 && (
            <Text style={{ color: '#cbd5e1', fontSize: 16, lineHeight: '1.5' }}>
              {h.slot_2.kind === 'new_stars'
                ? renderNewStars(h.slot_2.tech_keys)
                : renderBrightenedStars(h.slot_2.tech_keys)}
            </Text>
          )}

          {h.slot_3 && (
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              {[
                h.slot_3.active_days > 0 && `${h.slot_3.active_days} active days`,
                h.slot_3.commits > 0 && `${h.slot_3.commits} commits`,
                h.slot_3.prs_shipped > 0 && `${h.slot_3.prs_shipped} PRs shipped`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}

          <Section style={{ marginTop: 32, marginBottom: 32 }}>
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
              See what&apos;s new →
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

export default WeeklyRecapActive

function renderNewStars(techKeys: string[]): string {
  if (techKeys.length === 0) return ''
  const names = techKeys.map((tk) => getPublicTech(tk)?.displayName ?? tk)
  if (names.length === 1) return `${names[0]} is new this week`
  if (names.length <= 3) return `${names.join(', ')} are new this week`
  return `${names.length} new stars this week — ${names.slice(0, 3).join(', ')}, +${names.length - 3}`
}

function renderBrightenedStars(techKeys: string[]): string {
  if (techKeys.length === 0) return ''
  const names = techKeys.map((tk) => getPublicTech(tk)?.displayName ?? tk)
  return `${names.length} star${names.length === 1 ? '' : 's'} brightened — ${names.slice(0, 3).join(', ')}`
}
