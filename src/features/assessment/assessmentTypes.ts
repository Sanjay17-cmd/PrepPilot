// Assessment-specific TypeScript types for Phase 2.

// -------------------------------------------------------------------------
// Assessment configuration (what the student chooses)
// -------------------------------------------------------------------------
export type AssessmentDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive'

export interface AssessmentConfig {
  roleId: string
  roleSlug: string
  roleName: string
  selectedTopicIds: string[]       // subset of role topics
  questionCount: number            // 5 | 10 | 15 | 20
  timeLimitMinutes: number         // 15 | 30 | 45 | 60
  difficulty: AssessmentDifficulty
}

// -------------------------------------------------------------------------
// MCQ question (Gemini-generated, validated)
// -------------------------------------------------------------------------
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface MCQQuestion {
  question_id: string              // e.g. "q_001"
  topic: string
  subtopic: string
  difficulty: QuestionDifficulty
  question: string
  options: string[]                // exactly 4: ["A: ...", "B: ...", "C: ...", "D: ..."]
  correct_answer: string           // "A" | "B" | "C" | "D"
  explanation: string
  concept: string
}

// Stored in Supabase (assessment_questions row)
export interface StoredQuestion {
  id: string                       // Supabase UUID
  assessment_id: string
  question_hash: string
  topic: string
  subtopic: string | null
  difficulty: QuestionDifficulty
  question_data: MCQQuestion
}

// -------------------------------------------------------------------------
// Adaptive engine state
// -------------------------------------------------------------------------
export type DifficultyLevel = 1 | 2 | 3   // 1=easy, 2=medium, 3=hard

export interface AdaptiveState {
  currentDifficultyLevel: DifficultyLevel  // 1 | 2 | 3
  topicCounts: Record<string, number>      // topic → how many questions shown
  topicCorrect: Record<string, number>     // topic → how many answered correctly
  usedQuestionIds: Set<string>
  answersMap: Record<string, string | null> // storedQuestion.id → 'A'|'B'|'C'|'D'|null
  orderedQuestionIds: string[]             // the sequence of questions presented
  currentIndex: number
}

// -------------------------------------------------------------------------
// Assessment attempt state (in-progress)
// -------------------------------------------------------------------------
export type AttemptStatus = 'in_progress' | 'submitted' | 'timed_out' | 'abandoned'

export interface AttemptViolations {
  fullscreen_exits: number
  visibility_changes: number
  copy_attempts: number
  paste_attempts: number
  context_menu_attempts: number
  window_blurs: number
}

// -------------------------------------------------------------------------
// Assessment result (calculated locally, never via Gemini)
// -------------------------------------------------------------------------
export interface TopicScore {
  topic: string
  total: number
  correct: number
  percentage: number
}

export interface DifficultyScore {
  difficulty: QuestionDifficulty
  total: number
  correct: number
  percentage: number
}

export interface AssessmentResult {
  totalQuestions: number
  correctCount: number
  wrongCount: number
  skippedCount: number
  score: number                    // correct / total
  percentage: number               // 0–100
  timeTakenSeconds: number
  topicScores: TopicScore[]
  difficultyScores: DifficultyScore[]
  strongTopics: string[]           // >= 70%
  weakTopics: string[]             // < 50%
}

// -------------------------------------------------------------------------
// Pool generation response (from AI gateway)
// -------------------------------------------------------------------------
export interface MCQPoolResponse {
  questions: MCQQuestion[]
  prompt_version: string
  model_used: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// -------------------------------------------------------------------------
// Per-question attempt (saved after submission)
// -------------------------------------------------------------------------
export interface QuestionAttemptRecord {
  attempt_id: string
  question_id: string
  student_id: string
  selected_answer: string | null
  correct: boolean | null
  presented_order: number
  time_spent_seconds: number
  topic: string
  difficulty: string
}
