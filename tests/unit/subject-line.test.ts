import { describe, it, expect } from 'vitest'
import { buildSubjectLine } from '@/features/recap/subject-line'

describe('buildSubjectLine', () => {
  it('empty', () => {
    expect(buildSubjectLine({ kind: 'empty', subject_pick: 'empty', preview_text: '' })).toBe('Your sky — this week')
  })

  it('first_week', () => {
    expect(buildSubjectLine({ kind: 'first_week', subject_pick: 'first_week', preview_text: '' })).toBe('Your first week on DevAstra')
  })

  it('stage_up priority', () => {
    const subj = buildSubjectLine({
      kind: 'active',
      slot_1: { kind: 'stage_up', cluster_type: 'backend_fortress', from_stage: 1, to_stage: 2 },
      subject_pick: 'stage_up_backend_fortress',
      preview_text: '',
    })
    expect(subj).toBe('Backend cluster expanded')
  })

  it('new stars without stage_up', () => {
    const subj = buildSubjectLine({
      kind: 'active',
      slot_2: { kind: 'new_stars', tech_keys: ['docker', 'postgres'] },
      subject_pick: 'new_stars_2',
      preview_text: '',
    })
    expect(subj).toBe('2 new stars this week')
  })

  it('one new star uses tech name', () => {
    const subj = buildSubjectLine({
      kind: 'active',
      slot_2: { kind: 'new_stars', tech_keys: ['docker'] },
      subject_pick: 'new_stars_1',
      preview_text: '',
    })
    expect(subj).toBe('Docker is new this week')
  })
})
