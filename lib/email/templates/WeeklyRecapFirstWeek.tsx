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

export function WeeklyRecapFirstWeek({ highlights: h, ogUrl, ctaUrl, unsubscribeUrl }: Props): JSX.Element {
  const hasNewStars = h.slot_2?.kind === 'new_stars' && h.slot_2.tech_keys.length > 0
  const firstStar = hasNewStars && h.slot_2?.kind === 'new_stars' ? h.slot_2.tech_keys[0] : null

  return (
    <Html>
      <Head />
      <Preview>{h.preview_text || 'Welcome to your first week on DevAstra.'}</Preview>
      <Body style={{ backgroundColor: '#0b1020', fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px', color: '#f1f5f9' }}>
          <Text style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', margin: 0, marginBottom: 24 }}>
            DevAstra
          </Text>

          <Img
            src={ogUrl}
            alt="Your DevAstra constellation, week 1"
            width="552"
            height="290"
            style={{ width: '100%', height: 'auto', borderRadius: 12, marginBottom: 24 }}
          />

          {firstStar ? (
            <Heading as="h2" style={{ color: '#f8fafc', fontSize: 22, margin: '8px 0' }}>
              Your first star: {getPublicTech(firstStar)?.displayName ?? firstStar}
            </Heading>
          ) : (
            <Heading as="h2" style={{ color: '#f8fafc', fontSize: 20, margin: '8px 0' }}>
              Welcome — push a commit to begin your constellation.
            </Heading>
          )}

          {h.slot_1 && (
            <Text style={{ color: '#cbd5e1', fontSize: 16, lineHeight: '1.5' }}>
              {h.slot_1.kind === 'stage_up'
                ? `${TERRITORIES[h.slot_1.cluster_type].name} cluster expanded`
                : `${TERRITORIES[h.slot_1.cluster_type].name} brightened most this week`}
            </Text>
          )}

          {h.slot_2 && h.slot_2.kind === 'brightened_stars' && (
            <Text style={{ color: '#cbd5e1', fontSize: 16, lineHeight: '1.5' }}>
              {renderBrightenedStars(h.slot_2.tech_keys)}
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

          <Section style={{ marginTop: 32 }}>
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
              {firstStar ? "See what's new →" : 'See your sky →'}
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

export default WeeklyRecapFirstWeek

function renderBrightenedStars(techKeys: string[]): string {
  if (techKeys.length === 0) return ''
  const names = techKeys.map((tk) => getPublicTech(tk)?.displayName ?? tk)
  return `${names.length} star${names.length === 1 ? '' : 's'} brightened — ${names.slice(0, 3).join(', ')}`
}
