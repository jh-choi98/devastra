import 'server-only'

import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const emailSends = pgTable(
  'email_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailType: text('email_type').notNull(),
    relatedId: uuid('related_id'),
    externalMessageId: text('external_message_id'),
    bounced: boolean('bounced').notNull().default(false),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('email_sends_user_sent_at_idx').on(table.userId, table.sentAt)],
)
