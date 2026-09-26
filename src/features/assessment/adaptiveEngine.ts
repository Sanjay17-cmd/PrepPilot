/**
 * Deterministic adaptive assessment engine.
 *
 * Rules:
 *  - No Gemini calls. All selection is local.
 *  - Difficulty state machine: Easy(1) → Medium(2) → Hard(3)
 *  - Correct answer → tendency toward harder
 *  - Wrong answer   → tendency toward easier
 *  - Topic-aware: balance coverage across selected topics
 */
import type {
  StoredQuestion,
  DifficultyLevel,
  QuestionDifficulty,
  AdaptiveState,
  AssessmentConfig,
  AssessmentResult,
  TopicScore,
  DifficultyScore,
} from './assessmentTypes'

// -------------------------------------------------------------------------
// Difficulty mapping
// -------------------------------------------------------------------------
const DIFFICULTY_TO_LEVEL: Record<QuestionDifficulty, DifficultyLevel> = {
  easy:   1,
  medium: 2,
  hard:   3,
}

const LEVEL_TO_DIFFICULTY: Record<DifficultyLevel, QuestionDifficulty> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
}

function clampLevel(level: number): DifficultyLevel {
  return (Math.min(Math.max(level, 1), 3)) as DifficultyLevel
}

// -------------------------------------------------------------------------
// State transition
// -------------------------------------------------------------------------
export function nextDifficultyLevel(
  current: DifficultyLevel,
  wasCorrect: boolean,
): DifficultyLevel {
  if (wasCorrect) {
    // Tend toward harder but don't jump two levels at once
    return clampLevel(current + 1)
  }
  // Tend toward easier
  return clampLevel(current - 1)
}

// -------------------------------------------------------------------------
// Topic priority: pick the topic with least relative coverage
// -------------------------------------------------------------------------
function pickNextTopic(
  selectedTopics: string[],
  topicCounts: Record<string, number>,
): string {
  if (selectedTopics.length === 0) return ''
  // Sort by count ascending → least-covered first
  const sorted = [...selectedTopics].sort(
    (a, b) => (topicCounts[a] ?? 0) - (topicCounts[b] ?? 0),
  )
  return sorted[0]
}

// -------------------------------------------------------------------------
// Question selector
// -------------------------------------------------------------------------
export function selectNextQuestion(
  pool: StoredQuestion[],
  state: AdaptiveState,
  config: AssessmentConfig,
): StoredQuestion | null {
  const available = pool.filter(q => !state.usedQuestionIds.has(q.id))
  if (available.length === 0) return null

  const targetTopic = pickNextTopic(config.selectedTopicIds, state.topicCounts)
  const targetDiff  = LEVEL_TO_DIFFICULTY[state.currentDifficultyLevel]

  // Priority 1: exact topic + exact difficulty
  let candidate = available.find(q => q.topic === targetTopic && q.difficulty === targetDiff)
  if (candidate) return candidate

  // Priority 2: exact topic, adjacent difficulty
  const adjacent: QuestionDifficulty[] =
    targetDiff === 'medium' ? ['easy', 'hard'] :
    targetDiff === 'easy'   ? ['medium'] :
    /* hard */                ['medium']

  candidate = available.find(q => q.topic === targetTopic && adjacent.includes(q.difficulty))
  if (candidate) return candidate

  // Priority 3: any topic, exact difficulty
  candidate = available.find(q => q.difficulty === targetDiff)
  if (candidate) return candidate

  // Priority 4: any topic, any difficulty (fallback)
  return available[0] ?? null
}

// -------------------------------------------------------------------------
// Initialize adaptive state
// -------------------------------------------------------------------------
export function initAdaptiveState(
  config: AssessmentConfig,
  initialDifficulty: QuestionDifficulty = 'medium',
): AdaptiveState {
  const topicCounts: Record<string, number> = {}
  const topicCorrect: Record<string, number> = {}
  for (const t of config.selectedTopicIds) {
    topicCounts[t]  = 0
    topicCorrect[t] = 0
  }
  return {
    currentDifficultyLevel: DIFFICULTY_TO_LEVEL[initialDifficulty],
    topicCounts,
    topicCorrect,
    usedQuestionIds: new Set(),
    answersMap: {},
    orderedQuestionIds: [],
    currentIndex: 0,
  }
}

// -------------------------------------------------------------------------
// Record an answer and update state
// -------------------------------------------------------------------------
export function recordAnswer(
  state: AdaptiveState,
  questionId: string,
  selectedAnswer: string | null,
  question: StoredQuestion,
  isCorrect: boolean,
): AdaptiveState {
  const newTopicCounts  = { ...state.topicCounts, [question.topic]: (state.topicCounts[question.topic] ?? 0) + 1 }
  const newTopicCorrect = { ...state.topicCorrect }
  if (isCorrect) {
    newTopicCorrect[question.topic] = (newTopicCorrect[question.topic] ?? 0) + 1
  }

  const newLevel = nextDifficultyLevel(state.currentDifficultyLevel, isCorrect)

  return {
    ...state,
    answersMap:           { ...state.answersMap, [questionId]: selectedAnswer },
    usedQuestionIds:      new Set([...state.usedQuestionIds, questionId]),
    topicCounts:          newTopicCounts,
    topicCorrect:         newTopicCorrect,
    currentDifficultyLevel: newLevel,
  }
}

// -------------------------------------------------------------------------
// Build ordered question sequence UPFRONT for the entire attempt.
// We pre-select all N questions at once so Previous/Next works without
// changing what the student already saw.
// -------------------------------------------------------------------------
export function buildQuestionSequence(
  pool: StoredQuestion[],
  config: AssessmentConfig,
  initialDifficulty: QuestionDifficulty,
): StoredQuestion[] {
  const sequence: StoredQuestion[] = []
  let state = initAdaptiveState(config, initialDifficulty)

  for (let i = 0; i < config.questionCount; i++) {
    const q = selectNextQuestion(pool, state, config)
    if (!q) break

    // Simulate a "neutral" answer for sequence building only
    // (topic coverage is tracked; difficulty stays at initial)
    const newTopicCounts = { ...state.topicCounts, [q.topic]: (state.topicCounts[q.topic] ?? 0) + 1 }
    state = {
      ...state,
      usedQuestionIds: new Set([...state.usedQuestionIds, q.id]),
      topicCounts: newTopicCounts,
    }
    sequence.push(q)
  }

  // Shuffle options within each question safely
  return sequence.map(q => ({
    ...q,
    question_data: shuffleOptions(q.question_data),
  }))
}

// -------------------------------------------------------------------------
// Shuffle option order (keeping correct_answer tracking correct)
// -------------------------------------------------------------------------
function shuffleOptions(qd: StoredQuestion['question_data']): StoredQuestion['question_data'] {
  const keys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']

  // Extract the letter prefix from each option string like "A: text"
  const optionMap: Record<string, string> = {}
  qd.options.forEach((opt, i) => {
    const letter = keys[i]
    // Remove leading "A: ", "B: " etc if present
    const text = opt.replace(/^[A-D]:\s*/, '')
    optionMap[letter] = text
  })

  // Shuffle keys
  const shuffled = [...keys].sort(() => Math.random() - 0.5)

  // Find what the correct answer text is
  const correctText = optionMap[qd.correct_answer as string]

  // Build new options and find new correct answer letter
  let newCorrectAnswer = qd.correct_answer
  const newOptions = shuffled.map((originalKey, idx) => {
    const newLetter = keys[idx]
    const text = optionMap[originalKey]
    if (text === correctText) newCorrectAnswer = newLetter
    return `${newLetter}: ${text}`
  })

  return { ...qd, options: newOptions, correct_answer: newCorrectAnswer }
}

// -------------------------------------------------------------------------
// Validate a single MCQ from Gemini output
// -------------------------------------------------------------------------
export function validateMCQ(raw: unknown): raw is import('./assessmentTypes').MCQQuestion {
  if (!raw || typeof raw !== 'object') return false
  const q = raw as Record<string, unknown>
  if (typeof q.question !== 'string' || !q.question.trim()) return false
  if (!Array.isArray(q.options) || q.options.length !== 4) return false
  if (!['A', 'B', 'C', 'D'].includes(q.correct_answer as string)) return false
  if (!['easy', 'medium', 'hard'].includes(q.difficulty as string)) return false
  if (typeof q.topic !== 'string' || !q.topic.trim()) return false
  return true
}

// -------------------------------------------------------------------------
// Deduplicate a pool by normalized question hash
// -------------------------------------------------------------------------
export function deduplicatePool(
  questions: import('./assessmentTypes').MCQQuestion[],
): import('./assessmentTypes').MCQQuestion[] {
  const seen = new Set<string>()
  return questions.filter(q => {
    const key = q.question.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// -------------------------------------------------------------------------
// Calculate assessment result (deterministic, no Gemini)
// -------------------------------------------------------------------------
export function calculateResult(
  sequence: StoredQuestion[],
  answersMap: Record<string, string | null>,
  timeTakenSeconds: number,
): AssessmentResult {
  let correct = 0
  let wrong   = 0
  let skipped = 0

  const topicMap: Record<string, { total: number; correct: number }> = {}
  const diffMap:  Record<QuestionDifficulty, { total: number; correct: number }> = {
    easy: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard:  { total: 0, correct: 0 },
  }

  for (const q of sequence) {
    const selected = answersMap[q.id] ?? null
    const isCorrect = selected !== null && selected === q.question_data.correct_answer

    if (selected === null) skipped++
    else if (isCorrect)    correct++
    else                   wrong++

    // Topic breakdown
    if (!topicMap[q.topic]) topicMap[q.topic] = { total: 0, correct: 0 }
    topicMap[q.topic].total++
    if (isCorrect) topicMap[q.topic].correct++

    // Difficulty breakdown
    diffMap[q.difficulty].total++
    if (isCorrect) diffMap[q.difficulty].correct++
  }

  const total = sequence.length
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0

  const topicScores: TopicScore[] = Object.entries(topicMap).map(([topic, stats]) => ({
    topic,
    total:      stats.total,
    correct:    stats.correct,
    percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
  }))

  const difficultyScores: DifficultyScore[] = (
    ['easy', 'medium', 'hard'] as QuestionDifficulty[]
  )
    .filter(d => diffMap[d].total > 0)
    .map(d => ({
      difficulty: d,
      total:      diffMap[d].total,
      correct:    diffMap[d].correct,
      percentage: Math.round((diffMap[d].correct / diffMap[d].total) * 100),
    }))

  const strongTopics = topicScores.filter(ts => ts.percentage >= 70).map(ts => ts.topic)
  const weakTopics   = topicScores.filter(ts => ts.percentage <  50).map(ts => ts.topic)

  return {
    totalQuestions:   total,
    correctCount:     correct,
    wrongCount:       wrong,
    skippedCount:     skipped,
    score:            correct,
    percentage,
    timeTakenSeconds,
    topicScores,
    difficultyScores,
    strongTopics,
    weakTopics,
  }
}
