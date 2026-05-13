import { pgTable, uuid, text, jsonb, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

export const weeklyRecaps = pgTable(
  'weekly_recaps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    highlights: jsonb('highlights').notNull(),
    ogImageUrl: text('og_image_url'),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('weekly_recaps_user_week_start_idx').on(table.userId, table.weekStart),
  ],
)
