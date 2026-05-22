import 'server-only'

export function isEmailRecapFeatureEnabled(): boolean {
  return process.env.ENABLE_EMAIL_RECAPS === '1'
}
