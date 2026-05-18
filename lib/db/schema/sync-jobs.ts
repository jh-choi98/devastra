import 'server-only'

import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    progress: jsonb('progress'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sync_jobs_user_started_at_idx').on(table.userId, table.startedAt)],
)
