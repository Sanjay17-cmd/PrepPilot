import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { LoadingPage } from '../../components/ui/Loading'
import {
  loadQuestionPool,
  submitAttempt,
} from '../../features/assessment/assessmentService'
import { buildQuestionSequence, calculateResult } from '../../features/assessment/adaptiveEngine'
import { useTimer } from '../../features/assessment/useTimer'
import { useViolationMonitor } from '../../features/assessment/useViolationMonitor'
import type { StoredQuestion, AssessmentConfig, QuestionAttemptRecord } from '../../features/assessment/assessmentTypes'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, ChevronRight, Clock, Maximize2, AlertTriangle } from 'lucide-react'

// -------------------------------------------------------------------------
// Active Assessment — fullscreen, distraction-free
// -------------------------------------------------------------------------
export function AssessmentActivePage() {
  const { assessmentId, attemptId } = useParams<{ assessmentId: string; attemptId: string }>()
  const { appUser } = useAuth()
  const { error: toastError } = useToast()
  const navigate = useNavigate()

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sequence, setSequence] = useState<StoredQuestion[]>([])
  const [config, setConfig] = useState<AssessmentConfig | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [violationAlert, setViolationAlert] = useState<string | null>(null)
  const startedAt = useRef(new Date())
  const questionStartTime = useRef(Date.now())
  const questionTimings = useRef<Record<string, number>>({})

  // Violation monitor
  const { startMonitoring, getViolations, requestFullscreen, exitFullscreen } = useViolationMonitor()

  // -----------------------------------------------------------------------
  // Load assessment data
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!assessmentId || !attemptId) return

    async function load() {
      try {
        // Load config from assessments table
        const { data: assessment, error } = await supabase
          .from('assessments')
          .select('configuration_json')
          .eq('id', assessmentId)
          .single()

        if (error || !assessment) throw new Error('Assessment not found.')

        const cfg = assessment.configuration_json as AssessmentConfig
        setConfig(cfg)

        // Load question pool
        const pool = await loadQuestionPool(assessmentId!)

        if (pool.length === 0) throw new Error('No questions found for this assessment.')

        // Build adaptive sequence locally
        const initialDiff = cfg.difficulty === 'adaptive' || cfg.difficulty === 'medium'
          ? 'medium'
          : cfg.difficulty === 'easy' ? 'easy' : 'hard'

        const seq = buildQuestionSequence(pool, cfg, initialDiff)
        if (seq.length === 0) throw new Error('Could not build question sequence.')

        setSequence(seq)
        setLoading(false)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load assessment.')
        setLoading(false)
      }
    }

    load()
  }, [assessmentId, attemptId])

  // -----------------------------------------------------------------------
  // Start monitoring after load
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (loading || loadError) return
    const stopMonitoring = startMonitoring()

    // Track fullscreen state
    const onFSChange = () => {
      const inFS = !!document.fullscreenElement
      setIsFullscreen(inFS)
      if (!inFS && !submitted) {
        setViolationAlert('You exited fullscreen. Return to fullscreen for a focused environment.')
        setTimeout(() => setViolationAlert(null), 5000)
      }
    }
    document.addEventListener('fullscreenchange', onFSChange)

    // Request fullscreen
    requestFullscreen().then(() => setIsFullscreen(true))

    return () => {
      stopMonitoring()
      document.removeEventListener('fullscreenchange', onFSChange)
      exitFullscreen()
    }
  }, [loading, loadError])

  // -----------------------------------------------------------------------
  // Timer setup — auto-submit on expire
  // -----------------------------------------------------------------------
  const handleTimeExpired = useCallback(() => {
    if (!submitted) handleSubmit(true)
  }, [submitted])  // eslint-disable-line

  const timeLimitSeconds = (config?.timeLimitMinutes ?? 30) * 60
  const timer = useTimer(timeLimitSeconds, handleTimeExpired)

  useEffect(() => {
    if (!loading && sequence.length > 0) {
      timer.start()
      startedAt.current = new Date()
    }
  }, [loading, sequence.length])  // eslint-disable-line

  // -----------------------------------------------------------------------
  // Keyboard navigation
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 1-4 to select option
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1
        const keys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
        if (sequence[currentIndex]) {
          selectAnswer(sequence[currentIndex].id, keys[idx])
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'n') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'b') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIndex, sequence])  // eslint-disable-line

  // -----------------------------------------------------------------------
  // Answer selection
  // -----------------------------------------------------------------------
  const selectAnswer = useCallback((questionId: string, optionKey: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionKey }))
  }, [])

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  const recordQuestionTime = useCallback((qId: string) => {
    const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000)
    questionTimings.current[qId] = (questionTimings.current[qId] ?? 0) + elapsed
    questionStartTime.current = Date.now()
  }, [])

  const goNext = useCallback(() => {
    if (sequence[currentIndex]) recordQuestionTime(sequence[currentIndex].id)
    setCurrentIndex(i => Math.min(i + 1, sequence.length - 1))
  }, [currentIndex, sequence, recordQuestionTime])

  const goPrev = useCallback(() => {
    if (sequence[currentIndex]) recordQuestionTime(sequence[currentIndex].id)
    setCurrentIndex(i => Math.max(i - 1, 0))
  }, [currentIndex, sequence, recordQuestionTime])

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------
  const handleSubmit = useCallback(async (timedOut = false) => {
    if (submitting || submitted) return
    setSubmitting(true)

    if (sequence[currentIndex]) recordQuestionTime(sequence[currentIndex].id)
    timer.pause()

    const timeTaken = Math.floor((Date.now() - startedAt.current.getTime()) / 1000)
    const result    = calculateResult(sequence, answers, timeTaken)
    const violations = getViolations()

    // Build per-question records
    const qRecords: QuestionAttemptRecord[] = sequence.map((q, idx) => ({
      attempt_id:         attemptId!,
      question_id:        q.id,
      student_id:         appUser!.auth.id,
      selected_answer:    answers[q.id] ?? null,
      correct:            answers[q.id] ? answers[q.id] === q.question_data.correct_answer : null,
      presented_order:    idx + 1,
      time_spent_seconds: questionTimings.current[q.id] ?? 0,
      topic:              q.topic,
      difficulty:         q.difficulty,
    }))

    try {
      await submitAttempt(attemptId!, result, violations, qRecords, startedAt.current)
      await exitFullscreen()
      setSubmitted(true)
      navigate(`/assessment/result/${attemptId}`, { replace: true })
    } catch (err) {
      toastError('Failed to submit. Please try again.')
      setSubmitting(false)
      timer.start()
    }
  }, [submitting, submitted, sequence, answers, currentIndex, attemptId, appUser, timer])  // eslint-disable-line

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------
  if (loading) return <LoadingPage />

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <AlertTriangle size={40} color="var(--color-danger-600)" style={{ margin: '0 auto var(--space-4)' }} />
          <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{loadError}</p>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button onClick={() => navigate('/assessment')}>Back to Assessment</Button>
          </div>
        </div>
      </div>
    )
  }

  const q = sequence[currentIndex]
  if (!q) return null

  const isLast     = currentIndex === sequence.length - 1
  const isFirst    = currentIndex === 0
  const answered   = Object.keys(answers).filter(k => answers[k] !== null).length
  const totalQ     = sequence.length
  const progress   = ((currentIndex + 1) / totalQ) * 100

  return (
    <div className="assessment-shell">
      {/* ------------------------------------------------------------------ */}
      {/* TOP BAR                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="assessment-header">
        <div className="assessment-header__left">
          <span className="assessment-header__title">
            {config?.roleName ?? 'Assessment'}
          </span>
          <span className="assessment-header__meta">
            {answered} / {totalQ} answered
          </span>
        </div>

        {/* Progress bar */}
        <div className="assessment-progress-bar">
          <div
            className="assessment-progress-bar__fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="assessment-header__right">
          {/* Timer */}
          <div
            className={`assessment-timer ${timer.isWarning ? 'warning' : ''} ${timer.isCritical ? 'critical' : ''}`}
          >
            <Clock size={14} />
            {timer.formatted}
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={() => isFullscreen ? exitFullscreen() : requestFullscreen()}
            className="assessment-icon-btn"
            aria-label="Toggle fullscreen"
            title="Toggle fullscreen"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </header>

      {/* Violation alert banner */}
      {violationAlert && (
        <div className="assessment-violation-banner">
          <AlertTriangle size={14} />
          {violationAlert}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* QUESTION AREA                                                        */}
      {/* ------------------------------------------------------------------ */}
      <main className="assessment-main">
        <div className="question-card">
          {/* Question meta */}
          <div className="question-card__meta">
            <span className="question-card__meta-badge question-card__meta-badge--topic">
              {q.topic}
            </span>
            {q.subtopic && (
              <span className="question-card__meta-badge">
                {q.subtopic}
              </span>
            )}
            <span className={`question-card__meta-badge question-card__meta-badge--diff question-card__meta-badge--${q.difficulty}`}>
              {q.difficulty}
            </span>
            <span className="question-card__counter">
              Question {currentIndex + 1} <span style={{ color: 'var(--text-tertiary)' }}>of {totalQ}</span>
            </span>
          </div>

          {/* Question text */}
          <p className="question-card__text">
            {q.question_data.question}
          </p>

          {/* Options */}
          <div className="question-options">
            {q.question_data.options.map((opt, optIdx) => {
              const keys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
              const key     = keys[optIdx]
              const isSelected = answers[q.id] === key
              // Remove the "A: " prefix from display — it's added by the engine
              const text    = opt.replace(/^[A-D]:\s*/, '')

              return (
                <button
                  key={key}
                  id={`opt-${key}`}
                  className={`question-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectAnswer(q.id, key)}
                  aria-label={`Option ${key}: ${text}`}
                >
                  <span className="question-option__key">{key}</span>
                  <span className="question-option__text">{text}</span>
                  {isSelected && (
                    <span className="question-option__check" aria-hidden="true">✓</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Keyboard hint */}
          <div className="question-card__hint">
            Press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> to select · <kbd>←</kbd> <kbd>→</kbd> to navigate
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM NAVIGATION                                                    */}
      {/* ------------------------------------------------------------------ */}
      <footer className="assessment-footer">
        {/* Question dots */}
        <div className="assessment-dots">
          {sequence.map((sq, i) => {
            const hasAnswer = answers[sq.id] !== undefined && answers[sq.id] !== null
            const isCurrent = i === currentIndex
            return (
              <button
                key={sq.id}
                onClick={() => setCurrentIndex(i)}
                className={`assessment-dot ${isCurrent ? 'current' : ''} ${hasAnswer ? 'answered' : ''}`}
                aria-label={`Question ${i + 1}${hasAnswer ? ' (answered)' : ''}`}
                title={`Q${i + 1} · ${sq.topic}`}
              />
            )
          })}
        </div>

        {/* Nav buttons */}
        <div className="assessment-footer__nav">
          <Button
            variant="secondary"
            onClick={goPrev}
            disabled={isFirst}
            id="prev-btn"
          >
            <ChevronLeft size={16} />
            Previous
          </Button>

          {isLast ? (
            <Button
              onClick={() => handleSubmit(false)}
              loading={submitting}
              id="submit-assessment-btn"
              style={{ minWidth: '160px' }}
            >
              Submit Assessment
            </Button>
          ) : (
            <Button
              onClick={goNext}
              id="next-btn"
            >
              Next
              <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
