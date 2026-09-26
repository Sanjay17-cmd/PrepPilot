/**
 * Roadmap service (P2-9)
 * - One Gemini call via Edge Function per roadmap generation
 * - Saves roadmap + phases + topics to DB
 * - Supports multiple roadmaps, rename, set active
 */
import { supabase } from '../../lib/supabase'
import type { SkillRow } from '../assessment/skillService'

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
export interface RoadmapPhase {
  id?: string
  title: string
  description: string
  duration_days: number
  display_order: number
  status: 'not_started' | 'in_progress' | 'completed' | 'paused'
  topics: RoadmapPhaseTopic[]
}

export interface RoadmapPhaseTopic {
  id?: string
  topic: string
  priority: 'high' | 'medium' | 'low'
  estimated_minutes: number
  status: 'not_started' | 'in_progress' | 'completed'
}

export interface RoadmapWithPhases {
  id: string
  name: string
  status: string
  created_at: string
  role?: { name: string } | null
  phases: RoadmapPhase[]
}

// -------------------------------------------------------------------------
// AI Gateway request — generates roadmap via Gemini
// -------------------------------------------------------------------------
export async function generateRoadmapViaAI(
  studentId: string,
  roleName: string,
  roleSlug: string,
  skills: SkillRow[],
  dailyMinutes: number,
): Promise<{ phases: RoadmapPhase[]; aiRunId: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const resp = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      feature: 'roadmap_generation',
      student_id: studentId,
      input: {
        role_name: roleName,
        role_slug: roleSlug,
        skills,
        daily_minutes: dailyMinutes,
        weak_topics: skills.filter(s => s.score < 50).map(s => s.topic),
        strong_topics: skills.filter(s => s.score >= 70).map(s => s.topic),
      },
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Roadmap generation failed: ${err}`)
  }

  const result = await resp.json()
  const phases: RoadmapPhase[] = result.phases ?? []
  return { phases, aiRunId: result.ai_run_id ?? '' }
}

// -------------------------------------------------------------------------
// Save generated roadmap to DB
// -------------------------------------------------------------------------
export async function saveRoadmap(
  studentId: string,
  roleId: string,
  name: string,
  phases: RoadmapPhase[],
  aiRunId?: string,
): Promise<string> {
  // Insert roadmap
  const { data: roadmap, error: rErr } = await supabase
    .from('roadmaps')
    .insert({
      student_id: studentId,
      role_id: roleId,
      name,
      status: 'active',
      metadata: { ai_run_id: aiRunId ?? null },
    })
    .select('id')
    .single()

  if (rErr) throw new Error(`Failed to save roadmap: ${rErr.message}`)
  const roadmapId = roadmap.id

  // Insert phases
  for (const phase of phases) {
    const { data: phaseRow, error: phErr } = await supabase
      .from('roadmap_phases')
      .insert({
        roadmap_id:    roadmapId,
        title:         phase.title,
        description:   phase.description,
        display_order: phase.display_order,
        duration_days: phase.duration_days,
        status:        'not_started',
      })
      .select('id')
      .single()

    if (phErr) { console.error('Phase insert error:', phErr.message); continue }

    // Insert topics
    if (phase.topics?.length) {
      await supabase.from('roadmap_phase_topics').insert(
        phase.topics.map(t => ({
          phase_id:          phaseRow.id,
          topic:             t.topic,
          priority:          t.priority,
          estimated_minutes: t.estimated_minutes,
          status:            'not_started',
        }))
      )
    }
  }

  return roadmapId
}

// -------------------------------------------------------------------------
// Load all roadmaps for a student (with phases + topics)
// -------------------------------------------------------------------------
export async function loadRoadmaps(studentId: string): Promise<RoadmapWithPhases[]> {
  const { data: roadmaps, error } = await supabase
    .from('roadmaps')
    .select('id, name, status, created_at, roles(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error || !roadmaps) return []

  const result: RoadmapWithPhases[] = []
  for (const rm of roadmaps) {
    const { data: phases } = await supabase
      .from('roadmap_phases')
      .select('*, roadmap_phase_topics(*)')
      .eq('roadmap_id', rm.id)
      .order('display_order')

    result.push({
      id:         rm.id,
      name:       rm.name,
      status:     rm.status,
      created_at: rm.created_at,
      role:       (rm as any).roles ?? null,
      phases: (phases ?? []).map((p: any) => ({
        id:            p.id,
        title:         p.title,
        description:   p.description,
        duration_days: p.duration_days,
        display_order: p.display_order,
        status:        p.status,
        topics:        (p.roadmap_phase_topics ?? []).map((t: any) => ({
          id:                t.id,
          topic:             t.topic,
          priority:          t.priority,
          estimated_minutes: t.estimated_minutes,
          status:            t.status,
        })),
      })),
    })
  }

  return result
}

// -------------------------------------------------------------------------
// Mark active roadmap
// -------------------------------------------------------------------------
export async function setActiveRoadmap(studentId: string, roadmapId: string): Promise<void> {
  // Archive all others
  await supabase
    .from('roadmaps')
    .update({ status: 'archived' })
    .eq('student_id', studentId)
    .neq('id', roadmapId)

  await supabase
    .from('roadmaps')
    .update({ status: 'active' })
    .eq('id', roadmapId)
}

// -------------------------------------------------------------------------
// Update phase status
// -------------------------------------------------------------------------
export async function updatePhaseStatus(
  phaseId: string,
  status: RoadmapPhase['status'],
): Promise<void> {
  await supabase.from('roadmap_phases').update({ status }).eq('id', phaseId)
}
