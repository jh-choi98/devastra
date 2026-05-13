import { pgTable, uuid, text, numeric, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'

export const territories = pgTable(
  'territories',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    totalWeight: numeric('total_weight').notNull().default('0'),
    stage: integer('stage').notNull().default(1),
    stageChangedAt: timestamp('stage_changed_at', { withTimezone: true }),
    lastGrownAt: timestamp('last_grown_at', { withTimezone: true }),
    growth30d: numeric('growth_30d').notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
)
