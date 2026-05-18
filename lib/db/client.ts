import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type PostgresClient = ReturnType<typeof postgres>

const globalForDb = globalThis as typeof globalThis & {
  devastraPostgresClient?: PostgresClient
}

const client =
  globalForDb.devastraPostgresClient ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: process.env.NODE_ENV === 'production' ? 10 : 3,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.devastraPostgresClient = client
}

export const db = drizzle(client, { schema })
