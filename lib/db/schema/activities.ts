import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { repositories } from './repositories'

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('github'),
    externalId: text('external_id').notNull(),
    type: text('type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    raw: jsonb('raw').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('activities_user_source_external_id_idx').on(
      table.userId,
      table.source,
      table.externalId,
    ),
    index('activities_user_occurred_at_idx').on(table.userId, table.occurredAt),
    index('activities_repo_occurred_at_idx').on(table.repoId, table.occurredAt),
  ],
)
