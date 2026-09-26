/**
 * Progress Page (P2-13)
 * Real Supabase data: assessment history, skill bars, roadmap completion,
 * daily plan streaks. Zero fake data.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingPage } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'
import { loadLatestSkills, computeReadiness, getReadinessTier, READINESS_LABELS, READINESS_COLORS } from '../../features/assessment/skillService'
import type { SkillRow } from '../../features/assessment/skillService'
import { TrendingUp, CheckCircle, Target, Calendar, BarChart2, Brain, ChevronRight, Star } from 'lucide-react'

interface AttemptSummary {
  id: string
  percentage: number
  correct_count: number
  total_questions: number
  submitted_at: string
  assessment: { configuration_json: { roleName?: string } } | null
}

interface RoadmapProgress {
  totalPhases: number
  completedPhases: number
  totalTopics: number
  completedTopics: number
  pct: number
}

export function ProgressPage() {
  const { appUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState<AttemptSummary[]>([])
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [roadmapProgress, setRoadmapProgress] = useState<RoadmapProgress | null>(null)
  const [dailyStreak, setDailyStreak] = useState(0)
  const [tasksToday, setTasksToday] = useState({ done: 0, total: 0 })

  useEffect(() => {
    if (!appUser) return
    loadAll()
  }, [appUser])

  async function loadAll() {
    const uid = appUser!.auth.id
    setLoading(true)

    await Promise.all([
      loadAttempts(uid),
      loadSkills(uid),
      loadRoadmapProgress(uid),
      loadDailyStats(uid),
    ])

    setLoading(false)
  }

  async function loadAttempts(uid: string) {
    const { data } = await supabase
      .from('assessment_attempts')
      .select('id, percentage, correct_count, total_questions, submitted_at, assessment:assessments(configuration_json)')
      .eq('student_id', uid)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })
      .limit(10)

    setAttempts((data ?? []) as unknown as AttemptSummary[])
  }

  async function loadSkills(uid: string) {
    const rows = await loadLatestSkills(uid)
    setSkills(rows.sort((a, b) => b.score - a.score))
  }

  async function loadRoadmapProgress(uid: string) {
    const { data: roadmap } = await supabase
      .from('roadmaps')
      .select('id')
      .eq('student_id', uid)
      .eq('status', 'active')
      .maybeSingle()

    if (!roadmap) return

    const { data: phases } = await supabase
      .from('roadmap_phases')
      .select('id, status, roadmap_phase_topics(status)')
      .eq('roadmap_id', roadmap.id)

    if (!phases) return

    const totalPhases = phases.length
    const completedPhases = phases.filter(p => p.status === 'completed').length
    const totalTopics = phases.reduce((s, p) => s + ((p as any).roadmap_phase_topics?.length ?? 0), 0)
    const completedTopics = phases.reduce(
      (s, p) => s + ((p as any).roadmap_phase_topics?.filter((t: any) => t.status === 'completed').length ?? 0), 0
    )
    const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0

    setRoadmapProgress({ totalPhases, completedPhases, totalTopics, completedTopics, pct })
  }

  async function loadDailyStats(uid: string) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: plan } = await supabase
      .from('daily_plans')
      .select('id')
      .eq('student_id', uid)
      .eq('plan_date', today)
      .maybeSingle()

    if (!plan) return

    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .eq('daily_plan_id', plan.id)

    const total = tasks?.length ?? 0
    const done = tasks?.filter(t => t.status === 'completed').length ?? 0
    setTasksToday({ done, total })

    // Streak — count consecutive days with a plan
    const { data: plans } = await supabase
      .from('daily_plans')
      .select('plan_date')
      .eq('student_id', uid)
      .order('plan_date', { ascending: false })
      .limit(30)

    if (plans) {
      let streak = 0
      let current = new Date()
      for (const p of plans) {
        const d = new Date(p.plan_date)
        const diff = Math.round((current.getTime() - d.getTime()) / 86400000)
        if (diff <= 1) { streak++; current = d }
        else break
      }
      setDailyStreak(streak)
    }
  }

  if (loading) return <LoadingPage />

  const hasAnyData = attempts.length > 0 || skills.length > 0

  if (!hasAnyData) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-header__title">Progress</h1>
          <p className="page-header__subtitle">Track your preparation improvements over time</p>
        </div>
        <EmptyState
          icon={<TrendingUp size={40} />}
          title="No progress data yet"
          description="Take an assessment to start tracking your skill profile, score trends, and roadmap progress."
          action={<Link to="/assessment"><Button>Start Assessment <ChevronRight size={14} /></Button></Link>}
        />
      </div>
    )
  }

  const readiness = computeReadiness(skills)
  const tier = getReadinessTier(readiness)

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Progress</h1>
        <p className="page-header__subtitle">Your placement preparation metrics, all real data.</p>
      </div>

      {/* ── Top stat cards ── */}
      <div className="progress-stat-grid">
        <StatCard
          icon={<Brain size={18} color="var(--color-accent-500)" />}
          label="Placement Readiness"
          value={`${readiness}%`}
          sub={READINESS_LABELS[tier]}
          color={READINESS_COLORS[tier]}
        />
        <StatCard
          icon={<BarChart2 size={18} color="var(--color-accent-500)" />}
          label="Assessments Taken"
          value={String(attempts.length)}
          sub={attempts.length > 0 ? `Last: ${Math.round(Number(attempts[attempts.length - 1]?.percentage ?? 0))}%` : 'No attempts yet'}
          color="var(--color-accent-500)"
        />
        <StatCard
          icon={<Calendar size={18} color="var(--color-accent-500)" />}
          label="Daily Streak"
          value={String(dailyStreak)}
          sub={dailyStreak === 1 ? 'day' : 'days'}
          color={dailyStreak >= 7 ? 'var(--color-warning-600)' : 'var(--color-accent-500)'}
        />
        {tasksToday.total > 0 && (
          <StatCard
            icon={<CheckCircle size={18} color="var(--color-success-600)" />}
            label="Today's Tasks"
            value={`${tasksToday.done}/${tasksToday.total}`}
            sub={`${Math.round((tasksToday.done / tasksToday.total) * 100)}% complete`}
            color="var(--color-success-600)"
          />
        )}
      </div>

      {/* ── Two column below ── */}
      <div className="progress-two-col">

        {/* Assessment score trend */}
        {attempts.length > 0 && (
          <div className="section">
            <div className="section__header">
              <span className="section__title">Assessment Score Trend</span>
              <Link to="/assessment" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-600)' }}>
                Take another
              </Link>
            </div>
            <div className="section__body">
              {/* Simple bar chart */}
              <div className="progress-score-bars">
                {attempts.map((a, i) => {
                  const pct = Math.round(Number(a.percentage ?? 0))
                  const date = a.submitted_at
                    ? new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : `#${i + 1}`
                  return (
                    <div key={a.id} className="progress-score-bar-col">
                      <span className="progress-score-bar-value">{pct}%</span>
                      <div className="progress-score-bar-track">
                        <div
                          className="progress-score-bar-fill"
                          style={{
                            height: `${pct}%`,
                            background: pct >= 70
                              ? 'var(--color-success-600)'
                              : pct >= 50
                                ? 'var(--color-accent-500)'
                                : 'var(--color-danger-600)',
                          }}
                        />
                      </div>
                      <span className="progress-score-bar-date">{date}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Skill profile */}
        {skills.length > 0 && (
          <div className="section">
            <div className="section__header">
              <span className="section__title">Skill Profile</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: READINESS_COLORS[tier],
                }} />
                <span style={{ fontSize: 'var(--text-xs)', color: READINESS_COLORS[tier], fontWeight: 600 }}>
                  {READINESS_LABELS[tier]}
                </span>
              </div>
            </div>
            <div className="section__body skill-bar-list">
              {skills.map(s => {
                const pct = Math.round(Number(s.score))
                const isStrong = pct >= 70
                const isWeak   = pct < 50
                return (
                  <div key={s.topic} className="skill-bar-row">
                    <div className="skill-bar-row__label">
                      {isStrong && <Star size={11} color="var(--color-warning-600)" fill="var(--color-warning-600)" />}
                      {isWeak && <Target size={11} color="var(--color-danger-600)" />}
                      <span>{s.topic}</span>
                    </div>
                    <div className="skill-bar-row__track">
                      <div
                        className="skill-bar-row__fill"
                        style={{
                          width: `${pct}%`,
                          background: isStrong
                            ? 'var(--color-success-600)'
                            : isWeak
                              ? 'var(--color-danger-600)'
                              : 'var(--color-accent-500)',
                        }}
                      />
                    </div>
                    <span className="skill-bar-row__pct">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Roadmap progress */}
        {roadmapProgress && (
          <div className="section">
            <div className="section__header">
              <span className="section__title">Roadmap Progress</span>
              <Link to="/roadmap" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-600)' }}>
                View roadmap
              </Link>
            </div>
            <div className="section__body">
              <div className="roadmap-progress-ring-wrap">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--color-gray-200)" strokeWidth="7" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke={roadmapProgress.pct >= 100 ? 'var(--color-success-600)' : 'var(--color-accent-500)'}
                    strokeWidth="7"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - roadmapProgress.pct / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className="roadmap-progress-ring-text">
                  <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{roadmapProgress.pct}%</span>
                </div>
              </div>
              <div className="roadmap-progress-stats">
                <div>
                  <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {roadmapProgress.completedPhases}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>/{roadmapProgress.totalPhases} phases done</span>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {roadmapProgress.completedTopics}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>/{roadmapProgress.totalTopics} topics covered</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="progress-stat-card">
      <div className="progress-stat-card__icon">{icon}</div>
      <div className="progress-stat-card__label">{label}</div>
      <div className="progress-stat-card__value" style={{ color }}>{value}</div>
      <div className="progress-stat-card__sub">{sub}</div>
    </div>
  )
}
