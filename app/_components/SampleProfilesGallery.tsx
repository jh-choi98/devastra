import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { inArray, eq, and } from 'drizzle-orm'
import { ogVersionParam } from '@/lib/og/version'

// Curated set (MVP: hardcoded usernames). Per ADR — Flow 1 #107: founder picks.
// Populate with 3 real usernames once they're available; empty array → don't render the section.
const CURATED_USERNAMES: string[] = []

export async function SampleProfilesGallery() {
  if (CURATED_USERNAMES.length === 0) return null

  const publicUsers = await db
    .select({ displayUsername: users.displayUsername, avatarUrl: users.avatarUrl })
    .from(users)
    .where(
      and(
        inArray(users.displayUsername, CURATED_USERNAMES),
        eq(users.isPublic, true),
      ),
    )

  if (publicUsers.length === 0) return null

  return (
    <section
      style={{
        padding: '48px 24px',
        maxWidth: 960,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
        See others&apos; constellations →
      </p>
      <div
        style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {publicUsers.map((u) => (
          <a
            key={u.displayUsername}
            href={`/${u.displayUsername}`}
            style={{
              display: 'block',
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #1e293b',
              textDecoration: 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/og/profile/${u.displayUsername}?${ogVersionParam()}`}
              alt={`${u.displayUsername}'s constellation`}
              width={300}
              height={157}
              style={{ display: 'block' }}
            />
            <div
              style={{
                padding: '8px 12px',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              @{u.displayUsername}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
