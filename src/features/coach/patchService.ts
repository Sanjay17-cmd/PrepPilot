/**
 * Patch Executor (P3-5)
 * Validates, previews, and executes AI-proposed operations against Supabase.
 * Gemini never executes directly — all mutations go through here after student confirmation.
 */
import { supabase } from '../../lib/supabase'
import type { CoachOperation, ProposedPatch } from '../../config/aiFeatures'
import { ALLOWED_OPERATIONS } from '../../config/aiFeatures'
import { ensureTodayPlan, addCustomTask } from '../daily/dailyPlanService'

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

// ─── Resolve task by title (best-effort for coach's natural-language references) ─
async function resolveTaskByTitle(studentId: string, title: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data: plan } = await supabase
    .from('daily_plans')
    .select('id')
    .eq('student_id', studentId)
    .gte('plan_date', today)
    .order('plan_date')
    .limit(1)
    .maybeSingle()

  if (!plan) return null

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('daily_plan_id', plan.id)
    .ilike('title', `%${title.trim()}%`)
    .limit(1)
    .maybeSingle()

  return task?.id ?? null
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

    if (op.operation === 'complete_task' || op.operation === 'reopen_task') {
      const taskId = op.task_id ?? (op.task_title ? await resolveTaskByTitle(studentId, op.task_title) : null)
      if (!taskId) { before.push({ type: 'task', note: `Task "${op.task_title}" not found` }); continue }

      const { data: task } = await supabase.from('tasks').select('title, status').eq('id', taskId).single()
      if (!task) continue
      before.push({ type: 'task', title: task.title, status: task.status })
      after.push({ type: 'task', title: task.title, status: op.operation === 'complete_task' ? 'completed' : 'pending' })
    }

    if (op.operation === 'move_task') {
      const taskId = op.task_id ?? (op.task_title ? await resolveTaskByTitle(studentId, op.task_title) : null)
      if (!taskId) continue
      const { data: task } = await supabase.from('tasks').select('title, status').eq('id', taskId).single()
      if (!task) continue
      before.push({ type: 'task_move', title: task.title, from: op.from_date ?? 'today' })
      after.push({ type: 'task_move', title: task.title, to: op.to_date ?? 'moved date' })
    }

    if (op.operation === 'pause_roadmap' || op.operation === 'resume_roadmap') {
      const { data: rm } = await supabase.from('roadmaps').select('name, status').eq('student_id', studentId).eq('status', 'active').maybeSingle()
      if (!rm) continue
      before.push({ type: 'roadmap', name: rm.name, status: rm.status })
      after.push({ type: 'roadmap', name: rm.name, status: op.operation === 'pause_roadmap' ? 'paused' : 'active' })
    }

    if (op.operation === 'remove_task') {
      const taskId = op.task_id ?? (op.task_title ? await resolveTaskByTitle(studentId, op.task_title) : null)
      if (!taskId) continue
      const { data: task } = await supabase.from('tasks').select('title').eq('id', taskId).single()
      if (!task) continue
      before.push({ type: 'task', title: task.title, status: 'exists' })
      after.push({ type: 'task', title: task.title, status: 'removed' })
    }

    if (op.operation === 'add_task') {
      before.push({ type: 'task', title: '(None)', status: 'not scheduled' })
      after.push({ type: 'task', title: op.task_title || 'New Task', status: 'pending' })
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
      student_id:  studentId,
      chat_id:     chatId,
      intent:      'coach_action',
      summary:     patch.summary,
      patch_json:  { operations: patch.operations },
      before_json: { items: preview.before },
      after_json:  { items: preview.after },
      status:      'confirmed',
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
    status:       finalStatus,
    executed_at:  new Date().toISOString(),
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
  const today = new Date().toISOString().slice(0, 10)

  // Resolve task ID if only title provided
  const resolveTask = async () => {
    if (op.task_id) return op.task_id
    if (op.task_title) {
      const id = await resolveTaskByTitle(studentId, op.task_title)
      if (!id) throw new Error(`Task "${op.task_title}" not found`)
      return id
    }
    throw new Error('No task identifier provided')
  }

  switch (op.operation) {
    case 'complete_task': {
      const taskId = await resolveTask()
      const { data: task } = await supabase.from('tasks').select('student_id').eq('id', taskId).single()
      if (task?.student_id !== studentId) throw new Error('Ownership check failed')
      await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
      break
    }
    case 'reopen_task': {
      const taskId = await resolveTask()
      const { data: task } = await supabase.from('tasks').select('student_id').eq('id', taskId).single()
      if (task?.student_id !== studentId) throw new Error('Ownership check failed')
      await supabase.from('tasks').update({ status: 'pending' }).eq('id', taskId)
      break
    }
    case 'remove_task': {
      const taskId = await resolveTask()
      const { data: task } = await supabase.from('tasks').select('student_id').eq('id', taskId).single()
      if (task?.student_id !== studentId) throw new Error('Ownership check failed')
      await supabase.from('tasks').update({ status: 'skipped' }).eq('id', taskId)
      break
    }
    case 'move_task': {
      // Move = mark old as skipped (date change is daily plan concept — simplified here)
      const taskId = await resolveTask()
      const { data: task } = await supabase.from('tasks').select('student_id, title, topic, priority, estimated_minutes, description').eq('id', taskId).single()
      if (task?.student_id !== studentId) throw new Error('Ownership check failed')
      await supabase.from('tasks').update({ status: 'skipped' }).eq('id', taskId)
      // Note: full "move to another day" requires creating a new daily_plan for that date
      // For now, we mark the current task skipped and log the move intent
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
        title: op.task_title || 'Coach Recommended Task',
        topic: op.topic || 'AI Coach Recommendation',
        estimated_minutes: op.estimated_minutes || 30,
        priority: op.priority || 'medium',
      })
      break
    }
    default:
      throw new Error(`Operation '${op.operation}' not yet implemented`)
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
