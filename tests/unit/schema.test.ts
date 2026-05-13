import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  users,
  repositories,
  activities,
  activityTerritories,
  territories,
  landmarks,
  syncJobs,
  weeklyRecaps,
  emailSends,
} from '../../lib/db/schema'

describe('schema', () => {
  it('users table is defined', () => {
    expect(users).toBeDefined()
    expect(getTableName(users)).toBe('users')
  })

  it('repositories table is defined', () => {
    expect(repositories).toBeDefined()
    expect(getTableName(repositories)).toBe('repositories')
  })

  it('activities table is defined', () => {
    expect(activities).toBeDefined()
    expect(getTableName(activities)).toBe('activities')
  })

  it('activityTerritories table is defined', () => {
    expect(activityTerritories).toBeDefined()
    expect(getTableName(activityTerritories)).toBe('activity_territories')
  })

  it('territories table is defined', () => {
    expect(territories).toBeDefined()
    expect(getTableName(territories)).toBe('territories')
  })

  it('landmarks table is defined', () => {
    expect(landmarks).toBeDefined()
    expect(getTableName(landmarks)).toBe('landmarks')
  })

  it('syncJobs table is defined', () => {
    expect(syncJobs).toBeDefined()
    expect(getTableName(syncJobs)).toBe('sync_jobs')
  })

  it('weeklyRecaps table is defined', () => {
    expect(weeklyRecaps).toBeDefined()
    expect(getTableName(weeklyRecaps)).toBe('weekly_recaps')
  })

  it('emailSends table is defined', () => {
    expect(emailSends).toBeDefined()
    expect(getTableName(emailSends)).toBe('email_sends')
  })

  it('users table has expected columns', () => {
    const cols = Object.keys(users)
    expect(cols).toContain('id')
    expect(cols).toContain('githubId')
    expect(cols).toContain('displayUsername')
    expect(cols).toContain('githubAccessTokenEnc')
    expect(cols).toContain('githubRefreshTokenEnc')
  })

  it('territories table has composite PK columns', () => {
    const cols = Object.keys(territories)
    expect(cols).toContain('userId')
    expect(cols).toContain('type')
  })

  it('landmarks table has composite PK columns', () => {
    const cols = Object.keys(landmarks)
    expect(cols).toContain('userId')
    expect(cols).toContain('techKey')
  })
})
