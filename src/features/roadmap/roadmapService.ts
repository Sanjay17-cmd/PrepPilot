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
function getStarterCurriculum(roleName: string, dailyMinutes: number): RoadmapPhase[] {
  const mins = dailyMinutes || 60
  return [
    {
      title: 'Phase 1: Language Mastery & Core CS',
      description: `Solidify core programming foundations, language mechanics, and memory models for ${roleName}.`,
      duration_days: 14,
      display_order: 1,
      status: 'not_started',
      topics: [
        { topic: 'Language Syntax & Data Types', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Object-Oriented Programming (OOP)', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Arrays, Strings & Hash Tables', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'DBMS & Relational SQL', priority: 'medium', estimated_minutes: mins, status: 'not_started' },
      ],
    },
    {
      title: 'Phase 2: Data Structures & Core Algorithms',
      description: 'Master key placement problem-solving patterns: two pointers, stacks, queues, and recursion.',
      duration_days: 21,
      display_order: 2,
      status: 'not_started',
      topics: [
        { topic: 'Linked Lists, Stacks & Queues', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Binary Search & Sorting Patterns', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Recursion & Backtracking', priority: 'medium', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Operating Systems & Threading', priority: 'medium', estimated_minutes: mins, status: 'not_started' },
      ],
    },
    {
      title: 'Phase 3: Trees, Graphs & Advanced Patterns',
      description: 'Tackle non-linear structures, graph traversals, and dynamic programming fundamentals.',
      duration_days: 21,
      display_order: 3,
      status: 'not_started',
      topics: [
        { topic: 'Binary Trees & BST Traversals', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'BFS, DFS & Graph Algorithms', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Dynamic Programming Patterns', priority: 'medium', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Computer Networks & HTTP', priority: 'medium', estimated_minutes: mins, status: 'not_started' },
      ],
    },
    {
      title: 'Phase 4: Placement Readiness & Mock Interviews',
      description: 'System design basics, resume review, mock assessment MCQs, and final interview prep.',
      duration_days: 14,
      display_order: 4,
      status: 'not_started',
      topics: [
        { topic: 'System Design & Scalability Basics', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Timed MCQ Speed Drills', priority: 'high', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Resume ATS Alignment & Project Q&A', priority: 'medium', estimated_minutes: mins, status: 'not_started' },
        { topic: 'Behavioral & HR Prep', priority: 'medium', estimated_minutes: mins, status: 'not_started' },
      ],
    },
  ]
}

export async function generateRoadmapViaAI(
  studentId: string,
  roleName: string,
  roleSlug: string,
  skills: SkillRow[],
  dailyMinutes: number,
): Promise<{ phases: RoadmapPhase[]; aiRunId: string }> {
  const { data: raw, error: fnErr } = await supabase.functions.invoke('ai-gateway', {
    body: {
      feature:    'roadmap_generation',
      student_id: studentId,
      student_state: {
        role_name:     roleName,
        role_slug:     roleSlug,
        skills,
        daily_minutes: dailyMinutes,
        weak_topics:   skills.filter(s => s.score < 50).map(s => s.topic),
        strong_topics: skills.filter(s => s.score >= 70).map(s => s.topic),
      },
    },
  })

  let result = raw
  if (fnErr || !result) {
    console.warn('[Roadmap] Gateway error or empty response, using starter curriculum:', fnErr?.message)
    return {
      phases:  getStarterCurriculum(roleName, dailyMinutes),
      aiRunId: '',
    }
  }

  // Handle both { roadmap: { phases } } and { phases }
  const rawPhases: any[] = result.phases ?? result.roadmap?.phases ?? (Array.isArray(result) ? result : [])

  const phases: RoadmapPhase[] = rawPhases.map((p, i) => ({
    title:         String(p.title || `Phase ${i + 1}`),
    description:   String(p.description || ''),
    duration_days: Number(p.duration_days || 14),
    display_order: Number(p.display_order ?? (i + 1)),
    status:        'not_started',
    topics: (p.topics || []).map((t: any) => ({
      topic:             String(t.topic || t.name || 'Core Fundamentals'),
      priority:          (t.priority === 'high' || t.priority === 'low') ? t.priority : 'medium',
      estimated_minutes: Number(t.estimated_minutes || dailyMinutes || 60),
      status:            'not_started',
    })),
  }))

  if (phases.length === 0) {
    return {
      phases:  getStarterCurriculum(roleName, dailyMinutes),
      aiRunId: result.ai_run_id ?? '',
    }
  }

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
