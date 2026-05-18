import 'server-only'

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { repositories } from './repositories'

export const misclassificationFeedback = pgTable(
  'misclassification_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    techKey: text('tech_key').notNull(),
    territoryType: text('territory_type').notNull(),
    relatedRepoId: uuid('related_repo_id').references(() => repositories.id, { onDelete: 'set null' }),
    // enum: 'wrong_category' | 'shouldnt_be_lit' | 'not_mine' | 'other'
    category: text('category').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('misclassification_feedback_user_created_idx').on(table.userId, table.createdAt),
    index('misclassification_feedback_tech_created_idx').on(table.techKey, table.createdAt),
  ],
)
