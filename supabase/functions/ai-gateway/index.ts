// Supabase AI Gateway Edge Function — Phase 1 Skeleton
// Located at: supabase/functions/ai-gateway/index.ts
//
// Deploy with: supabase functions deploy ai-gateway
//
// Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   GEMINI_API_KEY_1   — primary key
//   GEMINI_API_KEY_2   — first fallback
//   GEMINI_API_KEY_3   — second fallback
//   SUPABASE_URL       — auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
//
// IMPORTANT:
//   - Never expose these keys in frontend code.
//   - Key slots are for fallback/isolation, NOT quota multiplication.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GatewayRequest {
  feature: string          // e.g. 'roadmap', 'canvas', 'assessment'
  model?: string           // e.g. 'gemini-1.5-flash' — defaults to flash
  prompt_version?: string  // e.g. 'v1.0'
  input: Record<string, unknown>
  student_id?: string
  request_hash?: string    // pre-computed SHA256 — skip Gemini if cache hit
}

interface GatewayResponse {
  success: boolean
  data?: Record<string, unknown>
  ai_run_id?: string
  cached?: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Key rotation — fallback chain: slot 1 → slot 2 → slot 3
// ---------------------------------------------------------------------------

function getApiKeys(): string[] {
  const keys: string[] = []
  const k1 = Deno.env.get('GEMINI_API_KEY_1')
  const k2 = Deno.env.get('GEMINI_API_KEY_2')
  const k3 = Deno.env.get('GEMINI_API_KEY_3')
  if (k1) keys.push(k1)
  if (k2) keys.push(k2)
  if (k3) keys.push(k3)
  return keys
}

// ---------------------------------------------------------------------------
// Cache check — reuse existing ai_runs output if request_hash matches
// ---------------------------------------------------------------------------

async function checkCache(
  supabase: ReturnType<typeof createClient>,
  request_hash: string,
  feature: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('ai_runs')
    .select('id, output_json')
    .eq('request_hash', request_hash)
    .eq('feature', feature)
    .eq('status', 'success')
    .limit(1)
    .maybeSingle()

  return data?.output_json ?? null
}

// ---------------------------------------------------------------------------
// Gemini call with key fallback
// ---------------------------------------------------------------------------

async function callGemini(
  keys: string[],
  model: string,
  prompt: string
): Promise<{ output: Record<string, unknown>; key_slot: number; usage: Record<string, unknown> }> {
  let lastError: Error | null = null

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const slot = i + 1

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        lastError = new Error(`Gemini slot ${slot} HTTP ${response.status}: ${errorText}`)
        console.warn(`AI Gateway: key slot ${slot} failed, trying next...`)
        continue
      }

      const result = await response.json()
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

      let output: Record<string, unknown>
      try {
        output = JSON.parse(rawText)
      } catch {
        throw new Error(`Gemini returned non-JSON output from slot ${slot}`)
      }

      const usage = result?.usageMetadata ?? {}

      return { output, key_slot: slot, usage }

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`AI Gateway: key slot ${slot} error:`, lastError.message)
    }
  }

  throw lastError ?? new Error('All Gemini key slots failed')
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let body: GatewayRequest
  try {
    body = await req.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { feature, model = 'gemini-1.5-flash', prompt_version = 'v1.0', input, student_id, request_hash } = body

  if (!feature || !input) {
    return Response.json({ success: false, error: 'feature and input are required' }, { status: 400 })
  }

  // ---------------------------------------------------------------------------
  // RULE: Check cache before calling Gemini
  // ---------------------------------------------------------------------------
  if (request_hash) {
    const cached = await checkCache(supabase, request_hash, feature)
    if (cached) {
      return Response.json({
        success: true,
        data: cached,
        cached: true,
      } satisfies GatewayResponse)
    }
  }

  // ---------------------------------------------------------------------------
  // RULE: Never call Gemini for Phase 1 features that don't need it
  // ---------------------------------------------------------------------------
  const PHASE1_BLOCKED_FEATURES = ['roadmap', 'canvas', 'assessment', 'chat', 'daily_plan']
  if (PHASE1_BLOCKED_FEATURES.includes(feature)) {
    return Response.json({
      success: false,
      error: `Feature '${feature}' is not yet enabled. AI gateway is ready but Gemini calls for this feature are gated to Phase 2.`,
    } satisfies GatewayResponse, { status: 422 })
  }

  // ---------------------------------------------------------------------------
  // Gemini call
  // ---------------------------------------------------------------------------
  const keys = getApiKeys()
  if (keys.length === 0) {
    return Response.json({ success: false, error: 'No Gemini API keys configured on server.' }, { status: 500 })
  }

  // Create a pending ai_runs record
  const { data: runRow } = await supabase
    .from('ai_runs')
    .insert({
      student_id: student_id ?? null,
      feature,
      provider: 'gemini',
      model,
      prompt_version,
      request_hash: request_hash ?? null,
      input_json: input,
      status: 'pending',
    })
    .select('id')
    .single()

  const runId = runRow?.id

  try {
    // Build prompt — in Phase 2, each feature will have its own prompt builder.
    const prompt = `You are an AI assistant for a placement preparation platform. Feature: ${feature}. Input: ${JSON.stringify(input)}. Respond with valid JSON only.`

    const { output, key_slot, usage } = await callGemini(keys, model, prompt)

    // Update ai_runs record with success
    await supabase
      .from('ai_runs')
      .update({
        output_json: output,
        usage_json: usage,
        key_slot,
        status: 'success',
      })
      .eq('id', runId)

    return Response.json({
      success: true,
      data: output,
      ai_run_id: runId,
      cached: false,
    } satisfies GatewayResponse)

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    // Update ai_runs record with error
    if (runId) {
      await supabase
        .from('ai_runs')
        .update({
          status: 'error',
          error_json: { message: errorMessage },
        })
        .eq('id', runId)
    }

    return Response.json({
      success: false,
      error: errorMessage,
      ai_run_id: runId,
    } satisfies GatewayResponse, { status: 500 })
  }
})
