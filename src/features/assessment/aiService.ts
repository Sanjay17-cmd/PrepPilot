/**
 * AI Gateway client for MCQ generation.
 * Calls the Supabase Edge Function — NEVER calls Gemini directly from the browser.
 * All API keys remain server-side.
 */
import { supabase } from '../../lib/supabase'
import type { AssessmentConfig, MCQQuestion, MCQPoolResponse } from './assessmentTypes'
import { validateMCQ, deduplicatePool } from './adaptiveEngine'
import { MCQ_PROMPT_VERSION } from '../../config/roleTopics'
import { getTopicsForRole } from '../../config/roleTopics'

const GATEWAY_FUNCTION = 'ai-gateway'

// -------------------------------------------------------------------------
// Generate MCQ pool via AI gateway
// Returns validated, deduplicated questions.
// -------------------------------------------------------------------------
export async function generateMCQPool(
  config: AssessmentConfig,
  poolSize: number,  // = questionCount * 2
): Promise<{ questions: MCQQuestion[]; aiRunId: string | null }> {
  const topicConfigs = getTopicsForRole(config.roleSlug)
  const selectedTopics = topicConfigs.filter(t =>
    config.selectedTopicIds.includes(t.id)
  )

  // Build difficulty distribution: if adaptive start with even split
  const diffDistribution = buildDifficultyDistribution(poolSize, config.difficulty)

  const requestPayload = {
    feature:         'mcq_generation',
    prompt_version:  MCQ_PROMPT_VERSION,
    role:            config.roleName,
    role_slug:       config.roleSlug,
    topics:          selectedTopics.map(t => t.label),
    difficulty:      config.difficulty,
    pool_size:       poolSize,
    diff_distribution: diffDistribution,
  }

  const { data, error } = await supabase.functions.invoke(GATEWAY_FUNCTION, {
    body: requestPayload,
  })

  if (error) {
    throw new Error(`AI gateway error: ${error.message}`)
  }

  // The gateway returns { questions: [...], ai_run_id, model_used, usage }
  const response = data as { questions: MCQQuestion[]; ai_run_id?: string; error?: string }

  if (response.error) {
    throw new Error(response.error)
  }

  if (!Array.isArray(response.questions)) {
    throw new Error('Invalid response from AI gateway: expected questions array')
  }

  // Validate each question
  const valid = response.questions.filter(q => {
    const ok = validateMCQ(q)
    if (!ok) console.warn('Dropped invalid question:', q)
    return ok
  })

  // Deduplicate
  const deduped = deduplicatePool(valid)

  if (deduped.length === 0) {
    throw new Error('No valid questions returned. Please try again.')
  }

  return {
    questions: deduped,
    aiRunId:   response.ai_run_id ?? null,
  }
}

// -------------------------------------------------------------------------
// Difficulty distribution for the pool
// -------------------------------------------------------------------------
function buildDifficultyDistribution(
  poolSize: number,
  difficulty: AssessmentConfig['difficulty'],
): Record<string, number> {
  if (difficulty === 'easy') {
    return { easy: poolSize }
  }
  if (difficulty === 'medium') {
    return { medium: poolSize }
  }
  if (difficulty === 'hard') {
    return { hard: poolSize }
  }
  // Adaptive: balanced spread with slightly more medium
  const hard   = Math.floor(poolSize * 0.28)
  const easy   = Math.floor(poolSize * 0.28)
  const medium = poolSize - easy - hard
  return { easy, medium, hard }
}
