import 'server-only'

export const EVENTS = {
  SYNC_INITIAL_REQUESTED: 'sync/initial.requested',
  SYNC_INCREMENTAL_SCHEDULED: 'sync/incremental.scheduled',
  SYNC_MANUAL_REQUESTED: 'sync/manual.requested',
  SYNC_BACKFILL_REQUESTED: 'sync/backfill.requested',
  SYNC_CLEANUP_SCHEDULED: 'sync/cleanup.scheduled',
  // recap events declared here; bodies in Phase 10
  RECAP_WEEKLY_GENERATED: 'recap/weekly.generated',
  RECAP_EMAIL_SEND: 'recap/email.send',
} as const
