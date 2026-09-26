/**
 * Canvas Page — Phase 3 Extended (P3-12)
 * AI prompt input + artifact selector + existing deterministic renderer.
 * Previous/Next/Reset = zero Gemini calls (pure local state).
 */
import { useState, useCallback, useEffect } from 'react'
import React from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { clamp } from '../../lib/utils'
import type { CanvasArtifact, CanvasStep } from '../../types'
import { MISSING_NUMBER_DEMO } from '../../features/canvas/data/missingNumber'
import {
  generateCanvasArtifact, loadArtifacts,
  type SavedArtifact,
} from '../../features/canvas/canvasService'
import {
  ChevronLeft, ChevronRight, RotateCcw, Sparkles,
  MonitorPlay, ChevronDown,
} from 'lucide-react'

// ─── Code Panel ───────────────────────────────────────────────────────────────
function CodePanel({ code, activeLine, language }: { code: string[]; activeLine: number | null; language: string }) {
  return (
    <div className="canvas-panel">
      <div className="canvas-panel__header">
        <span className="canvas-panel__title">Code</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', background: 'var(--color-gray-100)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>{language}</span>
      </div>
      <div className="canvas-panel__body" style={{ padding: 0 }}>
        <div className="code-block" style={{ padding: 'var(--space-3) 0' }}>
          {code.map((line, idx) => {
            const lineNum = idx + 1
            const isActive = activeLine === lineNum
            return (
              <div key={idx} className={`code-line ${isActive ? 'code-line--active' : ''}`}>
                <span className="code-line__num">{line.trim() ? lineNum : ''}</span>
                <span className="code-line__content">{line || ' '}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Array Visualizer with pointer labels ─────────────────────────────────────
function ArrayVisualizer({ array, highlightIndices, markers }: {
  array: (number | string | null)[]
  highlightIndices: number[]
  markers: Record<string, number | string>
}) {
  if (array.length === 0) return null

  // Build reverse map: index → [pointer names]
  const pointerAtIndex: Record<number, string[]> = {}
  for (const [name, val] of Object.entries(markers)) {
    const idx = typeof val === 'number' ? val : parseInt(String(val))
    if (!isNaN(idx) && idx >= 0 && idx < array.length) {
      pointerAtIndex[idx] = [...(pointerAtIndex[idx] ?? []), name]
    }
  }

  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>Array</div>
      <div className="array-visualizer">
        {array.map((val, idx) => {
          const isHighlighted = highlightIndices.includes(idx)
          const ptrs = pointerAtIndex[idx] ?? []
          return (
            <div key={idx} className={`array-cell ${isHighlighted ? 'array-cell--pointer' : ''}`}>
              {ptrs.length > 0 && (
                <div className="array-cell__ptr-labels">
                  {ptrs.map(p => <span key={p} className="array-ptr-label">{p}</span>)}
                </div>
              )}
              <div className={`array-cell__box ${isHighlighted ? 'array-cell__box--highlighted' : ''}`}>
                {val ?? '?'}
              </div>
              <span className="array-cell__index">[{idx}]</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Variable Inspector ────────────────────────────────────────────────────────
function VariableInspector({ variables, markers }: { variables: CanvasStep['variables']; markers: CanvasStep['markers'] }) {
  const entries = Object.entries(variables)
  const markerEntries = Object.entries(markers)
  if (entries.length === 0 && markerEntries.length === 0) {
    return <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No variables yet</span>
  }
  return (
    <table className="var-table">
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}><td className="var-table__key">{k}</td><td className="var-table__value">{String(v ?? '—')}</td></tr>
        ))}
        {markerEntries.map(([k, v]) => (
          <tr key={`m-${k}`}>
            <td className="var-table__key" style={{ color: 'var(--color-accent-600)' }}>{k}</td>
            <td className="var-table__value var-table__value--changed">{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Explanation Panel ────────────────────────────────────────────────────────
function ExplanationPanel({ step }: { step: CanvasStep }) {
  return (
    <div className="explanation-panel">
      <div className="explanation-step-label">Step {step.step}</div>
      <div className="explanation-text">
        {step.explanation.split('\n').map((line, i) => (
          <p key={i} style={{ marginBottom: 'var(--space-2)' }}>{line}</p>
        ))}
      </div>
    </div>
  )
}

// ─── Main Canvas Page ──────────────────────────────────────────────────────────
export function CanvasPage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()

  const [artifact, setArtifact] = useState<CanvasArtifact>(MISSING_NUMBER_DEMO)
  const [stepIndex, setStepIndex] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [language, setLanguage] = useState('python')
  const [generating, setGenerating] = useState(false)
  const [savedArtifacts, setSavedArtifacts] = useState<SavedArtifact[]>([])
  const [showSelector, setShowSelector] = useState(false)

  useEffect(() => {
    if (appUser) loadArtifacts(appUser.auth.id).then(setSavedArtifacts)
  }, [appUser])

  const totalSteps  = artifact.steps.length
  const currentStep = artifact.steps[stepIndex]

  const goNext  = useCallback(() => setStepIndex(i => clamp(i + 1, 0, totalSteps - 1)), [totalSteps])
  const goPrev  = useCallback(() => setStepIndex(i => clamp(i - 1, 0, totalSteps - 1)), [])
  const goReset = useCallback(() => setStepIndex(0), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'Home')        goReset()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, goReset])

  async function handleGenerate() {
    if (!prompt.trim() || !appUser || generating) return
    setGenerating(true)
    try {
      const { artifact: gen, fromCache } = await generateCanvasArtifact(appUser.auth.id, prompt.trim(), language)
      setArtifact(gen)
      setStepIndex(0)
      if (fromCache) success('Loaded from your saved artifacts.')
      else success(`"${gen.title}" generated!`)
      // Refresh saved list
      const updated = await loadArtifacts(appUser.auth.id)
      setSavedArtifacts(updated)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  function loadSaved(saved: SavedArtifact) {
    const parsed = saved.artifact_json as any
    const validated: CanvasArtifact = {
      title:       parsed.title ?? saved.title,
      language:    parsed.language ?? saved.language,
      description: parsed.description ?? '',
      code:        parsed.code ?? [],
      variables:   parsed.variables ?? [],
      steps:       (parsed.steps ?? []).map((s: any, i: number) => ({
        step: s.step ?? i + 1, line: s.line ?? null,
        explanation: s.explanation ?? '',
        variables: s.variables ?? {}, markers: s.markers ?? {}, pointers: s.pointers ?? {},
        array: s.array ?? [], highlightIndices: s.highlightIndices ?? [],
      })),
    }
    setArtifact(validated)
    setStepIndex(0)
    setShowSelector(false)
  }

  return (
    <div className="page-container page-container--wide">
      {/* ── Header ── */}
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Learning Canvas</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
            Ask AI to explain any algorithm visually. Step through execution interactively.
          </p>
        </div>
      </div>

      {/* ── Prompt bar ── */}
      <div className="canvas-prompt-bar">
        <input
          className="canvas-prompt-input"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          placeholder="e.g. Explain binary search visually, Show bubble sort, Visualize Dijkstra..."
          id="canvas-prompt"
        />
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="canvas-lang-select"
        >
          {['python', 'java', 'c++', 'javascript'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <Button onClick={handleGenerate} loading={generating} disabled={!prompt.trim()} id="canvas-generate-btn">
          <Sparkles size={14} /> Generate
        </Button>
        {savedArtifacts.length > 0 && (
          <button className="canvas-selector-btn" onClick={() => setShowSelector(s => !s)} id="canvas-selector">
            <MonitorPlay size={14} /> Saved <ChevronDown size={12} />
          </button>
        )}
      </div>

      {/* ── Saved artifact selector ── */}
      {showSelector && (
        <div className="canvas-artifact-list">
          <div className="canvas-artifact-list__item" onClick={() => { setArtifact(MISSING_NUMBER_DEMO); setStepIndex(0); setShowSelector(false) }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Missing Number</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Built-in Demo · python</span>
          </div>
          {savedArtifacts.map(a => (
            <div key={a.id} className="canvas-artifact-list__item" onClick={() => loadSaved(a)}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{a.title}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{a.language} · {new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Algorithm title ── */}
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{artifact.title}</h2>
        <span style={{ fontSize: 'var(--text-xs)', background: 'var(--color-gray-100)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontFamily: 'var(--font-mono)' }}>
          {artifact.language}
        </span>
        {artifact.description && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{artifact.description}</span>
        )}
      </div>

      {/* ── Canvas grid ── */}
      <div className="canvas-layout">
        <CodePanel code={artifact.code} activeLine={currentStep.line} language={artifact.language} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="canvas-panel">
            <div className="canvas-panel__header"><span className="canvas-panel__title">Variables</span></div>
            <div className="canvas-panel__body">
              <VariableInspector variables={currentStep.variables} markers={currentStep.markers} />
            </div>
          </div>

          {currentStep.array.length > 0 && (
            <div className="canvas-panel">
              <div className="canvas-panel__header">
                <span className="canvas-panel__title">Array</span>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>len = {currentStep.array.length}</span>
              </div>
              <div className="canvas-panel__body" style={{ padding: 'var(--space-2)' }}>
                <ArrayVisualizer array={currentStep.array} highlightIndices={currentStep.highlightIndices ?? []} markers={currentStep.markers} />
              </div>
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="canvas-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="canvas-panel__header"><span className="canvas-panel__title">Execution Explanation</span></div>
          <div className="canvas-panel__body"><ExplanationPanel step={currentStep} /></div>
        </div>

        {/* Controls */}
        <div className="canvas-controls" style={{ gridColumn: '1 / -1' }}>
          <div className="canvas-controls__nav">
            <Button variant="secondary" size="sm" onClick={goPrev} disabled={stepIndex === 0} id="canvas-prev">
              <ChevronLeft size={15} /> Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={goNext} disabled={stepIndex === totalSteps - 1} id="canvas-next">
              Next <ChevronRight size={15} />
            </Button>
            <Button variant="ghost" size="sm" onClick={goReset} id="canvas-reset">
              <RotateCcw size={13} /> Reset
            </Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span className="canvas-controls__step-info">Step {stepIndex + 1} of {totalSteps}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {artifact.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIndex(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === stepIndex ? 'var(--color-accent-600)' : 'var(--color-gray-200)',
                    border: 'none', cursor: 'pointer', padding: 0, transition: 'background 150ms',
                  }}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>← → keyboard navigation</div>
        </div>
      </div>
    </div>
  )
}
