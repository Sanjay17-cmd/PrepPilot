/**
 * Patch Executor (P3-5)
 * Validates, previews, and executes AI-proposed operations against Supabase.
 * Gemini never executes directly — all mutations go through here after student confirmation.
 */
import { supabase } from '../../lib/supabase'
import type { CoachOperation, ProposedPatch } from '../../config/aiFeatures'
import { ALLOWED_OPERATIONS } from '../../config/aiFeatures'
import {
  ensureTodayPlan,
  addCustomTask,
  addMultipleTasks,
  updateTask,
  replaceDailyPlanTasks,
  generateDailyPlan,
} from '../daily/dailyPlanService'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PatchPreview {
  summary: string
  before: Record<string, unknown>[]
  after:  Record<string, unknown>[]
  operations: CoachOperation[]
}

export interface PatchResult {
  success: boolean
  error?: string
  patchId?: string
}

// ─── Resolve task by title or ID (resilient search across recent plans) ───────
async function resolveTaskRecord(
  studentId: string,
  taskId?: string,
  title?: string,
): Promise<{ id: string; title: string; topic?: string; priority?: string; estimated_minutes?: number; status?: string; description?: string } | null> {
  if (taskId) {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, topic, priority, estimated_minutes, status, description, student_id')
      .eq('id', taskId)
      .maybeSingle()
    if (data && data.student_id === studentId) return data
  }

  if (!title || !title.trim()) return null
  const clean = title.trim().replace(/^["']|["']$/g, '')

  // 1. Direct query on tasks table for this student (most recent first)
  const { data: directMatch } = await supabase
    .from('tasks')
    .select('id, title, topic, priority, estimated_minutes, status, description, student_id')
    .eq('student_id', studentId)
    .ilike('title', `%${clean}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (directMatch) return directMatch

  // 2. Split words for fuzzy keyword match if phrase is long
  const words = clean.split(/\s+/).filter(w => w.length > 3)
  for (const word of words) {
    const { data: wordMatch } = await supabase
      .from('tasks')
      .select('id, title, topic, priority, estimated_minutes, status, description, student_id')
      .eq('student_id', studentId)
      .ilike('title', `%${word}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (wordMatch) return wordMatch
  }

  return null
}

// ─── Build before/after preview ───────────────────────────────────────────────
export async function buildPreview(
  studentId: string,
  patch: ProposedPatch,
): Promise<PatchPreview> {
  const before: Record<string, unknown>[] = []
  const after:  Record<string, unknown>[] = []

  for (const op of patch.operations) {
    if (!ALLOWED_OPERATIONS.has(op.operation)) continue

    // Complete or Reopen task
    if (op.operation === 'complete_task' || op.operation === 'reopen_task') {
      const task = await resolveTaskRecord(studentId, op.task_id, op.task_title)
      if (!task) {
        before.push({ type: 'task', title: op.task_title ?? 'Task', status: 'not found' })
        after.push({ type: 'task', title: op.task_title ?? 'Task', status: op.operation === 'complete_task' ? 'completed' : 'pending' })
        continue
      }
      before.push({ type: 'task', title: task.title, status: task.status ?? 'pending' })
      after.push({ type: 'task', title: task.title, status: op.operation === 'complete_task' ? 'completed' : 'pending' })
    }

    // Move task
    if (op.operation === 'move_task') {
      const task = await resolveTaskRecord(studentId, op.task_id, op.task_title)
      const taskTitle = task?.title ?? op.task_title ?? 'Task'
      before.push({ type: 'task_move', title: taskTitle, from: op.from_date ?? 'today' })
      after.push({ type: 'task_move', title: taskTitle, to: op.to_date ?? 'rescheduled date' })
    }

    // Pause / Resume roadmap
    if (op.operation === 'pause_roadmap' || op.operation === 'resume_roadmap') {
      const { data: rm } = await supabase
        .from('roadmaps')
        .select('name, status')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      before.push({ type: 'roadmap', name: rm?.name ?? 'Roadmap', status: rm?.status ?? 'active' })
      after.push({ type: 'roadmap', name: rm?.name ?? 'Roadmap', status: op.operation === 'pause_roadmap' ? 'paused' : 'active' })
    }

    // Rename roadmap
    if (op.operation === 'rename_roadmap') {
      const { data: rm } = await supabase
        .from('roadmaps')
        .select('name')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      before.push({ type: 'roadmap', name: rm?.name ?? 'Roadmap' })
      after.push({ type: 'roadmap', name: op.new_name ?? 'Renamed Roadmap' })
    }

    // Remove task
    if (op.operation === 'remove_task') {
      const task = await resolveTaskRecord(studentId, op.task_id, op.task_title)
      before.push({ type: 'task', title: task?.title ?? op.task_title ?? 'Task', status: 'active' })
      after.push({ type: 'task', title: task?.title ?? op.task_title ?? 'Task', status: 'removed' })
    }

    // Add task
    if (op.operation === 'add_task') {
      before.push({ type: 'task', title: '(None)', status: 'not scheduled' })
      const title = op.task_title || op.title || 'New Task'
      const mins = op.estimated_minutes ? ` (${op.estimated_minutes}m)` : ''
      const prio = op.priority ? ` [${op.priority}]` : ''
      after.push({ type: 'task', title: `${title}${mins}${prio}`, status: 'pending' })
    }

    // Create daily plan
    if (op.operation === 'create_daily_plan') {
      if (op.tasks && Array.isArray(op.tasks) && op.tasks.length > 0) {
        before.push({ type: 'daily_plan', title: 'Today\'s Daily Plan', note: 'Create or append tasks' })
        for (const t of op.tasks) {
          after.push({
            type: 'task',
            title: `${t.title} (${t.estimated_minutes ?? 30}m, ${t.priority ?? 'medium'})`,
            status: 'scheduled',
          })
        }
      } else if (op.task_title || op.title) {
        const title = op.task_title || op.title || 'New Task'
        before.push({ type: 'task', title: '(None)', status: 'not scheduled' })
        after.push({
          type: 'task',
          title: `${title} (${op.estimated_minutes ?? 30}m, ${op.priority ?? 'medium'})`,
          status: 'pending',
        })
      } else {
        before.push({ type: 'daily_plan', title: 'Daily Plan', note: 'No plan currently generated for today' })
        after.push({ type: 'daily_plan', title: 'Today\'s Plan', note: 'Generate placement study plan' })
      }
    }

    // Regenerate daily plan
    if (op.operation === 'regenerate_daily_plan') {
      before.push({ type: 'daily_plan', title: 'Current Daily Plan', note: 'Replace pending study tasks' })
      after.push({ type: 'daily_plan', title: 'Fresh Daily Plan', note: 'New tailored practice tasks generated' })
    }

    // Modify task / update task
    if (op.operation === 'modify_task' || op.operation === 'update_task') {
      const task = await resolveTaskRecord(studentId, op.task_id, op.task_title || op.title)
      const currentTitle = task?.title ?? op.task_title ?? op.title ?? 'Task'
      const newTitle = op.new_title || (op.title && op.title !== currentTitle ? op.title : currentTitle)
      const newMins = op.new_estimated_minutes || op.estimated_minutes || task?.estimated_minutes || 30
      const newPrio = op.new_priority || op.priority || task?.priority || 'medium'
      const newTopic = op.new_topic || op.topic || task?.topic || 'General'

      before.push({
        type: 'task_modify',
        title: currentTitle,
        topic: task?.topic ?? 'General',
        priority: task?.priority ?? 'medium',
        minutes: task?.estimated_minutes ?? 30,
        status: task?.status ?? 'pending',
      })
      after.push({
        type: 'task_modify',
        title: newTitle,
        topic: newTopic,
        priority: newPrio,
        minutes: newMins,
        status: op.status ?? task?.status ?? 'pending',
      })
    }

    // Modify tasks (bulk JSON update)
    if (op.operation === 'modify_tasks') {
      const taskCount = op.tasks?.length ?? 0
      before.push({ type: 'tasks_json', note: 'Current daily tasks' })
      after.push({
        type: 'tasks_json',
        note: `Update to ${taskCount} tasks via JSON`,
        items: op.tasks?.map(t => `${t.title} (${t.estimated_minutes ?? 30}m, ${t.priority ?? 'medium'})`) ?? [],
      })
    }

    // Update daily study minutes
    if (op.operation === 'update_daily_minutes') {
      before.push({ type: 'study_time', minutes: 'Current daily target' })
      after.push({ type: 'study_time', minutes: `${op.daily_minutes ?? 60} minutes/day` })
    }
  }

  return {
    summary: patch.summary,
    before,
    after,
    operations: patch.operations,
  }
}

// ─── Execute confirmed patch ───────────────────────────────────────────────────
export async function executePatch(
  studentId: string,
  chatId: string | null,
  patch: ProposedPatch,
  preview: PatchPreview,
): Promise<PatchResult> {
  // Validate all operations are allowed
  const invalid = patch.operations.filter(op => !ALLOWED_OPERATIONS.has(op.operation))
  if (invalid.length > 0) {
    return { success: false, error: `Blocked operation(s): ${invalid.map(o => o.operation).join(', ')}` }
  }

  // Save patch record as "confirmed"
  const { data: patchRecord } = await supabase
    .from('ai_patches')
    .insert({
      student_id:   studentId,
      chat_id:      chatId,
      intent:       'coach_action',
      summary:      patch.summary,
      patch_json:   { operations: patch.operations },
      before_json:  { items: preview.before },
      after_json:   { items: preview.after },
      status:       'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const errors: string[] = []

  for (const op of patch.operations) {
    try {
      await executeOperation(studentId, op)
    } catch (err) {
      errors.push(`${op.operation}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const finalStatus = errors.length === 0 ? 'executed' : 'failed'

  await supabase.from('ai_patches').update({
    status:        finalStatus,
    executed_at:   new Date().toISOString(),
    error_message: errors.join('; ') || null,
  }).eq('id', patchRecord?.id ?? '')

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_user_id: studentId,
    actor_id:      studentId,
    entity_type:   'ai_patch',
    entity_id:     patchRecord?.id ?? null,
    feature:       'ai_coach',
    action:        'patch_executed',
    source:        'AI_CHAT',
    before_json:   { items: preview.before },
    after_json:    { items: preview.after },
    metadata_json: { patch_id: patchRecord?.id, operations: patch.operations },
    metadata:      { patch_id: patchRecord?.id, operations: patch.operations },
  }).select().maybeSingle()

  if (errors.length > 0) {
    return { success: false, error: errors.join('; '), patchId: patchRecord?.id }
  }
  return { success: true, patchId: patchRecord?.id }
}

// ─── Execute a single operation ────────────────────────────────────────────────
async function executeOperation(studentId: string, op: CoachOperation): Promise<void> {
  const resolveTaskId = async (): Promise<string> => {
    const task = await resolveTaskRecord(studentId, op.task_id, op.task_title || op.title)
    if (!task) throw new Error(`Task "${op.task_title || op.title || op.task_id}" not found`)
    return task.id
  }

  switch (op.operation) {
    case 'complete_task': {
      const taskId = await resolveTaskId()
      await updateTask(taskId, { status: 'completed' })
      break
    }

    case 'reopen_task': {
      const taskId = await resolveTaskId()
      await updateTask(taskId, { status: 'pending' })
      break
    }

    case 'remove_task': {
      const taskId = await resolveTaskId()
      await updateTask(taskId, { status: 'skipped' })
      break
    }

    case 'move_task': {
      const taskId = await resolveTaskId()
      await updateTask(taskId, { status: 'skipped' })
      break
    }

    case 'pause_roadmap': {
      await supabase.from('roadmaps').update({ status: 'paused' })
        .eq('student_id', studentId).eq('status', 'active')
      break
    }

    case 'resume_roadmap': {
      await supabase.from('roadmaps').update({ status: 'active' })
        .eq('student_id', studentId).eq('status', 'paused')
      break
    }

    case 'rename_roadmap': {
      if (!op.new_name) throw new Error('No new name provided')
      await supabase.from('roadmaps').update({ name: op.new_name })
        .eq('student_id', studentId).eq('status', 'active')
      break
    }

    case 'add_task': {
      const plan = await ensureTodayPlan(studentId)
      await addCustomTask(plan.id, studentId, {
        title:             op.task_title || op.title || 'Coach Recommended Task',
        topic:             op.topic || 'AI Coach Recommendation',
        description:       op.description || undefined,
        estimated_minutes: op.estimated_minutes || 30,
        priority:          op.priority || 'medium',
      })
      break
    }

    case 'create_daily_plan': {
      const plan = await ensureTodayPlan(studentId)

      // If array of tasks provided in operation, add all of them
      if (op.tasks && Array.isArray(op.tasks) && op.tasks.length > 0) {
        await addMultipleTasks(plan.id, studentId, op.tasks)
      } else if (op.task_title || op.title) {
        // If single task title provided with create_daily_plan
        await addCustomTask(plan.id, studentId, {
          title:             op.task_title || op.title || 'Today Practice',
          topic:             op.topic || 'Daily Plan Task',
          description:       op.description || undefined,
          estimated_minutes: op.estimated_minutes || 30,
          priority:          op.priority || 'medium',
        })
      } else {
        // Check if plan already has tasks. If empty, generate using active roadmap
        const { data: existing } = await supabase.from('tasks').select('id').eq('daily_plan_id', plan.id).limit(1)
        if (!existing || existing.length === 0) {
          const { data: rm } = await supabase
            .from('roadmaps')
            .select('id, name')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .maybeSingle()
          if (rm) {
            await generateDailyPlan(studentId, rm.id, rm.name)
          } else {
            // Fallback default task if no active roadmap exists yet
            await addCustomTask(plan.id, studentId, {
              title:             'Core Placement Problem Solving',
              topic:             'DSA & Fundamentals',
              estimated_minutes: 45,
              priority:          'high',
            })
          }
        }
      }
      break
    }

    case 'regenerate_daily_plan': {
      const plan = await ensureTodayPlan(studentId)
      if (op.tasks && Array.isArray(op.tasks) && op.tasks.length > 0) {
        await replaceDailyPlanTasks(plan.id, studentId, op.tasks)
      } else {
        // Clear pending tasks and regenerate
        await supabase
          .from('tasks')
          .delete()
          .eq('daily_plan_id', plan.id)
          .neq('status', 'completed')

        const { data: rm } = await supabase
          .from('roadmaps')
          .select('id, name')
          .eq('student_id', studentId)
          .eq('status', 'active')
          .maybeSingle()
        if (rm) {
          await generateDailyPlan(studentId, rm.id, rm.name)
        }
      }
      break
    }

    case 'modify_task':
    case 'update_task': {
      const existing = await resolveTaskRecord(studentId, op.task_id, op.task_title || op.title)
      if (existing) {
        await updateTask(existing.id, {
          title:             op.new_title || (op.title && op.title !== existing.title ? op.title : undefined),
          topic:             op.new_topic || op.topic,
          description:       op.new_description || op.description,
          estimated_minutes: op.new_estimated_minutes || op.estimated_minutes,
          priority:          op.new_priority || op.priority,
          status:            op.status,
        })
      } else {
        // Task not found by exact match — create it as a fallback so user's intent is honored
        const plan = await ensureTodayPlan(studentId)
        await addCustomTask(plan.id, studentId, {
          title:             op.new_title || op.task_title || op.title || 'Modified Task',
          topic:             op.new_topic || op.topic || 'General Practice',
          description:       op.new_description || op.description || undefined,
          estimated_minutes: op.new_estimated_minutes || op.estimated_minutes || 30,
          priority:          op.new_priority || op.priority || 'medium',
        })
      }
      break
    }

    case 'modify_tasks': {
      const plan = await ensureTodayPlan(studentId)
      if (op.tasks && Array.isArray(op.tasks)) {
        await replaceDailyPlanTasks(plan.id, studentId, op.tasks)
      }
      break
    }

    case 'update_daily_minutes': {
      if (op.daily_minutes) {
        await supabase
          .from('profiles')
          .update({ daily_minutes: op.daily_minutes })
          .eq('id', studentId)
      }
      break
    }

    default:
      throw new Error(`Operation '${op.operation}' is not supported`)
  }
}

// ─── Load recent patches (for undo/history) ────────────────────────────────────
export interface PatchRecord {
  id: string
  summary: string
  status: string
  before_json: Record<string, unknown>
  after_json: Record<string, unknown>
  patch_json: Record<string, unknown>
  created_at: string
  confirmed_at: string | null
}

export async function loadRecentPatches(studentId: string, limit = 10): Promise<PatchRecord[]> {
  const { data } = await supabase
    .from('ai_patches')
    .select('id, summary, status, before_json, after_json, patch_json, created_at, confirmed_at')
    .eq('student_id', studentId)
    .eq('status', 'executed')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as PatchRecord[]
}
