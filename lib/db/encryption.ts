import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from './client'

// TODO (Phase 3/4): Wire up real Vault key retrieval once the Supabase Vault secret
// 'devastra_token_encryption_key' is provisioned in the project.
const TOKEN_ENCRYPTION_KEY_SECRET_NAME = 'devastra_token_encryption_key'

async function getEncryptionKey(): Promise<string> {
  const result = await db.execute<{ decrypted_secret: string }>(
    sql`
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = ${TOKEN_ENCRYPTION_KEY_SECRET_NAME}
      LIMIT 1
    `,
  )
  const [secret] = result as unknown as Array<{ decrypted_secret: string }>
  if (!secret) {
    throw new Error(`Vault secret ${TOKEN_ENCRYPTION_KEY_SECRET_NAME} not found`)
  }
  return secret.decrypted_secret
}

export async function encryptToken(plaintext: string): Promise<Buffer> {
  const key = await getEncryptionKey()
  const result = await db.execute<{ encrypted: Buffer }>(
    sql`SELECT pgp_sym_encrypt(${plaintext}, ${key})::bytea AS encrypted`,
  )
  return (result as unknown as Array<{ encrypted: Buffer }>)[0].encrypted
}

export async function decryptToken(ciphertext: Buffer): Promise<string> {
  const key = await getEncryptionKey()
  const result = await db.execute<{ decrypted: string }>(
    sql`SELECT pgp_sym_decrypt(${ciphertext}::bytea, ${key}) AS decrypted`,
  )
  return (result as unknown as Array<{ decrypted: string }>)[0].decrypted
}
