import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// -------------------------------------------------------------------------
// Environment keys (set in Supabase Edge Function secrets)
// -------------------------------------------------------------------------
const GEMINI_KEYS = [
  Deno.env.get('GEMINI_API_KEY_1'),
  Deno.env.get('GEMINI_API_KEY_2'),
  Deno.env.get('GEMINI_API_KEY_3'),
].filter(Boolean) as string[]

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// All supported features
const SUPPORTED_FEATURES = new Set([
  // Phase 2
  'mcq_generation',
  'roadmap_generation',
  'daily_plan_generation',
  'daily_plan',
  // Phase 3
  'ai_coach',
  'resume_analysis',
  'canvas_generation',
  // Mock Interview
  'mock_interview_turn',
  'mock_interview_evaluate',
])

// Active model candidates in priority order (Google retired gemini-1.5-flash)
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
]

// Features for which we NEVER use the output cache (always fresh)
const NO_CACHE_FEATURES = new Set(['ai_coach', 'mock_interview_turn', 'mock_interview_evaluate'])

// -------------------------------------------------------------------------
// Gemini call with multi-key and multi-model fallback
// -------------------------------------------------------------------------
async function callGemini(
  prompt: string,
  _feature: string,
): Promise<{ content: string; keySlot: number; model: string; usage: Record<string, number> }> {
  if (GEMINI_KEYS.length === 0) throw new Error('No Gemini API keys configured in Edge Function secrets.')

  let lastError = ''

  for (let slot = 0; slot < GEMINI_KEYS.length; slot++) {
    const key = GEMINI_KEYS[slot]

    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(
          `${GEMINI_BASE_URL}/${model}:generateContent?key=${key}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature:     0.4,
                topP:            0.9,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
              },
            }),
          },
        )

        if (!res.ok) {
          const errBody = await res.text()
          lastError = `Key ${slot + 1} (${model}): HTTP ${res.status} — ${errBody.slice(0, 160)}`

          // 404 means model retired or unsupported on this API version -> try next model candidate
          if (res.status === 404) {
            continue
          }
          // 429 means rate-limited / quota exhausted on this key -> switch to next key slot
          if (res.status === 429) {
            break
          }
          continue
        }

        const data = await res.json()
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const usage   = {
          prompt_tokens:     data?.usageMetadata?.promptTokenCount     ?? 0,
          completion_tokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
          total_tokens:      data?.usageMetadata?.totalTokenCount      ?? 0,
        }

        return { content, keySlot: slot + 1, model, usage }
      } catch (err) {
        lastError = `Key ${slot + 1} (${model}): ${err}`
      }
    }
  }

  throw new Error(`All Gemini keys and model fallbacks failed. Last error: ${lastError}`)
}

// -------------------------------------------------------------------------
// Phase 2 prompt builders
// -------------------------------------------------------------------------
function buildMCQPrompt(body: Record<string, unknown>): string {
  const role        = body.role        as string
  const topics      = body.topics      as string[]
  const difficulty  = body.difficulty  as string
  const poolSize    = body.pool_size   as number
  const diffDist    = body.diff_distribution as Record<string, number>

  const topicList = topics.join(', ')
  const diffInstr = difficulty === 'adaptive'
    ? `Distribute questions as follows: Easy: ${diffDist.easy}, Medium: ${diffDist.medium}, Hard: ${diffDist.hard}.`
    : `All ${poolSize} questions should be ${difficulty} difficulty.`

  return `You are generating a placement preparation MCQ question pool for a student preparing for a ${role} role.

Generate exactly ${poolSize} multiple-choice questions on these topics: ${topicList}

${diffInstr}

Rules:
- Every question must have exactly 4 options labeled A, B, C, D
- Each option text should NOT include the label (e.g., write "Binary search" not "A: Binary search")
- correct_answer must be one of: "A", "B", "C", "D"
- difficulty must be one of: "easy", "medium", "hard"
- Questions must be placement-exam appropriate (technical, specific, unambiguous)
- Do NOT repeat questions
- Ensure at least one question per topic if possible
- Include meaningful distractors (wrong answers that look plausible)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "questions": [
    {
      "question_id": "q_001",
      "topic": "<topic name exactly as in the list>",
      "subtopic": "<specific subtopic>",
      "difficulty": "easy|medium|hard",
      "question": "<the question text>",
      "options": ["<option A text>", "<option B text>", "<option C text>", "<option D text>"],
      "correct_answer": "A|B|C|D",
      "explanation": "<why the correct answer is correct>",
      "concept": "<the underlying concept being tested>"
    }
  ]
}

Generate exactly ${poolSize} questions now.`
}

function buildRoadmapPrompt(body: Record<string, unknown>): string {
  const input = JSON.stringify(body.student_state ?? body, null, 2)
  return `You are generating a personalized placement preparation roadmap.

Student data:
${input}

Return ONLY valid JSON in this format:
{
  "roadmap": {
    "name": "<roadmap name>",
    "role": "<role>",
    "total_days": <number>,
    "phases": [
      {
        "title": "<phase title>",
        "duration_days": <number>,
        "description": "<brief description>",
        "topics": [
          {
            "name": "<topic>",
            "priority": "high|medium|low",
            "estimated_minutes": <number>,
            "focus_areas": ["<area1>", "<area2>"]
          }
        ]
      }
    ]
  }
}`
}

function buildDailyPlanPrompt(body: Record<string, unknown>): string {
  const input = JSON.stringify(body.roadmap_context ?? body, null, 2)
  return `Generate a focused daily study plan for placement preparation.

Context:
${input}

Return ONLY valid JSON:
{
  "plan": {
    "date": "<YYYY-MM-DD>",
    "total_minutes": <number>,
    "tasks": [
      {
        "topic": "<topic>",
        "title": "<task title>",
        "description": "<what to study>",
        "estimated_minutes": <number>,
        "priority": "high|medium|low",
        "display_order": <number>
      }
    ]
  }
}`
}

// -------------------------------------------------------------------------
// Phase 3: AI Coach prompt
// -------------------------------------------------------------------------
function buildCoachPrompt(body: Record<string, unknown>): string {
  const userMessage = body.user_message as string
  const studentCtx  = body.student_context ?? {}
  const recentMsgs  = (body.recent_messages as Array<{sender:string; content:string}>) ?? []

  const recentConv = recentMsgs.slice(-6).map(m => `${m.sender === 'user' ? 'Student' : 'Coach'}: ${m.content}`).join('\n')

  return `You are PrepPilot AI Coach — a placement preparation assistant.

You help students understand where they stand, what to study, and how to adjust their preparation plans.

## Student Context (compact):
${JSON.stringify(studentCtx, null, 2)}

## Recent conversation:
${recentConv || '(No previous messages)'}

## Student says:
"${userMessage}"

## Your task:
Classify the intent and respond appropriately.

Intent types:
- "info": General question, no DB change needed
- "explanation": Wants an explanation of a topic/concept
- "planning": Wants to know what to study / schedule advice
- "db_change": Wants to modify daily plan, roadmap, tasks, or roles

Respond ONLY with valid JSON:
{
  "intent": "info|explanation|planning|db_change",
  "response": "<your coach response visible to the student>",
  "requires_confirmation": false,
  "proposed_patch": null
}

If intent is "db_change", set requires_confirmation to true and include:
{
  "intent": "db_change",
  "response": "<explain what you propose to do>",
  "requires_confirmation": true,
  "proposed_patch": {
    "summary": "<one-line description of the change>",
    "operations": [
      {
        "operation": "<one of: add_task | modify_task | modify_tasks | complete_task | move_task | remove_task | reopen_task | create_daily_plan | regenerate_daily_plan | rename_roadmap | pause_roadmap | resume_roadmap | update_daily_minutes>",
        "<relevant_fields>": "<values>"
      }
    ]
  }
}

Supported operations and formats:
- "add_task": {"operation":"add_task", "task_title":"<title>", "topic":"<topic>", "estimated_minutes":<number>, "priority":"high|medium|low", "description":"<desc>"}
- "modify_task": {"operation":"modify_task", "task_title":"<current task title>", "new_title":"<new title if changed>", "topic":"<topic>", "estimated_minutes":<number>, "priority":"high|medium|low", "description":"<desc>"}
- "modify_tasks": {"operation":"modify_tasks", "tasks":[{"title":"<title>", "topic":"<topic>", "estimated_minutes":<number>, "priority":"high|medium|low"}]}
- "create_daily_plan": {"operation":"create_daily_plan", "task_title":"<optional single title>", "tasks":[{"title":"<title>", "topic":"<topic>", "estimated_minutes":<number>, "priority":"high|medium|low"}]}
- "regenerate_daily_plan": {"operation":"regenerate_daily_plan"}
- "complete_task": {"operation":"complete_task", "task_title":"<title>"}
- "reopen_task": {"operation":"reopen_task", "task_title":"<title>"}
- "remove_task": {"operation":"remove_task", "task_title":"<title>"}
- "move_task": {"operation":"move_task", "task_title":"<title>", "to_date":"YYYY-MM-DD"}
- "update_daily_minutes": {"operation":"update_daily_minutes", "daily_minutes":<number>}
- "pause_roadmap" / "resume_roadmap": {"operation":"pause_roadmap"|"resume_roadmap"}
- "rename_roadmap": {"operation":"rename_roadmap", "new_name":"<name>"}

Rules:
- Never modify the database directly
- When student asks to add a task, use "add_task" or "create_daily_plan" with task details
- When student asks to modify, change, or update existing tasks, use "modify_task" or "modify_tasks" with the modified fields or task array
- Never invent entity IDs — leave them null, the app resolves them by title
- Keep response concise, friendly, and focused on placement preparation
- Do not make up student data — use only what is in the context
- If information is missing from context, say so honestly`
}

// -------------------------------------------------------------------------
// Phase 3: Resume analysis prompt
// -------------------------------------------------------------------------
function buildResumeAnalysisPrompt(body: Record<string, unknown>): string {
  const resumeText  = body.resume_text as string
  const roleName    = body.role_name   as string
  const roleKeywords = (body.role_keywords as string[]) ?? []

  return `You are an expert resume reviewer for placement preparation in India.

Target role: ${roleName}
Key skills for this role: ${roleKeywords.join(', ')}

Resume text:
---
${resumeText.slice(0, 6000)}
---

Analyze this resume for ATS-oriented quality and role fit. Be honest and specific.
Do NOT invent achievements, numbers, or technologies not present in the resume.

Return ONLY valid JSON:
{
  "overall_score": <0-100>,
  "score_breakdown": {
    "keyword_match": <0-100>,
    "content_structure": <0-100>,
    "role_relevance": <0-100>,
    "project_strength": <0-100>,
    "impact_statements": <0-100>,
    "readability": <0-100>
  },
  "keywords_found": ["<keyword1>", "..."],
  "keywords_missing": ["<keyword1>", "..."],
  "sections_found": ["contact", "education", "skills", "projects"],
  "sections_missing": ["experience", "certifications"],
  "strengths": ["<specific strength from resume>"],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "section": "<section name>",
      "issue": "<specific issue found>",
      "suggestion": "<specific actionable fix>",
      "current_text": "<optional: exact problematic text from resume>",
      "suggested_text": "<optional: suggested replacement>"
    }
  ],
  "summary": "<2-3 sentence overall assessment>"
}`
}

// -------------------------------------------------------------------------
// Phase 3: Canvas generation prompt
// -------------------------------------------------------------------------
function buildCanvasPrompt(body: Record<string, unknown>): string {
  const userPrompt = body.prompt   as string
  const language   = (body.language as string) ?? 'python'

  return `You are an algorithm visualization generator for a placement preparation tool.

Student request: "${userPrompt}"
Language: ${language}

Generate a complete step-by-step algorithm visualization.

Return ONLY valid JSON matching this schema:
{
  "title": "<algorithm name>",
  "language": "${language}",
  "description": "<one sentence description>",
  "code": ["<line 1>", "<line 2>", "..."],
  "variables": ["<var1>", "<var2>"],
  "steps": [
    {
      "step": 1,
      "line": <1-indexed line number of active code line>,
      "explanation": "<clear, concise explanation of what happens at this step>",
      "variables": {
        "<var_name>": "<current value as string>"
      },
      "markers": {
        "<pointer_name>": "<index or value>"
      },
      "array": [<values or null for empty>],
      "highlightIndices": [<index numbers to highlight>]
    }
  ]
}

Rules:
- code must be an array of strings, one per line
- steps must cover the full algorithm execution with a representative example
- Keep steps between 5 and 20 (use a concrete small example)
- variables must show actual values at each step (not placeholders)
- array can be empty [] if the algorithm doesn't use arrays
- explanation must be clear and educational (2-4 sentences)
- markers shows named pointers like low, high, mid, i, j, left, right, etc.
- highlightIndices shows which array positions are active/relevant at this step`
}

// -------------------------------------------------------------------------
// Mock Interview Prompts
// -------------------------------------------------------------------------
function buildMockInterviewTurnPrompt(body: Record<string, unknown>): string {
  const roleName = (body.role_name as string) ?? 'Software Engineer'
  const interviewType = (body.interview_type as string) ?? 'technical'
  const difficulty = (body.difficulty as string) ?? 'entry_level'
  const questionNumber = Number(body.question_number ?? 1)
  const totalQuestions = Number(body.total_questions ?? 5)
  const history = (body.history as Array<{ speaker: string; text: string }>) ?? []
  const candidateLastAnswer = (body.candidate_last_answer as string) ?? ''

  const transcript = history
    .map(h => `${h.speaker === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${h.text}`)
    .join('\n')

  return `You are an expert, professional, and encouraging placement interviewer conducting a realistic mock interview for a ${roleName} position.
Interview Category: ${interviewType} (${difficulty} level).
Interview Progress: Turn ${questionNumber} of ${totalQuestions}.

Conversation history:
${transcript || '(The interview has just begun.)'}

Candidate's most recent answer:
"${candidateLastAnswer || '(Beginning of interview — introduce yourself and ask question 1)'}"

Instructions:
1. If this is question 1, warmly welcome the candidate, introduce yourself, and ask your first interview question.
2. If the candidate just answered, briefly acknowledge their answer in a conversational tone (e.g. "Good insight on indexing," or "I see your point on trade-offs"), and then ask either a targeted follow-up question or the next question.
3. Keep your spoken response natural, concise (2 to 4 sentences), and conversational. It will be spoken out loud via text-to-speech. Do NOT include markdown formatting, bullet points, or code blocks in the spoken response.
4. If question ${questionNumber} >= ${totalQuestions}, wrap up the interview gracefully, thank the candidate, and let them know that their feedback evaluation is now being compiled.

Return ONLY valid JSON matching this schema:
{
  "response": "<The exact spoken words to be voiced aloud to the candidate>",
  "feedback_note": "<Brief 1-sentence analytical note on their previous answer>",
  "question_number": ${questionNumber},
  "is_final": ${questionNumber >= totalQuestions},
  "suggested_topic": "<The core topic being tested in this question>"
}`
}

function buildMockInterviewEvaluatePrompt(body: Record<string, unknown>): string {
  const roleName = (body.role_name as string) ?? 'Software Engineer'
  const interviewType = (body.interview_type as string) ?? 'technical'
  const difficulty = (body.difficulty as string) ?? 'entry_level'
  const transcript = (body.transcript as Array<{ speaker: string; text: string }>) ?? []

  const formattedTranscript = transcript
    .map((t, i) => `${i + 1}. [${t.speaker.toUpperCase()}]: ${t.text}`)
    .join('\n\n')

  return `You are a Senior Interview Bar Raiser evaluating a candidate's complete placement mock interview.
Role: ${roleName}
Interview Category: ${interviewType} (${difficulty} level)

Full Interview Transcript:
${formattedTranscript}

Evaluate the candidate thoroughly and constructively.
Return ONLY valid JSON matching this exact schema:
{
  "overall_score": <integer from 40 to 98>,
  "technical_score": <integer from 40 to 98>,
  "communication_score": <integer from 40 to 98>,
  "confidence_score": <integer from 40 to 98>,
  "verdict": "<Strong Hire|Hire|Lean Hire|Needs Work>",
  "summary": "<2-3 paragraph detailed evaluation of how the candidate performed>",
  "key_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areas_for_improvement": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "question_evaluations": [
    {
      "question": "<question asked>",
      "candidate_answer": "<summary of candidate's answer>",
      "rating": "<excellent|good|average|needs_work>",
      "feedback": "<detailed critique of what went well and what was missed>"
    }
  ],
  "recommended_topics": ["<topic 1 to study>", "<topic 2 to study>", "<topic 3 to study>"]
}`
}

// -------------------------------------------------------------------------
// Hash a request body deterministically for cache lookup
// -------------------------------------------------------------------------
function hashRequest(body: unknown): string {
  const str = JSON.stringify(body)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + c
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// -------------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const body: Record<string, unknown> = await req.json()
    const feature = body.feature as string ?? 'unknown'

    if (!SUPPORTED_FEATURES.has(feature)) {
      return Response.json({ error: `Feature '${feature}' is not available.` }, { status: 400 })
    }

    // Extract student ID from auth header
    const authHeader = req.headers.get('Authorization')
    const userToken  = authHeader?.replace('Bearer ', '') ?? ''
    const { data: { user } } = await supabase.auth.getUser(userToken)
    const studentId = user?.id ?? null

    // Cache check (skip for chat)
    const requestHash   = hashRequest({ feature, ...body })
    const promptVersion = (body.prompt_version as string) ?? 'v1.0'

    if (!NO_CACHE_FEATURES.has(feature)) {
      const { data: cached } = await supabase
        .from('ai_runs')
        .select('id, output_json')
        .eq('request_hash', requestHash)
        .eq('prompt_version', promptVersion)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (cached?.output_json) {
        return Response.json({
          ...cached.output_json,
          ai_run_id:  cached.id,
          from_cache: true,
        }, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      }
    }

    // Build prompt
    let prompt = ''
    switch (feature) {
      case 'mcq_generation':        prompt = buildMCQPrompt(body);           break
      case 'roadmap_generation':    prompt = buildRoadmapPrompt(body);       break
      case 'daily_plan_generation':
      case 'daily_plan':            prompt = buildDailyPlanPrompt(body);     break
      case 'ai_coach':              prompt = buildCoachPrompt(body);          break
      case 'resume_analysis':       prompt = buildResumeAnalysisPrompt(body);break
      case 'canvas_generation':     prompt = buildCanvasPrompt(body);        break
      case 'mock_interview_turn':   prompt = buildMockInterviewTurnPrompt(body); break
      case 'mock_interview_evaluate': prompt = buildMockInterviewEvaluatePrompt(body); break
      default: throw new Error(`Unknown feature: ${feature}`)
    }

    // Call Gemini with fallback
    const { content, keySlot, model, usage } = await callGemini(prompt, feature)

    // Parse JSON response
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Gemini returned invalid JSON')
      parsed = JSON.parse(match[0])
    }

    // Save to ai_runs
    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        student_id:     studentId,
        feature,
        model,
        key_slot:       keySlot,
        request_hash:   requestHash,
        prompt_version: promptVersion,
        input_json:     body,
        output_json:    parsed,
        usage_json:     usage,
        status:         'success',
      })
      .select('id')
      .single()

    return Response.json({
      ...parsed,
      ai_run_id:  runRecord?.id ?? null,
      from_cache: false,
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    try {
      await supabase.from('ai_runs').insert({
        feature: 'error_log',
        model:   'unknown',
        status:  'error',
        error_json: { message },
      })
    } catch { /* best-effort */ }

    return Response.json({ error: message }, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
})
