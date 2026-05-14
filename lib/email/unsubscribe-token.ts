import 'server-only'
import { SignJWT, jwtVerify } from 'jose'

type UnsubscribePayload = {
  user_id: string
  email_type: 'weekly_recap_active' | 'weekly_recap_empty' | 'weekly_recap_first_week'
  version: number
}

function getSecret(): Uint8Array {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_TOKEN_SECRET is not configured')
  return new TextEncoder().encode(secret)
}

function getCurrentVersion(): number {
  return Number(process.env.UNSUBSCRIBE_TOKEN_VERSION ?? '1')
}

export async function signUnsubscribeToken(
  userId: string,
  emailType: UnsubscribePayload['email_type'],
): Promise<string> {
  return new SignJWT({ user_id: userId, email_type: emailType, version: getCurrentVersion() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    // No setExpirationTime — tokens must remain valid for old emails
    .sign(getSecret())
}

export type VerifyResult =
  | { ok: true; payload: UnsubscribePayload }
  | { ok: false; reason: 'invalid_signature' | 'invalid_payload' | 'version_mismatch' }

export async function verifyUnsubscribeToken(token: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (
      typeof payload.user_id !== 'string' ||
      typeof payload.email_type !== 'string' ||
      typeof payload.version !== 'number'
    ) {
      return { ok: false, reason: 'invalid_payload' }
    }
    if (payload.version !== getCurrentVersion()) {
      return { ok: false, reason: 'version_mismatch' }
    }
    return {
      ok: true,
      payload: payload as unknown as UnsubscribePayload,
    }
  } catch {
    return { ok: false, reason: 'invalid_signature' }
  }
}
