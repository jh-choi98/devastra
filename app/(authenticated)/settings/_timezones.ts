const FALLBACK_TIMEZONES = [
  'UTC',
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
] as const

const WEEKLY_RECAP_LOCAL_TIME_LABEL = '6:00 PM'

type TimezonePreviewOptions = {
  emailRecapsEnabled?: boolean
}

function getRuntimeTimezones(): string[] {
  if (typeof Intl.supportedValuesOf !== 'function') return []
  return Intl.supportedValuesOf('timeZone')
}

export function getTimezoneOptions(currentTimezone: string): string[] {
  return Array.from(
    new Set([...FALLBACK_TIMEZONES, ...getRuntimeTimezones(), currentTimezone].filter(Boolean)),
  ).sort()
}

export function isSupportedTimezone(timezone: string): boolean {
  if (!getTimezoneOptions(timezone).includes(timezone)) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0))
    return true
  } catch {
    return false
  }
}

export function getTimezonePreviewLine(
  timezone: string,
  options: TimezonePreviewOptions = {},
): string {
  if (options.emailRecapsEnabled === false) return 'Dates are shown in this timezone.'
  if (!isSupportedTimezone(timezone)) return 'Your weekly recap arrives Sunday in this timezone.'

  return `Your weekly recap arrives Sunday at ${WEEKLY_RECAP_LOCAL_TIME_LABEL} in this timezone.`
}
