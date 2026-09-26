/**
 * Assessment Result Page (P2-7)
 *
 * Loaded at /assessment/result/:attemptId
 * Reads the submitted attempt from Supabase (all data already written by
 * AssessmentActivePage → submitAttempt), displays results, and offers CTAs.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { LoadingPage } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'
import { upsertSkillsFromResult } from '../../features/assessment/skillService'
import {
  getReadinessTier,
  READINESS_LABELS,
  READINESS_COLORS,
} from '../../features/assessment/skillService'
import type { AssessmentResult, AssessmentConfig, TopicScore, DifficultyScore } from '../../features/assessment/assessmentTypes'
import {
  CheckCircle, XCircle, Minus, TrendingUp, Target, ChevronRight, Clock, Map,
} from 'lucide-react'

interface AttemptData {
  id: string
  percentage: number
  correct_count: number
  wrong_count: number
  skipped_count: number
  total_questions: number
  time_taken_seconds: number
  result_json: {
    topic_scores?: TopicScore[]
    difficulty_scores?: DifficultyScore[]
    strong_topics?: string[]
    weak_topics?: string[]
  }
  assessment: {
    configuration_json: AssessmentConfig
    roles?: { name: string } | null
  }
}

export function AssessmentResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const { appUser } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState<AttemptData | null>(null)
  const [skillsUpserted, setSkillsUpserted] = useState(false)

  useEffect(() => {
    if (!attemptId) return

    async function load() {
      const { data, error } = await supabase
        .from('assessment_attempts')
        .select(`
          id, percentage, correct_count, wrong_count, skipped_count,
          total_questions, time_taken_seconds, result_json,
          assessment:assessments(configuration_json, roles(name))
        `)
        .eq('id', attemptId)
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      setAttempt(data as unknown as AttemptData)
      setLoading(false)

      // Upsert skills if not done yet
      const attemptData = data as unknown as AttemptData
      if (!skillsUpserted && appUser && attemptData.result_json?.topic_scores?.length) {
        setSkillsUpserted(true)
        const cfg = attemptData.assessment?.configuration_json
        await upsertSkillsFromResult(
          appUser.auth.id,
          cfg?.roleId ?? '',
          attemptData.id,
          {
            totalQuestions:   attemptData.total_questions ?? 0,
            correctCount:     attemptData.correct_count ?? 0,
            wrongCount:       attemptData.wrong_count ?? 0,
            skippedCount:     attemptData.skipped_count ?? 0,
            score:            attemptData.correct_count ?? 0,
            percentage:       Number(attemptData.percentage ?? 0),
            timeTakenSeconds: attemptData.time_taken_seconds ?? 0,
            topicScores:      attemptData.result_json.topic_scores ?? [],
            difficultyScores: attemptData.result_json.difficulty_scores ?? [],
            strongTopics:     attemptData.result_json.strong_topics ?? [],
            weakTopics:       attemptData.result_json.weak_topics ?? [],
          } as AssessmentResult,
        )
      }
    }

    load()
  }, [attemptId, appUser])

  if (loading) return <LoadingPage />

  if (!attempt) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Result not found.</p>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button onClick={() => navigate('/assessment')}>Back to Assessment</Button>
          </div>
        </div>
      </div>
    )
  }

  const pct = Math.round(Number(attempt.percentage ?? 0))
  const tier = getReadinessTier(pct)
  const tierLabel = READINESS_LABELS[tier]
  const tierColor = READINESS_COLORS[tier]
  const topicScores: TopicScore[] = attempt.result_json?.topic_scores ?? []
  const diffScores: DifficultyScore[] = attempt.result_json?.difficulty_scores ?? []
  const strongTopics: string[] = attempt.result_json?.strong_topics ?? []
  const weakTopics: string[] = attempt.result_json?.weak_topics ?? []

  const mins = Math.floor((attempt.time_taken_seconds ?? 0) / 60)
  const secs = (attempt.time_taken_seconds ?? 0) % 60

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        borderBottom: '1px solid var(--color-gray-200)',
        padding: 'var(--space-4) var(--space-6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-surface)',
      }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
          Assessment Complete
        </span>
        <Link to="/dashboard">
          <Button variant="secondary" size="sm">Back to Dashboard</Button>
        </Link>
      </header>

      <main style={{ flex: 1, maxWidth: '860px', margin: '0 auto', width: '100%', padding: 'var(--space-8) var(--space-6)' }}>

        {/* ── Hero score card ── */}
        <div className="result-hero-card">
          <div className="result-score-ring" style={{ '--ring-color': tierColor } as React.CSSProperties}>
            <span className="result-score-pct">{pct}%</span>
            <span className="result-score-label">Score</span>
          </div>

          <div className="result-hero-info">
            <div className="result-tier-badge" style={{ color: tierColor, borderColor: tierColor }}>
              {tierLabel}
            </div>
            <h1 className="result-hero-title">
              {attempt.assessment?.roles?.name ?? attempt.assessment?.configuration_json?.roleName ?? 'Assessment'}
            </h1>

            {/* Quick stats */}
            <div className="result-stats-row">
              <div className="result-stat">
                <CheckCircle size={15} color="var(--color-success-600)" />
                <span className="result-stat__value" style={{ color: 'var(--color-success-600)' }}>{attempt.correct_count}</span>
                <span className="result-stat__label">Correct</span>
              </div>
              <div className="result-stat">
                <XCircle size={15} color="var(--color-danger-600)" />
                <span className="result-stat__value" style={{ color: 'var(--color-danger-600)' }}>{attempt.wrong_count}</span>
                <span className="result-stat__label">Wrong</span>
              </div>
              <div className="result-stat">
                <Minus size={15} color="var(--text-tertiary)" />
                <span className="result-stat__value" style={{ color: 'var(--text-tertiary)' }}>{attempt.skipped_count}</span>
                <span className="result-stat__label">Skipped</span>
              </div>
              <div className="result-stat">
                <Clock size={15} color="var(--text-secondary)" />
                <span className="result-stat__value">{mins}m {secs}s</span>
                <span className="result-stat__label">Time</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Two column: Topic breakdown + Highlights ── */}
        <div className="result-grid">

          {/* Topic breakdown */}
          <div className="section">
            <div className="section__header">
              <span className="section__title">Topic Breakdown</span>
            </div>
            <div className="section__body result-topic-list">
              {topicScores.length === 0 && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>No topic data.</p>
              )}
              {topicScores.sort((a, b) => b.percentage - a.percentage).map(ts => (
                <div key={ts.topic} className="result-topic-row">
                  <div className="result-topic-row__name">{ts.topic}</div>
                  <div className="result-topic-row__bar-wrap">
                    <div
                      className="result-topic-row__bar"
                      style={{
                        width: `${ts.percentage}%`,
                        background: ts.percentage >= 70
                          ? 'var(--color-success-600)'
                          : ts.percentage >= 50
                            ? 'var(--color-accent-500)'
                            : 'var(--color-danger-600)',
                      }}
                    />
                  </div>
                  <span className="result-topic-row__pct">{ts.percentage}%</span>
                  <span className="result-topic-row__frac" style={{ color: 'var(--text-tertiary)' }}>
                    {ts.correct}/{ts.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

            {/* Difficulty breakdown */}
            {diffScores.length > 0 && (
              <div className="section">
                <div className="section__header">
                  <span className="section__title">By Difficulty</span>
                </div>
                <div className="section__body result-diff-list">
                  {diffScores.map(ds => (
                    <div key={ds.difficulty} className="result-topic-row">
                      <div className="result-topic-row__name" style={{ textTransform: 'capitalize' }}>{ds.difficulty}</div>
                      <div className="result-topic-row__bar-wrap">
                        <div
                          className="result-topic-row__bar"
                          style={{
                            width: `${ds.percentage}%`,
                            background: ds.difficulty === 'easy'
                              ? 'var(--color-success-600)'
                              : ds.difficulty === 'medium'
                                ? 'var(--color-accent-500)'
                                : 'var(--color-warning-600)',
                          }}
                        />
                      </div>
                      <span className="result-topic-row__pct">{ds.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strong / Weak areas */}
            <div className="section">
              <div className="section__header"><span className="section__title">Highlights</span></div>
              <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                {strongTopics.length > 0 && (
                  <div>
                    <div className="result-highlight-label" style={{ color: 'var(--color-success-600)' }}>
                      <TrendingUp size={13} /> Strong areas
                    </div>
                    <div className="result-chip-row">
                      {strongTopics.map(t => (
                        <span key={t} className="result-chip result-chip--strong">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {weakTopics.length > 0 && (
                  <div>
                    <div className="result-highlight-label" style={{ color: 'var(--color-danger-600)' }}>
                      <Target size={13} /> Focus areas
                    </div>
                    <div className="result-chip-row">
                      {weakTopics.map(t => (
                        <span key={t} className="result-chip result-chip--weak">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {!strongTopics.length && !weakTopics.length && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    Complete more topics for a detailed breakdown.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA Row ── */}
        <div className="result-cta-row">
          <Link to="/roadmap">
            <Button>
              <Map size={15} />
              Generate My Roadmap
              <ChevronRight size={15} />
            </Button>
          </Link>
          <Link to="/assessment">
            <Button variant="secondary">Retake Assessment</Button>
          </Link>
          <Link to="/progress">
            <Button variant="ghost">View Progress</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
