import { pgTable, uuid, text, numeric, timestamp, primaryKey, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const landmarks = pgTable(
  'landmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    techKey: text('tech_key').notNull(),
    territoryType: text('territory_type').notNull(),
    weight: numeric('weight').notNull().default('0'),
    firstUnlockedAt: timestamp('first_unlocked_at', { withTimezone: true }),
    lastGrownAt: timestamp('last_grown_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.techKey] }),
    index('landmarks_user_territory_type_idx').on(table.userId, table.territoryType),
  ],
)
