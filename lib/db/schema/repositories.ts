import { pgTable, uuid, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('github'),
    externalRepoId: text('external_repo_id').notNull(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    primaryLanguage: text('primary_language'),
    isIncluded: boolean('is_included').notNull().default(true),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('repositories_user_source_external_id_idx').on(
      table.userId,
      table.source,
      table.externalRepoId,
    ),
    index('repositories_user_is_included_idx').on(table.userId, table.isIncluded),
  ],
)
