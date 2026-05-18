import 'server-only'

import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, numeric, primaryKey } from 'drizzle-orm/pg-core'
import { activities } from './activities'

export const activityTerritories = pgTable(
  'activity_territories',
  {
    activityId: uuid('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    territoryType: text('territory_type').notNull(),
    weight: numeric('weight').notNull(),
    techKeys: text('tech_keys')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (table) => [primaryKey({ columns: [table.activityId, table.territoryType] })],
)
