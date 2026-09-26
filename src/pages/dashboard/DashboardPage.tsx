import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { getGreeting } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import {
  ClipboardCheck, Map, CalendarCheck, TrendingUp, Lock,
  GraduationCap, Target, ArrowRight, CheckCircle,
  Code2, BotMessageSquare, FileText,
} from 'lucide-react'

// ─── Live data ────────────────────────────────────────────────────────────────
interface DashboardStats {
  todayTasksDone: number
  todayTasksTotal: number
  readinessScore: number
  dsaSolved: number
  roadmapPct: number
}

async function loadDashboardStats(studentId: string): Promise<DashboardStats> {
  const today = new Date().toISOString().slice(0, 10)

  const [planRes, skillRes, dsaRes, roadmapRes] = await Promise.all([
    supabase
      .from('daily_plans')
      .select('id')
      .eq('student_id', studentId)
      .eq('plan_date', today)
      .maybeSingle(),
    supabase
      .from('student_latest_skills')
      .select('score')
      .eq('student_id', studentId)
      .limit(50),
    supabase
      .from('leetcode_problems')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'solved'),
    supabase
      .from('roadmaps')
      .select('id')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  // Today's tasks
  let todayTasksDone = 0, todayTasksTotal = 0
  if (planRes.data?.id) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .eq('daily_plan_id', planRes.data.id)
    todayTasksTotal = tasks?.length ?? 0
    todayTasksDone  = tasks?.filter(t => t.status === 'completed').length ?? 0
  }

  // Readiness score — average of latest skill scores
  const scores = (skillRes.data ?? []).map(s => Number(s.score ?? 0))
  const readinessScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0

  // DSA
  const dsaSolved = dsaRes.count ?? 0

  // Roadmap % — completed phases / total phases
  let roadmapPct = 0
  if (roadmapRes.data?.id) {
    const { data: phases } = await supabase
      .from('roadmap_phases')
      .select('status')
      .eq('roadmap_id', roadmapRes.data.id)
    if (phases?.length) {
      const done = phases.filter(p => p.status === 'completed').length
      roadmapPct = Math.round((done / phases.length) * 100)
    }
  }

  return { todayTasksDone, todayTasksTotal, readinessScore, dsaSolved, roadmapPct }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { appUser } = useAuth()
  const profile  = appUser?.profile
  const education = appUser?.education
  const roles    = appUser?.studentRoles ?? []
  const primaryRole = roles.find(r => r.is_primary)

  const greeting = getGreeting(profile?.full_name)

  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    if (!appUser?.auth.id) return
    loadDashboardStats(appUser.auth.id).then(setStats)
  }, [appUser?.auth.id])

  const primaryRoleModules: string[] =
    (primaryRole?.role?.configuration as { modules?: string[] })?.modules ?? []

  const quickActions = [
    {
      id: 'assessment',
      icon: <ClipboardCheck size={16} color="var(--color-accent-600)" />,
      label: 'Where are we?',
      desc:  'Take or review your assessment',
      href: '/assessment',
    },
    {
      id: 'roadmap',
      icon: <Map size={16} color="var(--color-accent-600)" />,
      label: 'View Roadmap',
      desc:  'Your personalised study plan',
      href: '/roadmap',
    },
    {
      id: 'daily',
      icon: <CalendarCheck size={16} color="var(--color-accent-600)" />,
      label: "Today's Plan",
      desc:  'Check your daily tasks',
      href: '/daily',
    },
    {
      id: 'progress',
      icon: <TrendingUp size={16} color="var(--color-accent-600)" />,
      label: 'Progress',
      desc:  'Skill growth over time',
      href: '/progress',
    },
    {
      id: 'dsa',
      icon: <Code2 size={16} color="var(--color-accent-600)" />,
      label: 'DSA Tracker',
      desc:  'Log LeetCode practice',
      href: '/dsa',
    },
    {
      id: 'coach',
      icon: <BotMessageSquare size={16} color="var(--color-accent-600)" />,
      label: 'AI Coach',
      desc:  'Get guidance & adjustments',
      href: '/coach',
    },
    {
      id: 'resume',
      icon: <FileText size={16} color="var(--color-accent-600)" />,
      label: 'Resume',
      desc:  'ATS analysis for your role',
      href: '/resume',
    },
  ]

  const scoreColor = (v: number) =>
    v >= 70 ? 'var(--color-success-600)' : v >= 40 ? 'var(--color-accent-600)' : 'var(--color-danger-600)'

  return (
    <div className="page-container">
      {/* Greeting */}
      <div className="dashboard-greeting">
        <h1 className="dashboard-greeting__text">{greeting}</h1>
        <p className="dashboard-greeting__sub">
          {profile?.onboarding_completed
            ? 'Your preparation workspace is ready.'
            : 'Complete your profile to get started.'}
        </p>
      </div>

      {/* Live stats row */}
      {stats && (
        <div className="stats-row" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="stat-card">
            <div className="stat-card__value" style={{ color: scoreColor(stats.readinessScore) }}>
              {stats.readinessScore}%
            </div>
            <div className="stat-card__label">Readiness Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">
              {stats.todayTasksDone}
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 400, color: 'var(--text-tertiary)' }}>
                /{stats.todayTasksTotal}
              </span>
            </div>
            <div className="stat-card__label">Tasks Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.dsaSolved}</div>
            <div className="stat-card__label">DSA Solved</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.roadmapPct}%</div>
            <div className="stat-card__label">Roadmap Done</div>
          </div>
        </div>
      )}

      {/* Info blocks row */}
      <div className="dashboard-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Education */}
        <div className="info-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <GraduationCap size={14} color="var(--text-tertiary)" />
            <span className="info-block__label" style={{ margin: 0 }}>Education</span>
          </div>
          {education?.degree || education?.branch ? (
            <>
              <div className="info-block__value">
                {[education.degree, education.branch].filter(Boolean).join(' · ')}
              </div>
              <div className="info-block__sub">
                {education.institution && <span>{education.institution}</span>}
                {education.current_year && (
                  <span> · Year {education.current_year}{education.current_semester ? `, Sem ${education.current_semester}` : ''}</span>
                )}
              </div>
              {education.score_value && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Badge variant="default">
                    {education.score_type === 'cgpa' ? `${education.score_value} CGPA` : `${education.score_value}%`}
                  </Badge>
                </div>
              )}
            </>
          ) : (
            <Link to="/settings" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-accent)' }}>
              Complete education profile →
            </Link>
          )}
        </div>

        {/* Target Roles */}
        <div className="info-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <Target size={14} color="var(--text-tertiary)" />
            <span className="info-block__label" style={{ margin: 0 }}>Target Roles</span>
          </div>
          {roles.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {roles.map(sr => (
                <Badge key={sr.id} variant={sr.is_primary ? 'accent' : 'default'}>
                  {sr.role?.name ?? 'Unknown'}
                </Badge>
              ))}
            </div>
          ) : (
            <Link to="/settings" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-accent)' }}>
              Select preparation roles →
            </Link>
          )}
        </div>
      </div>

      {/* Quick actions — all 7 real links */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          Quick Actions
        </h2>
        <div className="next-steps section">
          {quickActions.map(action => (
            <Link
              key={action.id}
              to={action.href}
              className="next-step-item"
              style={{ textDecoration: 'none' }}
            >
              <div className="next-step-item__icon">{action.icon}</div>
              <div>
                <div className="next-step-item__label">{action.label}</div>
                <div className="next-step-item__desc">{action.desc}</div>
              </div>
              <ArrowRight size={14} className="next-step-item__arrow" />
            </Link>
          ))}
        </div>
      </div>

      {/* Role modules preview */}
      {primaryRoleModules.length > 0 && (
        <div>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Preparation Modules
            <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 400 }}>
              — {primaryRole?.role?.name}
            </span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-2)' }}>
            {primaryRoleModules.map((mod, i) => (
              <div
                key={i}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-2)',
                }}
              >
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{mod}</span>
                <Lock size={12} color="var(--text-tertiary)" />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>
            Modules unlock as you progress through your roadmap.
          </p>
        </div>
      )}
    </div>
  )
}
