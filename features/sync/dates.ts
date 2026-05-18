import 'server-only'

export function toSyncDate(value: Date | string | number): Date {
  if (value instanceof Date) return value

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid sync date: ${String(value)}`)
  }

  return date
}

export function toSyncDateOrNull(
  value: Date | string | number | null | undefined,
): Date | null {
  return value == null ? null : toSyncDate(value)
}
