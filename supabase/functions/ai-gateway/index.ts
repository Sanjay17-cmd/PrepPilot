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
  // Phase 3
  'ai_coach',
  'resume_analysis',
  'canvas_generation',
])

// Active model candidates in priority order (Google retired gemini-1.5-flash)
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
]

// Features for which we NEVER use the output cache (always fresh)
const NO_CACHE_FEATURES = new Set(['ai_coach'])

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
        "operation": "<one of: complete_task | move_task | remove_task | reopen_task | create_daily_plan | regenerate_daily_plan | rename_roadmap | pause_roadmap | resume_roadmap | add_role | remove_role>",
        "<relevant_fields>": "<values>"
      }
    ]
  }
}

Rules:
- Never modify the database directly
- Never invent task IDs or entity IDs — leave them null, the app will resolve them
- For "complete_task" operations, include: {"operation":"complete_task","task_title":"<title>"}
- For "move_task", include: {"operation":"move_task","task_title":"<title>","to_date":"YYYY-MM-DD"}
- Keep response concise and focused on placement preparation
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
      case 'daily_plan_generation': prompt = buildDailyPlanPrompt(body);     break
      case 'ai_coach':              prompt = buildCoachPrompt(body);          break
      case 'resume_analysis':       prompt = buildResumeAnalysisPrompt(body);break
      case 'canvas_generation':     prompt = buildCanvasPrompt(body);        break
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
