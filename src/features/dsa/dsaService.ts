/**
 * DSA Service (P3-9)
 * Manual problem tracking — no Gemini for stats.
 * Pure Supabase aggregation.
 */
import { supabase } from '../../lib/supabase'
import { DSA_TOPICS } from '../../config/aiFeatures'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DSAProblem {
  id: string
  title: string
  url: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
  status: 'solved' | 'attempted' | 'reviewing'
  solved_at: string | null
  notes: string | null
  created_at: string
}

export interface DSAStats {
  total: number
  easy: number
  medium: number
  hard: number
  topicProgress: { topic: string; solved: number; pct: number }[]
  recentlySolved: DSAProblem[]
  weakTopics: string[]
}

// ─── Add problem ─────────────────────────────────────────────────────────────
export async function addProblem(
  studentId: string,
  data: {
    title: string
    url?: string
    difficulty: 'easy' | 'medium' | 'hard'
    topic: string
    status: 'solved' | 'attempted' | 'reviewing'
    notes?: string
  },
): Promise<DSAProblem> {
  const { data: row, error } = await supabase
    .from('leetcode_problems')
    .upsert(
      {
        student_id: studentId,
        title:      data.title.trim(),
        url:        data.url || null,
        difficulty: data.difficulty,
        topic:      data.topic,
        status:     data.status,
        solved_at:  data.status === 'solved' ? new Date().toISOString() : null,
        notes:      data.notes || null,
      },
      { onConflict: 'student_id,title' },
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return row as DSAProblem
}

// ─── Load all problems ────────────────────────────────────────────────────────
export async function loadProblems(
  studentId: string,
  filters: { topic?: string; difficulty?: string; status?: string } = {},
): Promise<DSAProblem[]> {
  let q = supabase
    .from('leetcode_problems')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (filters.topic)      q = q.eq('topic', filters.topic)
  if (filters.difficulty) q = q.eq('difficulty', filters.difficulty)
  if (filters.status)     q = q.eq('status', filters.status)

  const { data } = await q
  return (data ?? []) as DSAProblem[]
}

// ─── Update problem ────────────────────────────────────────────────────────────
export async function updateProblem(
  problemId: string,
  updates: Partial<Pick<DSAProblem, 'status' | 'notes' | 'difficulty' | 'topic'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { ...updates }
  if (updates.status === 'solved') payload.solved_at = new Date().toISOString()
  await supabase.from('leetcode_problems').update(payload).eq('id', problemId)
}

// ─── Delete problem ────────────────────────────────────────────────────────────
export async function deleteProblem(problemId: string): Promise<void> {
  await supabase.from('leetcode_problems').delete().eq('id', problemId)
}

// ─── Compute stats — pure client aggregation, zero Gemini ────────────────────
export async function getStats(studentId: string): Promise<DSAStats> {
  const { data: all } = await supabase
    .from('leetcode_problems')
    .select('difficulty, topic, status, solved_at, title, id, url, notes, created_at, url')
    .eq('student_id', studentId)

  const problems = (all ?? []) as DSAProblem[]
  const solved = problems.filter(p => p.status === 'solved')

  const easy   = solved.filter(p => p.difficulty === 'easy').length
  const medium = solved.filter(p => p.difficulty === 'medium').length
  const hard   = solved.filter(p => p.difficulty === 'hard').length

  // Per-topic progress
  const topicMap: Record<string, number> = {}
  for (const p of solved) {
    topicMap[p.topic] = (topicMap[p.topic] ?? 0) + 1
  }

  // We use a fixed assumed "target" of 15 per topic for % (configurable)
  const TARGET_PER_TOPIC = 15
  const topicProgress = DSA_TOPICS.map(topic => {
    const count = topicMap[topic] ?? 0
    return { topic, solved: count, pct: Math.min(100, Math.round((count / TARGET_PER_TOPIC) * 100)) }
  })

  const recentlySolved = solved
    .sort((a, b) => new Date(b.solved_at ?? b.created_at).getTime() - new Date(a.solved_at ?? a.created_at).getTime())
    .slice(0, 5)

  const weakTopics = topicProgress
    .filter(t => t.pct < 30)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4)
    .map(t => t.topic)

  return { total: solved.length, easy, medium, hard, topicProgress, recentlySolved, weakTopics }
}
