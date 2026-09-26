/**
 * Supabase database operations for the assessment feature.
 * All writes to ai_runs happen here after successful Gemini calls.
 */
import { supabase } from '../../lib/supabase'
import type {
  AssessmentConfig,
  StoredQuestion,
  MCQQuestion,
  AttemptViolations,
  AssessmentResult,
  QuestionAttemptRecord,
} from './assessmentTypes'

// -------------------------------------------------------------------------
// Create assessment record
// -------------------------------------------------------------------------
export async function createAssessment(
  studentId: string,
  config: AssessmentConfig,
): Promise<string> {
  const { data, error } = await supabase
    .from('assessments')
    .insert({
      student_id:          studentId,
      role_id:             config.roleId,
      configuration_json:  config,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create assessment: ${error.message}`)
  return data.id
}

// -------------------------------------------------------------------------
// Check for existing question pool (cache check by role + topics + difficulty)
// Returns stored questions if a valid pool exists, or null.
// -------------------------------------------------------------------------
export async function findExistingPool(
  roleId: string,
  selectedTopicIds: string[],
  difficulty: string,
  poolSize: number,
): Promise<StoredQuestion[] | null> {
  // Find an assessment with the same role/topics/difficulty that has enough questions
  const { data: assessments } = await supabase
    .from('assessments')
    .select('id, configuration_json')
    .eq('role_id', roleId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!assessments?.length) return null

  for (const a of assessments) {
    const cfg = a.configuration_json as AssessmentConfig
    const sameTopics = selectedTopicIds.every(t => cfg.selectedTopicIds?.includes(t))
    const sameDiff   = cfg.difficulty === difficulty

    if (!sameTopics || !sameDiff) continue

    const { data: qPool, count } = await supabase
      .from('assessment_questions')
      .select('*', { count: 'exact' })
      .eq('assessment_id', a.id)
      .limit(poolSize)

    if ((count ?? 0) >= poolSize && qPool) {
      return qPool as StoredQuestion[]
    }
  }
  return null
}

// -------------------------------------------------------------------------
// Store generated question pool in Supabase
// -------------------------------------------------------------------------
export async function storeQuestionPool(
  assessmentId: string,
  aiRunId: string | null,
  questions: MCQQuestion[],
): Promise<StoredQuestion[]> {
  const rows = questions.map(q => {
    const key = q.question.toLowerCase().replace(/\s+/g, ' ').trim()
    return {
      assessment_id:  assessmentId,
      ai_run_id:      aiRunId,
      question_hash:  hashString(key),
      topic:          q.topic,
      subtopic:       q.subtopic || null,
      difficulty:     q.difficulty,
      question_data:  q,
    }
  })

  const { data, error } = await supabase
    .from('assessment_questions')
    .insert(rows)
    .select('*')

  if (error) throw new Error(`Failed to store questions: ${error.message}`)
  return data as StoredQuestion[]
}

// -------------------------------------------------------------------------
// Create attempt
// -------------------------------------------------------------------------
export async function createAttempt(
  assessmentId: string,
  studentId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .insert({
      assessment_id: assessmentId,
      student_id:    studentId,
      status:        'in_progress',
      started_at:    new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create attempt: ${error.message}`)
  return data.id
}

// -------------------------------------------------------------------------
// Submit attempt (saves result + all question_attempts)
// -------------------------------------------------------------------------
export async function submitAttempt(
  attemptId: string,
  result: AssessmentResult,
  violations: AttemptViolations,
  questionRecords: QuestionAttemptRecord[],
  startedAt: Date,
): Promise<void> {
  const submittedAt = new Date()
  const timeTaken   = Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000)

  // Update attempt
  const { error: attemptErr } = await supabase
    .from('assessment_attempts')
    .update({
      status:           'submitted',
      submitted_at:     submittedAt.toISOString(),
      time_taken_seconds: timeTaken,
      total_questions:  result.totalQuestions,
      correct_count:    result.correctCount,
      wrong_count:      result.wrongCount,
      skipped_count:    result.skippedCount,
      score:            result.score,
      percentage:       result.percentage,
      result_json: {
        topic_scores:      result.topicScores,
        difficulty_scores: result.difficultyScores,
        strong_topics:     result.strongTopics,
        weak_topics:       result.weakTopics,
      },
      violation_json: violations,
    })
    .eq('id', attemptId)

  if (attemptErr) throw new Error(`Failed to submit attempt: ${attemptErr.message}`)

  // Bulk insert question attempts
  if (questionRecords.length > 0) {
    const { error: qaErr } = await supabase
      .from('question_attempts')
      .insert(questionRecords)

    if (qaErr) console.error('Failed to save question attempts:', qaErr.message)
  }
}

// -------------------------------------------------------------------------
// Load stored questions for an assessment
// -------------------------------------------------------------------------
export async function loadQuestionPool(assessmentId: string): Promise<StoredQuestion[]> {
  const { data, error } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('assessment_id', assessmentId)

  if (error) throw new Error(`Failed to load questions: ${error.message}`)
  return (data ?? []) as StoredQuestion[]
}

// -------------------------------------------------------------------------
// Load past attempts for a student
// -------------------------------------------------------------------------
export async function loadPastAttempts(studentId: string) {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select(`
      id, status, started_at, submitted_at,
      percentage, correct_count, total_questions,
      result_json,
      assessment:assessments(configuration_json, roles(name))
    `)
    .eq('student_id', studentId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(20)

  if (error) return []
  return data ?? []
}

// -------------------------------------------------------------------------
// Simple non-crypto hash (for question dedup in browser context)
// -------------------------------------------------------------------------
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
