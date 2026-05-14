import { pgTable, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core'

export const techGlobalStats = pgTable('tech_global_stats', {
  techKey: text('tech_key').primaryKey(),
  litUserCount: integer('lit_user_count').notNull().default(0),
  eligibleUserCount: integer('eligible_user_count').notNull().default(0),
  litPercentage: numeric('lit_percentage').notNull().default('0'),
  computedAt: timestamp('computed_at', { withTimezone: true }),
})
