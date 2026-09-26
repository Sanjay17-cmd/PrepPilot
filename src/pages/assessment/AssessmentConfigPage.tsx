import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/Loading'
import {
  getTopicsForRole,
  ASSESSMENT_QUESTION_COUNTS,
  ASSESSMENT_TIME_LIMITS,
  ASSESSMENT_DIFFICULTIES,
  type TopicConfig,
} from '../../config/roleTopics'
import {
  createAssessment,
  loadPastAttempts,
} from '../../features/assessment/assessmentService'
import { generateMCQPool } from '../../features/assessment/aiService'
import { storeQuestionPool, createAttempt, findExistingPool } from '../../features/assessment/assessmentService'
import type { AssessmentConfig } from '../../features/assessment/assessmentTypes'
import { ClipboardCheck, Clock, CheckCircle, BookOpen, ChevronRight } from 'lucide-react'
import { formatDate } from '../../lib/utils'

export function AssessmentPage() {
  const { appUser } = useAuth()
  const { error: toastError } = useToast()
  const navigate = useNavigate()

  const roles = appUser?.studentRoles ?? []
  const [selectedRoleIdx, setSelectedRoleIdx] = useState(0)
  const [questionCount, setQuestionCount] = useState<number>(10)
  const [timeLimit, setTimeLimit] = useState<number>(30)
  const [difficulty, setDifficulty] = useState<AssessmentConfig['difficulty']>('adaptive')
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([])
  const [topics, setTopics] = useState<TopicConfig[]>([])

  const [starting, setStarting] = useState(false)
  const [pastAttempts, setPastAttempts] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const activeRole = roles[selectedRoleIdx]
  const roleSlug   = activeRole?.role?.slug ?? ''

  // Load topics when role changes
  useEffect(() => {
    if (!roleSlug) return
    const t = getTopicsForRole(roleSlug)
    setTopics(t)
    setSelectedTopicIds(t.map(tc => tc.id))  // all selected by default
  }, [roleSlug])

  // Load past attempts
  useEffect(() => {
    if (!appUser) return
    loadPastAttempts(appUser.auth.id).then(data => {
      setPastAttempts(data)
      setLoadingHistory(false)
    })
  }, [appUser])

  const toggleTopic = (id: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const selectAll  = () => setSelectedTopicIds(topics.map(t => t.id))
  const selectNone = () => setSelectedTopicIds([])

  const canStart = selectedTopicIds.length > 0 && !!activeRole

  const handleStart = async () => {
    if (!canStart || !appUser) return
    setStarting(true)

    const config: AssessmentConfig = {
      roleId:           activeRole.role_id,
      roleSlug,
      roleName:         activeRole.role?.name ?? 'Unknown',
      selectedTopicIds,
      questionCount,
      timeLimitMinutes: timeLimit,
      difficulty,
    }

    try {
      const poolSize = questionCount * 2

      // 1. Create assessment record
      const assessmentId = await createAssessment(appUser.auth.id, config)

      // 2. Generate question pool via AI gateway
      const { questions, aiRunId } = await generateMCQPool(config, poolSize)

      // 3. Store pool
      await storeQuestionPool(assessmentId, aiRunId, questions)

      // 4. Create attempt
      const attemptId = await createAttempt(assessmentId, appUser.auth.id)

      // 5. Navigate to fullscreen assessment
      navigate(`/assessment/active/${assessmentId}/${attemptId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start assessment.'
      toastError(msg)
      setStarting(false)
    }
  }

  if (roles.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-header__title">Where Are We?</h1>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-secondary)' }}>
          <BookOpen size={40} color="var(--text-tertiary)" style={{ margin: '0 auto var(--space-4)' }} />
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>No roles selected</p>
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
            Select your target role in Settings to take an assessment.
          </p>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Where Are We?</h1>
        <p className="page-header__subtitle">
          Measure your current preparation level and identify what to work on next.
        </p>
      </div>

      <div className="assessment-config-grid">
        {/* Left — Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Role selector */}
          {roles.length > 1 && (
            <div className="section">
              <div className="section__header"><span className="section__title">Preparing for</span></div>
              <div className="section__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {roles.map((sr, idx) => (
                  <button
                    key={sr.id}
                    onClick={() => setSelectedRoleIdx(idx)}
                    className={`role-selector-btn ${selectedRoleIdx === idx ? 'active' : ''}`}
                  >
                    {sr.role?.name ?? 'Unknown'}
                    {sr.is_primary && <span className="role-selector-btn__primary">Primary</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          <div className="section">
            <div className="section__header">
              <span className="section__title">Syllabus Topics</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={selectAll}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  All
                </button>
                <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                <button
                  onClick={selectNone}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  None
                </button>
              </div>
            </div>
            <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {topics.map(topic => {
                const isSelected = selectedTopicIds.includes(topic.id)
                return (
                  <label
                    key={topic.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      border: `1px solid ${isSelected ? 'var(--color-accent-200)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--color-accent-50)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={isSelected}
                      onChange={() => toggleTopic(topic.id)}
                      id={`topic-${topic.id}`}
                    />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: isSelected ? 500 : 400, color: isSelected ? 'var(--color-accent-700)' : 'var(--text-primary)', flex: 1 }}>
                      {topic.label}
                    </span>
                    {topic.weight >= 3 && (
                      <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-500)' }}>
                        Key topic
                      </span>
                    )}
                  </label>
                )
              })}
              {selectedTopicIds.length === 0 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-600)', marginTop: 'var(--space-1)' }}>
                  Select at least one topic to continue.
                </p>
              )}
            </div>
          </div>

          {/* Options row */}
          <div className="section">
            <div className="section__header"><span className="section__title">Options</span></div>
            <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

              {/* Questions */}
              <div>
                <label className="form-label">Number of questions</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  {ASSESSMENT_QUESTION_COUNTS.map(n => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={`option-pill ${questionCount === n ? 'active' : ''}`}
                      id={`qcount-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                  AI will generate {questionCount * 2} questions ({questionCount}×2 pool) for adaptive selection.
                </p>
              </div>

              {/* Time */}
              <div>
                <label className="form-label">Time limit</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {ASSESSMENT_TIME_LIMITS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTimeLimit(t.value)}
                      className={`option-pill ${timeLimit === t.value ? 'active' : ''}`}
                      id={`timelimit-${t.value}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="form-label">Difficulty</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  {ASSESSMENT_DIFFICULTIES.map(d => (
                    <label
                      key={d.value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)',
                        border: `1px solid ${difficulty === d.value ? 'var(--color-accent-200)' : 'var(--border-color)'}`,
                        borderRadius: 'var(--radius-md)',
                        background: difficulty === d.value ? 'var(--color-accent-50)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                    >
                      <input
                        type="radio"
                        name="difficulty"
                        value={d.value}
                        checked={difficulty === d.value}
                        onChange={() => setDifficulty(d.value as AssessmentConfig['difficulty'])}
                        className="form-checkbox"
                      />
                      <div>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: difficulty === d.value ? 'var(--color-accent-700)' : 'var(--text-primary)' }}>
                          {d.label}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>
                          — {d.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Preview card + Start */}
        <div>
          <div className="section" style={{ position: 'sticky', top: 'var(--space-6)' }}>
            <div className="section__header">
              <span className="section__title">Assessment Preview</span>
            </div>
            <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Role */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Role</span>
                <Badge variant="accent">{activeRole?.role?.name ?? '—'}</Badge>
              </div>
              {/* Topics */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Topics</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedTopicIds.length} selected</span>
              </div>
              {/* Mode */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Mode</span>
                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{difficulty}</span>
              </div>
              {/* Questions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Questions</span>
                <span style={{ fontWeight: 500 }}>{questionCount}</span>
              </div>
              {/* Pool */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>AI pool size</span>
                <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}>{questionCount * 2} (2×)</span>
              </div>
              {/* Time */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Time limit</span>
                <span style={{ fontWeight: 500 }}>{timeLimit} min</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* Start button */}
              <Button
                onClick={handleStart}
                loading={starting}
                disabled={!canStart}
                fullWidth
                size="lg"
                id="start-assessment-btn"
              >
                {starting ? 'Generating questions…' : 'Start Assessment'}
                {!starting && <ChevronRight size={16} />}
              </Button>

              {starting && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 'var(--leading-relaxed)' }}>
                  Generating {questionCount * 2} questions with AI. This takes 5–10 seconds.
                </p>
              )}

              <div style={{ background: 'var(--color-gray-50)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 'var(--leading-relaxed)' }}>
                The assessment will open in fullscreen. Timer starts immediately. Previous attempts are always preserved.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Past attempts */}
      <div style={{ marginTop: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
          Assessment History
        </h2>
        <div className="section" style={{ padding: 0 }}>
          {loadingHistory ? (
            <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : pastAttempts.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              <ClipboardCheck size={32} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
              No attempts yet. Start your first assessment above.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Role</th>
                  <th>Questions</th>
                  <th>Score</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {pastAttempts.map((attempt: any) => (
                  <tr key={attempt.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {attempt.submitted_at ? formatDate(attempt.submitted_at) : '—'}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {(attempt.assessment as any)?.roles?.name ?? '—'}
                    </td>
                    <td>{attempt.total_questions ?? '—'}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: (attempt.percentage ?? 0) >= 60 ? 'var(--color-success-600)' : 'var(--color-danger-600)' }}>
                        {attempt.correct_count ?? 0} / {attempt.total_questions ?? 0}
                      </span>
                    </td>
                    <td>
                      <Badge variant={(attempt.percentage ?? 0) >= 70 ? 'success' : (attempt.percentage ?? 0) >= 50 ? 'warning' : 'danger'}>
                        {attempt.percentage ?? 0}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
