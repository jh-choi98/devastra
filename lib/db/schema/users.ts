import { pgTable, uuid, bigint, text, boolean, timestamp, customType } from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
  githubLogin: text('github_login').notNull(),
  displayUsername: text('display_username').notNull().unique(),
  email: text('email').notNull(),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').notNull().default('UTC'),
  isPublic: boolean('is_public').notNull().default(false),
  emailRecapEnabled: boolean('email_recap_enabled').notNull().default(true),
  githubAccessTokenEnc: bytea('github_access_token_enc'),
  githubRefreshTokenEnc: bytea('github_refresh_token_enc'),
  githubTokenExpiresAt: timestamp('github_token_expires_at', { withTimezone: true }),
  lastEventId: text('last_event_id'),
  lastIncrementalSyncAt: timestamp('last_incremental_sync_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
