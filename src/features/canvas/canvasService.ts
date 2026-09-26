/**
 * Canvas AI Service (P3-11)
 * Prompt → request_hash → cache check → AI gateway → validate → save artifact
 */
import { supabase } from '../../lib/supabase'
import type { CanvasArtifact } from '../../types'
import { getFallbackTemplate } from './data/fallbackTemplates'

// ─── Hash prompt for cache ────────────────────────────────────────────────────
function hashPrompt(prompt: string, language: string): string {
  const str = `${prompt.toLowerCase().trim()}:${language}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + c
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// ─── Validate Gemini canvas output ────────────────────────────────────────────
function validateArtifact(raw: Record<string, unknown>): CanvasArtifact | null {
  if (!raw.title || !Array.isArray(raw.code) || !Array.isArray(raw.steps)) return null
  if (raw.steps.length === 0) return null

  const steps = (raw.steps as any[]).map((s, i) => ({
    step:             Number(s.step ?? i + 1),
    line:             s.line ?? null,
    explanation:      String(s.explanation ?? ''),
    variables:        s.variables ?? {},
    markers:          s.markers ?? {},
    pointers:         s.pointers ?? {},
    array:            Array.isArray(s.array) ? s.array : [],
    highlightIndices: Array.isArray(s.highlightIndices) ? s.highlightIndices : [],
  }))

  return {
    title:       String(raw.title),
    language:    String(raw.language ?? 'python'),
    description: String(raw.description ?? ''),
    code:        (raw.code as string[]),
    variables:   Array.isArray(raw.variables) ? raw.variables : [],
    steps,
  }
}

// ─── Generate or load artifact ────────────────────────────────────────────────
export async function generateCanvasArtifact(
  studentId: string,
  prompt: string,
  language = 'python',
): Promise<{ artifact: CanvasArtifact; artifactId: string; fromCache: boolean }> {
  const requestHash = hashPrompt(prompt, language)

  // Check student's cached artifact
  const { data: cached } = await supabase
    .from('canvas_artifacts')
    .select('id, artifact_json')
    .eq('student_id', studentId)
    .eq('request_hash', requestHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached?.artifact_json) {
    const validated = validateArtifact(cached.artifact_json as Record<string, unknown>)
    if (validated) return { artifact: validated, artifactId: cached.id, fromCache: true }
  }

  // Call AI gateway using Supabase client
  const { data: raw, error: fnErr } = await supabase.functions.invoke('ai-gateway', {
    body: {
      feature:    'canvas_generation',
      student_id: studentId,
      prompt,
      language,
    },
  })

  if (fnErr) {
    let detail = fnErr.message || 'AI Gateway error'
    try {
      if ('context' in fnErr && (fnErr as any).context) {
        const body = await (fnErr as any).context.json()
        if (body?.error) detail = body.error
      }
    } catch { /* best effort */ }

    // Check if we have a built-in fallback template matching this topic
    const fallback = getFallbackTemplate(prompt)
    if (fallback) {
      return { artifact: fallback, artifactId: 'offline-template', fromCache: false }
    }

    throw new Error(detail)
  }

  // Validate output
  const artifact = validateArtifact(raw as Record<string, unknown>)
  if (!artifact) throw new Error('Invalid canvas structure returned by AI.')

  // Save to DB
  const { data: saved } = await supabase
    .from('canvas_artifacts')
    .insert({
      student_id:      studentId,
      title:           artifact.title,
      prompt,
      language,
      artifact_json:   raw,
      request_hash:    requestHash,
      source_ai_run_id: raw.ai_run_id ?? null,
      is_builtin:      false,
    })
    .select('id')
    .single()

  return { artifact, artifactId: saved?.id ?? '', fromCache: false }
}

// ─── Load student's saved artifacts ──────────────────────────────────────────
export interface SavedArtifact {
  id: string
  title: string
  prompt: string
  language: string
  created_at: string
  artifact_json: Record<string, unknown>
}

export async function loadArtifacts(studentId: string): Promise<SavedArtifact[]> {
  const { data } = await supabase
    .from('canvas_artifacts')
    .select('id, title, prompt, language, created_at, artifact_json')
    .eq('student_id', studentId)
    .eq('is_builtin', false)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []) as SavedArtifact[]
}
