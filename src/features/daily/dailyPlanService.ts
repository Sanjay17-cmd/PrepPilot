/**
 * Daily Plan service (P2-11)
 * - Generates daily tasks via AI gateway (one call per day per student)
 * - On reload: loads existing plan — NO Gemini re-call
 * - Task status updates are pure DB writes
 */
import { supabase } from '../../lib/supabase'

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
export interface Task {
  id: string
  topic: string
  title: string
  description: string | null
  estimated_minutes: number | null
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  display_order: number
}

export interface DailyPlan {
  id: string
  plan_date: string
  status: string
  tasks: Task[]
}

// -------------------------------------------------------------------------
// Load today's plan (if exists)
// -------------------------------------------------------------------------
function todayStr(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

export async function loadTodayPlan(studentId: string): Promise<DailyPlan | null> {
  const { data: plan, error } = await supabase
    .from('daily_plans')
    .select('id, plan_date, status')
    .eq('student_id', studentId)
    .eq('plan_date', todayStr())
    .maybeSingle()

  if (error || !plan) return null

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, topic, title, description, estimated_minutes, priority, status, display_order')
    .eq('daily_plan_id', plan.id)
    .order('display_order')

  return {
    id:         plan.id,
    plan_date:  plan.plan_date,
    status:     plan.status,
    tasks:      (tasks ?? []) as Task[],
  }
}

// -------------------------------------------------------------------------
// Generate plan via AI gateway and save to DB
// -------------------------------------------------------------------------
export async function generateDailyPlan(
  studentId: string,
  roadmapId: string,
  roleName: string,
): Promise<DailyPlan> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  // Load active phases for context
  const { data: phases } = await supabase
    .from('roadmap_phases')
    .select('title, status, roadmap_phase_topics(topic, priority, status)')
    .eq('roadmap_id', roadmapId)
    .in('status', ['not_started', 'in_progress'])
    .order('display_order')
    .limit(3)

  // Invoke AI gateway
  const { data: raw, error: fnErr } = await supabase.functions.invoke('ai-gateway', {
    body: {
      feature:    'daily_plan_generation',
      student_id: studentId,
      roadmap_context: {
        role_name:     roleName,
        active_phases: phases ?? [],
        plan_date:     todayStr(),
      },
    },
  })

  let result = raw
  let aiTasks: Array<{
    topic: string; title: string; description: string;
    estimated_minutes: number; priority: string;
  }> = []

  if (result) {
    const rawTasks: any[] = result.tasks ?? result.plan?.tasks ?? []
    aiTasks = rawTasks.map((t: any) => ({
      topic:             String(t.topic || 'General Practice'),
      title:             String(t.title || 'Core Problem Solving'),
      description:       String(t.description || ''),
      estimated_minutes: Number(t.estimated_minutes || 45),
      priority:          (['high','medium','low'].includes(t.priority) ? t.priority : 'medium'),
    }))
  }

  // Fallback tasks if AI fails or returns empty
  if (aiTasks.length === 0) {
    console.warn('[DailyPlan] Using structured fallback daily tasks')
    aiTasks = [
      {
        topic: 'DSA Practice',
        title: 'Solve 2 Medium LeetCode Problems',
        description: 'Focus on Array/String two pointers or hashing patterns for interviews.',
        estimated_minutes: 50,
        priority: 'high',
      },
      {
        topic: 'Core Fundamentals',
        title: 'DBMS & SQL Query Optimization',
        description: 'Review indexing, joins, and ACID properties with practical examples.',
        estimated_minutes: 40,
        priority: 'medium',
      },
      {
        topic: 'Mock Assessment',
        title: 'Take 10-Question Placement MCQ Quiz',
        description: 'Assess weak spots and review incorrect answer explanations.',
        estimated_minutes: 30,
        priority: 'medium',
      },
    ]
  }

  // Create daily plan row
  const { data: plan, error: pErr } = await supabase
    .from('daily_plans')
    .insert({
      student_id: studentId,
      roadmap_id: roadmapId,
      ai_run_id:  result?.ai_run_id ?? null,
      plan_date:  todayStr(),
      plan_json:  result ?? { fallback: true },
    })
    .select('id, plan_date, status')
    .single()

  if (pErr) throw new Error(`Failed to save plan: ${pErr.message}`)

  // Insert tasks
  const taskRows = aiTasks.map((t, idx) => ({
    daily_plan_id:     plan.id,
    student_id:        studentId,
    topic:             t.topic,
    title:             t.title,
    description:       t.description || null,
    estimated_minutes: t.estimated_minutes || null,
    priority:          (['high','medium','low'].includes(t.priority) ? t.priority : 'medium') as Task['priority'],
    status:            'pending' as Task['status'],
    display_order:     idx + 1,
  }))

  await supabase.from('tasks').insert(taskRows)

  const insertedTasks = await supabase
    .from('tasks')
    .select('id, topic, title, description, estimated_minutes, priority, status, display_order')
    .eq('daily_plan_id', plan.id)
    .order('display_order')

  return {
    id:         plan.id,
    plan_date:  plan.plan_date,
    status:     plan.status,
    tasks:      (insertedTasks.data ?? []) as Task[],
  }
}

// -------------------------------------------------------------------------
// Update task status (no Gemini — pure DB)
// -------------------------------------------------------------------------
export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
): Promise<void> {
  await supabase.from('tasks').update({ status }).eq('id', taskId)
}

// -------------------------------------------------------------------------
// Ensure today's plan exists (even before AI generation)
// -------------------------------------------------------------------------
export async function ensureTodayPlan(studentId: string, roadmapId?: string): Promise<DailyPlan> {
  const existing = await loadTodayPlan(studentId)
  if (existing) return existing

  const { data: plan, error } = await supabase
    .from('daily_plans')
    .insert({
      student_id: studentId,
      roadmap_id: roadmapId || null,
      plan_date:  todayStr(),
      plan_json:  { custom: true },
    })
    .select('id, plan_date, status')
    .single()

  if (error) throw new Error(error.message)
  return {
    id: plan.id,
    plan_date: plan.plan_date,
    status: plan.status,
    tasks: [],
  }
}

// -------------------------------------------------------------------------
// Add custom task to daily plan
// -------------------------------------------------------------------------
export async function addCustomTask(
  dailyPlanId: string,
  studentId: string,
  data: {
    title: string
    topic?: string
    description?: string
    estimated_minutes?: number
    priority?: 'high' | 'medium' | 'low'
  },
): Promise<Task> {
  const { data: row, error } = await supabase
    .from('tasks')
    .insert({
      daily_plan_id:     dailyPlanId,
      student_id:        studentId,
      topic:             data.topic?.trim() || 'General Task',
      title:             data.title.trim(),
      description:       data.description?.trim() || null,
      estimated_minutes: data.estimated_minutes || 30,
      priority:          data.priority || 'medium',
      status:            'pending',
      display_order:     99,
    })
    .select('id, topic, title, description, estimated_minutes, priority, status, display_order')
    .single()

  if (error) throw new Error(error.message)
  return row as Task
}

// -------------------------------------------------------------------------
// Delete task
// -------------------------------------------------------------------------
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw new Error(error.message)
}

// -------------------------------------------------------------------------
// Load past plans
// -------------------------------------------------------------------------
export async function loadPastPlans(studentId: string, limit = 7): Promise<DailyPlan[]> {
  const { data: plans } = await supabase
    .from('daily_plans')
    .select('id, plan_date, status')
    .eq('student_id', studentId)
    .order('plan_date', { ascending: false })
    .limit(limit)

  if (!plans) return []

  const result: DailyPlan[] = []
  for (const p of plans) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, topic, title, description, estimated_minutes, priority, status, display_order')
      .eq('daily_plan_id', p.id)
      .order('display_order')

    result.push({
      id: p.id, plan_date: p.plan_date, status: p.status,
      tasks: (tasks ?? []) as Task[],
    })
  }
  return result
}
