import 'server-only'

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const usernameHistory = pgTable('username_history', {
  oldUsername: text('old_username').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
})
