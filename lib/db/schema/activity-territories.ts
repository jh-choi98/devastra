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
  },
  (table) => [primaryKey({ columns: [table.activityId, table.territoryType] })],
)
