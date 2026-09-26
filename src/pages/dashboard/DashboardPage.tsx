import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { getGreeting } from '../../lib/utils'
import {
  ClipboardCheck, Map, CalendarCheck, TrendingUp, Lock,
  GraduationCap, Target, ArrowRight, CheckCircle,
} from 'lucide-react'
import { FEATURE_FLAGS } from '../../config/app'

export function DashboardPage() {
  const { appUser } = useAuth()
  const profile = appUser?.profile
  const education = appUser?.education
  const roles = appUser?.studentRoles ?? []
  const primaryRole = roles.find((r) => r.is_primary)

  const greeting = getGreeting(profile?.full_name)

  const nextSteps = [
    {
      id: 'assessment',
      icon: <ClipboardCheck size={16} color="var(--color-accent-600)" />,
      label: 'Take your first assessment',
      desc: 'Measure your current preparation level',
      href: '/assessment',
      available: true,
    },
    {
      id: 'roadmap',
      icon: <Map size={16} color="var(--color-accent-600)" />,
      label: 'View your roadmap',
      desc: 'See what to study and in what order',
      href: '/roadmap',
      available: true,
    },
    {
      id: 'daily',
      icon: <CalendarCheck size={16} color="var(--color-accent-600)" />,
      label: 'Check today\'s plan',
      desc: 'See your daily preparation schedule',
      href: '/daily',
      available: true,
    },
    {
      id: 'progress',
      icon: <TrendingUp size={16} color="var(--color-accent-600)" />,
      label: 'Track your progress',
      desc: 'Monitor how you\'re improving over time',
      href: '/progress',
      available: true,
    },
  ]

  // Derive modules from primary role configuration
  const primaryRoleModules: string[] = (primaryRole?.role?.configuration as { modules?: string[] })?.modules ?? []

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
              {roles.map((sr) => (
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

      {/* Preparation status */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <CheckCircle size={18} color="var(--color-success-600)" />
        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Preparation workspace ready
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Take your first assessment to generate a personalised roadmap and daily plan.
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Link to="/assessment">
            <Button size="sm" id="dashboard-start-assessment">Start Assessment</Button>
          </Link>
        </div>
      </div>

      {/* Next steps */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          What to do next
        </h2>
        <div className="next-steps section">
          {nextSteps.map((step) => (
            <Link
              key={step.id}
              to={step.href}
              className="next-step-item"
              style={{ textDecoration: 'none' }}
            >
              <div className="next-step-item__icon">{step.icon}</div>
              <div>
                <div className="next-step-item__label">{step.label}</div>
                <div className="next-step-item__desc">{step.desc}</div>
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
            Your Preparation Modules
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
