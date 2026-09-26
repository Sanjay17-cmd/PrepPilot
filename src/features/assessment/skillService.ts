/**
 * Skill profile service.
 * Derives per-topic skill scores from assessment results and inserts rows
 * into student_skills (append-only — never update, never delete).
 */
import { supabase } from '../../lib/supabase'
import type { AssessmentResult } from './assessmentTypes'

// -------------------------------------------------------------------------
// Upsert skills from a completed assessment result
// -------------------------------------------------------------------------
export async function upsertSkillsFromResult(
  studentId: string,
  roleId: string,
  attemptId: string,
  result: AssessmentResult,
): Promise<void> {
  if (!result.topicScores.length) return

  const rows = result.topicScores.map(ts => ({
    student_id:   studentId,
    role_id:      roleId,
    topic:        ts.topic,
    score:        ts.percentage,
    attempt_id:   attemptId,
    measured_at:  new Date().toISOString(),
    metadata_json: {
      correct: ts.correct,
      total:   ts.total,
    },
  }))

  const { error } = await supabase
    .from('student_skills')
    .insert(rows)

  if (error) console.error('Failed to upsert skills:', error.message)
}

// -------------------------------------------------------------------------
// Load latest skill profile for a student + role
// -------------------------------------------------------------------------
export interface SkillRow {
  topic:       string
  score:       number
  measured_at: string
}

export async function loadLatestSkills(
  studentId: string,
  roleId?: string,
): Promise<SkillRow[]> {
  let q = supabase
    .from('student_latest_skills')
    .select('topic, score, measured_at')
    .eq('student_id', studentId)

  if (roleId) q = q.eq('role_id', roleId)

  const { data } = await q
  return (data ?? []) as SkillRow[]
}

// -------------------------------------------------------------------------
// Compute placement readiness from skill rows (weighted average)
// -------------------------------------------------------------------------
export function computeReadiness(skills: SkillRow[]): number {
  if (!skills.length) return 0
  const avg = skills.reduce((sum, s) => sum + Number(s.score), 0) / skills.length
  return Math.round(avg)
}

// -------------------------------------------------------------------------
// Readiness tier label
// -------------------------------------------------------------------------
export type ReadinessTier = 'not-ready' | 'developing' | 'almost-there' | 'ready'

export function getReadinessTier(pct: number): ReadinessTier {
  if (pct >= 80) return 'ready'
  if (pct >= 60) return 'almost-there'
  if (pct >= 40) return 'developing'
  return 'not-ready'
}

export const READINESS_LABELS: Record<ReadinessTier, string> = {
  'not-ready':    'Needs Work',
  'developing':   'Developing',
  'almost-there': 'Almost Ready',
  'ready':        'Placement Ready',
}

export const READINESS_COLORS: Record<ReadinessTier, string> = {
  'not-ready':    'var(--color-danger-600)',
  'developing':   'var(--color-warning-600)',
  'almost-there': 'var(--color-accent-600)',
  'ready':        'var(--color-success-600)',
}
