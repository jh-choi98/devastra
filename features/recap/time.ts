// No server-only: these are pure date helpers usable anywhere

/**
 * Returns Monday 00:00 UTC of the most recently completed full UTC week.
 * E.g. if called on Sunday 2026-05-17, returns Monday 2026-05-11 00:00 UTC.
 */
export function computeLastFullWeekUtcMonday(now = new Date()): Date {
  // Day-of-week in UTC (0=Sun, 1=Mon, ..., 6=Sat)
  const dow = now.getUTCDay()
  // Days since last Monday: Mon=0, Tue=1, ..., Sun=6
  const daysSinceMonday = (dow + 6) % 7
  // Start of the current UTC week (Monday 00:00 UTC)
  const thisWeekMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
  )
  // Previous week: subtract 7 days
  return new Date(thisWeekMonday.getTime() - 7 * 24 * 60 * 60 * 1000)
}

/**
 * Returns the Date for this Sunday 18:00 in the given IANA timezone.
 * If that moment is already past, returns the same Sunday 18:00 (send immediately).
 */
export function computeSendAtSundayLocal(timezone: string, now = new Date()): Date {
  const tz = timezone || 'UTC'

  // Find the next (or current) Sunday in local time by stepping forward from now
  // until we hit a Sunday, then set time to 18:00 local.
  const msPerDay = 24 * 60 * 60 * 1000
  for (let offsetDays = 0; offsetDays <= 7; offsetDays++) {
    const candidate = new Date(now.getTime() + offsetDays * msPerDay)
    const parts = getLocalParts(candidate, tz)
    if (parts.weekday === 0) {
      // Sunday
      // Build a UTC timestamp that corresponds to 18:00 local on this calendar date
      const localNoon = buildLocalDate(parts.year, parts.month, parts.day, 18, 0, tz)
      return localNoon
    }
  }
  // Fallback: 7 days out (should never happen)
  return new Date(now.getTime() + 7 * msPerDay)
}

type LocalParts = { year: number; month: number; day: number; weekday: number }

function getLocalParts(date: Date, tz: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdayStr = get('weekday') // 'Sun', 'Mon', ...
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    weekday: weekdayMap[weekdayStr] ?? 0,
  }
}

/**
 * Build a UTC Date that corresponds to year/month/day HH:MM in the given timezone.
 * Uses binary search to find the correct UTC offset.
 */
function buildLocalDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  // Start with a naive UTC guess and correct using the actual offset
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute))
  // Get what local time naiveUtc maps to
  const local = getLocalParts(naiveUtc, tz)
  const localHour = getLocalHour(naiveUtc, tz)
  // Compute approximate offset in minutes
  const approxOffsetMs =
    naiveUtc.getTime() -
    Date.UTC(local.year, local.month - 1, local.day, localHour.hour, localHour.minute)
  // Apply offset to get the correct UTC instant
  return new Date(naiveUtc.getTime() + approxOffsetMs)
}

function getLocalHour(date: Date, tz: string): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return { hour: parseInt(get('hour'), 10), minute: parseInt(get('minute'), 10) }
}
