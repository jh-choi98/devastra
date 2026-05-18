import 'server-only'

import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const systemMessages = pgTable('system_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  message: text('message').notNull(),
  // enum: 'info' | 'warning' | 'error'
  severity: text('severity').notNull().default('info'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})
