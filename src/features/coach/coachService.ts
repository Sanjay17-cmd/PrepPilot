/**
 * AI Coach service (P3-4)
 * - Loads/creates chat sessions
 * - Builds compact student context
 * - Calls AI gateway for intent classification + responses
 * - Saves messages to ai_messages
 * - Returns structured patches for db_change intents
 */
import { supabase } from '../../lib/supabase'
import type { CoachResponse, CoachOperation } from '../../config/aiFeatures'
import { ALLOWED_OPERATIONS } from '../../config/aiFeatures'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  content: string
  intent?: string
  metadata_json?: Record<string, unknown>
  created_at: string
}

export interface ChatSession {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

// ─── Context builder ──────────────────────────────────────────────────────────
export async function buildStudentContext(studentId: string): Promise<Record<string, unknown>> {
  const [profileRes, rolesRes, skillsRes, planRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', studentId).single(),
    supabase.from('student_roles').select('is_primary, role:roles(name,slug)').eq('student_id', studentId).limit(5),
    supabase.from('student_latest_skills').select('topic, score').eq('student_id', studentId).order('score').limit(10),
    supabase.from('daily_plans').select('id, plan_date, status').eq('student_id', studentId).order('plan_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  let todayTasks: unknown[] = []
  if (planRes.data?.id) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, topic, status, priority, estimated_minutes, description')
      .eq('daily_plan_id', planRes.data.id)
      .order('display_order')
    todayTasks = tasks ?? []
  }

  const { data: roadmap } = await supabase
    .from('roadmaps')
    .select('id, name, status')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()

  let activePhase: unknown = null
  if (roadmap?.id) {
    const { data: phases } = await supabase
      .from('roadmap_phases')
      .select('title, status, display_order')
      .eq('roadmap_id', roadmap.id)
      .in('status', ['not_started', 'in_progress'])
      .order('display_order')
      .limit(2)
    activePhase = phases ?? []
  }

  return {
    student_name:   profileRes.data?.full_name ?? 'Student',
    roles:          (rolesRes.data ?? []).map((r: any) => ({ name: r.role?.name, primary: r.is_primary })),
    skills_summary: (skillsRes.data ?? []).map(s => ({ topic: s.topic, score: Math.round(Number(s.score)) })),
    today_plan:     planRes.data ? { date: planRes.data.plan_date, tasks: todayTasks } : null,
    active_roadmap: roadmap ? { name: roadmap.name, current_phases: activePhase } : null,
  }
}

// ─── Load or create chat session ─────────────────────────────────────────────
export async function getOrCreateChat(studentId: string): Promise<ChatSession> {
  const today = new Date().toISOString().slice(0, 10)

  // Try today's chat first
  const { data: existing } = await supabase
    .from('ai_chats')
    .select('id, title, created_at, updated_at')
    .eq('student_id', studentId)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing as ChatSession

  // Create new
  const { data: created, error } = await supabase
    .from('ai_chats')
    .insert({ student_id: studentId, title: `Chat — ${today}` })
    .select('id, title, created_at, updated_at')
    .single()

  if (error) throw new Error('Failed to create chat session')
  return created as ChatSession
}

// ─── Explicitly start a fresh new chat session ───────────────────────────────
export async function createNewChat(studentId: string): Promise<ChatSession> {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const today = new Date().toISOString().slice(0, 10)
  const { data: created, error } = await supabase
    .from('ai_chats')
    .insert({ student_id: studentId, title: `Chat — ${today} ${time}` })
    .select('id, title, created_at, updated_at')
    .single()

  if (error) throw new Error('Failed to create new chat session')
  return created as ChatSession
}

// ─── Load chat sessions list ──────────────────────────────────────────────────
export async function loadChatSessions(studentId: string): Promise<ChatSession[]> {
  const { data } = await supabase
    .from('ai_chats')
    .select('id, title, created_at, updated_at')
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false })
    .limit(10)
  return (data ?? []) as ChatSession[]
}

// ─── Load messages for a chat ─────────────────────────────────────────────────
export async function loadMessages(chatId: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('ai_messages')
    .select('id, sender, content, intent, metadata_json, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  return (data ?? []) as ChatMessage[]
}

// ─── Save a message ────────────────────────────────────────────────────────────
export async function saveMessage(
  chatId: string,
  studentId: string,
  sender: 'user' | 'assistant',
  content: string,
  opts: { intent?: string; aiRunId?: string; metadata?: Record<string, unknown> } = {},
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      chat_id:       chatId,
      student_id:    studentId,
      sender,
      content,
      intent:        opts.intent ?? null,
      ai_run_id:     opts.aiRunId ?? null,
      metadata_json: opts.metadata ?? {},
    })
    .select('id, sender, content, intent, metadata_json, created_at')
    .single()

  if (error) throw new Error('Failed to save message')
  return data as ChatMessage
}

// ─── Send a message to the coach ──────────────────────────────────────────────
export async function sendToCoach(
  studentId: string,
  chatId: string,
  userMessage: string,
  recentMessages: ChatMessage[],
  studentContext: Record<string, unknown>,
): Promise<{ reply: ChatMessage; coachResponse: CoachResponse }> {
  const { data: raw, error: fnErr } = await supabase.functions.invoke('ai-gateway', {
    body: {
      feature:         'ai_coach',
      student_id:      studentId,
      user_message:    userMessage,
      student_context: studentContext,
      recent_messages: recentMessages.slice(-8).map(m => ({ sender: m.sender, content: m.content })),
    },
  })

  if (fnErr) {
    let detail = fnErr.message || 'Coach service unavailable'
    try {
      if ('context' in fnErr && (fnErr as any).context) {
        const body = await (fnErr as any).context.json()
        if (body?.error) detail = body.error
      }
    } catch { /* best effort */ }
    throw new Error(detail)
  }

  // Validate and extract
  const coachResponse: CoachResponse = {
    intent:               raw.intent ?? 'info',
    response:             raw.response ?? 'Sorry, I could not process that.',
    requires_confirmation: !!raw.requires_confirmation,
    proposed_patch:       raw.proposed_patch ?? null,
  }

  // Validate allowed operations
  if (coachResponse.proposed_patch?.operations) {
    coachResponse.proposed_patch.operations = coachResponse.proposed_patch.operations.filter(
      (op: CoachOperation) => ALLOWED_OPERATIONS.has(op.operation)
    )
    if (coachResponse.proposed_patch.operations.length === 0) {
      coachResponse.requires_confirmation = false
      coachResponse.proposed_patch = null
    }
  }

  // Save assistant reply
  const reply = await saveMessage(chatId, studentId, 'assistant', coachResponse.response, {
    intent:   coachResponse.intent,
    aiRunId:  raw.ai_run_id,
    metadata: { proposed_patch: coachResponse.proposed_patch },
  })

  // Update chat updated_at
  await supabase.from('ai_chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId)

  return { reply, coachResponse }
}
