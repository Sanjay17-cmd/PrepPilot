import React, { useState, useCallback } from 'react'
import { MISSING_NUMBER_DEMO } from '../../features/canvas/data/missingNumber'
import { Button } from '../../components/ui/Button'
import { clamp } from '../../lib/utils'
import type { CanvasArtifact, CanvasStep } from '../../types'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

// -------------------------------------------------------------------------
// Generic Canvas Renderer
// Future Gemini output will populate the same CanvasArtifact structure.
// -------------------------------------------------------------------------

function CodePanel({ code, activeLine }: { code: string[]; activeLine: number | null }) {
  return (
    <div className="canvas-panel">
      <div className="canvas-panel__header">
        <span className="canvas-panel__title">Code</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>python</span>
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

function ArrayVisualizer({ array, highlightIndices }: { array: (number | string | null)[]; highlightIndices: number[] }) {
  if (array.length === 0) return null
  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
        Array
      </div>
      <div className="array-visualizer">
        {array.map((val, idx) => {
          const isHighlighted = highlightIndices.includes(idx)
          return (
            <div key={idx} className={`array-cell ${isHighlighted ? 'array-cell--pointer' : ''}`}>
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

function VariableInspector({ variables, markers }: { variables: CanvasStep['variables']; markers: CanvasStep['markers'] }) {
  const hasVars = Object.keys(variables).length > 0
  const hasMarkers = Object.keys(markers).length > 0

  if (!hasVars && !hasMarkers) return null

  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
        Variables
      </div>
      <table className="var-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(variables).map(([k, v]) => (
            <tr key={k}>
              <td className="var-table__key">{k}</td>
              <td className="var-table__value">{String(v ?? '—')}</td>
            </tr>
          ))}
          {Object.entries(markers).map(([k, v]) => (
            <tr key={`m-${k}`}>
              <td className="var-table__key" style={{ color: 'var(--color-accent-600)' }}>{k}</td>
              <td className="var-table__value var-table__value--changed">{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExplanationPanel({ step }: { step: CanvasStep }) {
  return (
    <div className="explanation-panel">
      <div className="explanation-step-label">Step {step.step} explanation</div>
      <div className="explanation-text">
        {step.explanation.split('\n').map((line, i) => (
          <p key={i} style={{ marginBottom: i < step.explanation.split('\n').length - 1 ? 'var(--space-2)' : 0 }}>{line}</p>
        ))}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Main Canvas Page
// -------------------------------------------------------------------------
export function CanvasPage() {
  const artifact: CanvasArtifact = MISSING_NUMBER_DEMO
  const [stepIndex, setStepIndex] = useState(0)

  const totalSteps = artifact.steps.length
  const currentStep = artifact.steps[stepIndex]

  const goNext  = useCallback(() => setStepIndex(i => clamp(i + 1, 0, totalSteps - 1)), [totalSteps])
  const goPrev  = useCallback(() => setStepIndex(i => clamp(i - 1, 0, totalSteps - 1)), [])
  const goReset = useCallback(() => setStepIndex(0), [])

  // Keyboard support
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'Home')        goReset()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, goReset])

  return (
    <div className="page-container page-container--wide">
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Learning Canvas
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
            Interactive algorithm visualiser — step through execution, inspect variables, and understand the logic.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', background: 'var(--color-warning-50)', border: '1px solid var(--color-warning-100)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
          Demo — AI-generated visualisations coming in Phase 3
        </div>
      </div>

      {/* Algorithm title */}
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {artifact.title}
        </h2>
        <span style={{ fontSize: 'var(--text-xs)', background: 'var(--color-gray-100)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontFamily: 'var(--font-mono)' }}>
          {artifact.language}
        </span>
      </div>

      {/* Canvas grid: Code + Variables | Array + Explanation | Controls */}
      <div className="canvas-layout">
        {/* Left column: Code */}
        <CodePanel code={artifact.code} activeLine={currentStep.line} />

        {/* Right column: Vars + Array + Explanation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Variables */}
          <div className="canvas-panel">
            <div className="canvas-panel__header">
              <span className="canvas-panel__title">Variables</span>
            </div>
            <div className="canvas-panel__body">
              <VariableInspector variables={currentStep.variables} markers={currentStep.markers} />
              {Object.keys(currentStep.variables).length === 0 && Object.keys(currentStep.markers).length === 0 && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No variables yet</span>
              )}
            </div>
          </div>

          {/* Array */}
          {currentStep.array.length > 0 && (
            <div className="canvas-panel">
              <div className="canvas-panel__header">
                <span className="canvas-panel__title">Array</span>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                  len = {currentStep.array.length}
                </span>
              </div>
              <div className="canvas-panel__body" style={{ padding: 'var(--space-2)' }}>
                <ArrayVisualizer array={currentStep.array} highlightIndices={currentStep.highlightIndices ?? []} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom row: Explanation (spans 2 cols) */}
        <div className="canvas-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="canvas-panel__header">
            <span className="canvas-panel__title">Execution Explanation</span>
          </div>
          <div className="canvas-panel__body">
            <ExplanationPanel step={currentStep} />
          </div>
        </div>

        {/* Controls (spans 2 cols) */}
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

          {/* Step indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span className="canvas-controls__step-info">
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {artifact.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIndex(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === stepIndex ? 'var(--color-accent-600)' : 'var(--color-gray-200)',
                    border: 'none', cursor: 'pointer', padding: 0,
                    transition: 'background 150ms',
                  }}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            ← → keyboard navigation
          </div>
        </div>
      </div>
    </div>
  )
}
