import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { db } from './client'

// TODO (Phase 3/4): Wire up real Vault key retrieval once the Supabase Vault secret
// 'devatlas_token_encryption_key' is provisioned in the project.
async function getEncryptionKey(): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await (supabase.schema('vault') as ReturnType<typeof supabase.schema>)
    .from('decrypted_secrets')
    .select('name, decrypted_secret')
  if (error || !data) {
    throw new Error('Vault key not available — ensure devatlas_token_encryption_key is provisioned')
  }
  const secret = (data as Array<{ name: string; decrypted_secret: string }>).find(
    (s) => s.name === 'devatlas_token_encryption_key',
  )
  if (!secret) {
    throw new Error('Vault secret devatlas_token_encryption_key not found')
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
