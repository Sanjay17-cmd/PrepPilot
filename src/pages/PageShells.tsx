import React from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../features/auth/AuthContext'
import { ClipboardList, Map, CalendarDays, BotMessageSquare, FileText, TrendingUp, Clock } from 'lucide-react'

// =========================================================================
// Where Are We? — Assessment Page (Phase 2 full implementation)
// =========================================================================
export function AssessmentPage() {
  const { appUser } = useAuth()
  const roles = appUser?.studentRoles ?? []
  const primaryRole = roles.find(r => r.is_primary) ?? roles[0]
  const topics: string[] = (primaryRole?.role?.configuration as { assessment_topics?: string[] })?.assessment_topics ?? []

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Where Are We?</h1>
        <p className="page-header__subtitle">Measure your current preparation level and identify what to work on next.</p>
      </div>

      {/* Assessment preview card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left — info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="section">
            <div className="section__header"><span className="section__title">Placement Readiness Assessment</span></div>
            <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                Answer a set of adaptive multiple-choice questions across your selected preparation topics.
                The system selects questions based on your performance — easier when you struggle, harder when you excel.
                Results show your current readiness and generate a personalised study plan.
              </p>

              {topics.length > 0 && (
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>Topics covered</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {topics.map(t => (
                      <span key={t} style={{ fontSize: 'var(--text-xs)', background: 'var(--color-gray-100)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--color-accent-50)', border: '1px solid var(--color-accent-100)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Clock size={14} color="var(--color-accent-600)" />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-700)' }}>
                  Full adaptive assessment coming in <strong>Phase 2</strong>. Configuration and AI question generation are being implemented.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — config card */}
        <div className="section">
          <div className="section__header"><span className="section__title">Assessment Setup</span></div>
          <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[
              { label: 'Role', value: primaryRole?.role?.name ?? 'Not selected' },
              { label: 'Mode', value: 'Adaptive' },
              { label: 'Questions', value: '10' },
              { label: 'Time limit', value: '30 minutes' },
              { label: 'Difficulty', value: 'Adaptive' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{row.value}</span>
              </div>
            ))}
            <div style={{ paddingTop: 'var(--space-2)' }}>
              <Button fullWidth disabled id="assessment-start-btn">
                Start Assessment
              </Button>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
                Available in Phase 2
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Past attempts placeholder */}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Assessment History</h2>
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="No assessments yet"
          description="Your first assessment will appear here. Complete the assessment to see your readiness score, topic breakdown, and skill gaps."
        />
      </div>
    </div>
  )
}

// =========================================================================
// Roadmap Page
// =========================================================================
export function RoadmapPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">My Roadmap</h1>
        <p className="page-header__subtitle">Your personalised preparation path based on your assessment results.</p>
      </div>
      <EmptyState
        icon={<Map size={40} />}
        title="No roadmap yet"
        description="Complete an assessment to generate a preparation path based on your current skill profile. Your roadmap will break down topics by priority and suggest a study schedule."
        action={<Link to="/assessment"><Button>Take Assessment</Button></Link>}
      />
    </div>
  )
}

// =========================================================================
// Daily Plan Page
// =========================================================================
export function DailyPlanPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Today's Plan</h1>
        <p className="page-header__subtitle">Your daily preparation schedule</p>
      </div>
      <EmptyState
        icon={<CalendarDays size={40} />}
        title="No daily plan yet"
        description="Create a roadmap first to build your daily preparation schedule. Once your roadmap is ready, your daily tasks will appear here."
        action={<Link to="/roadmap"><Button>View Roadmap</Button></Link>}
      />
    </div>
  )
}

// =========================================================================
// Progress Page
// =========================================================================
export function ProgressPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Progress</h1>
        <p className="page-header__subtitle">Track your preparation improvements over time</p>
      </div>
      <EmptyState
        icon={<TrendingUp size={40} />}
        title="No progress data yet"
        description="Take an assessment and complete daily tasks to start tracking your progress. You'll see skill trends, assessment history, and roadmap completion here."
        action={<Link to="/assessment"><Button>Start Assessment</Button></Link>}
      />
    </div>
  )
}

// =========================================================================
// AI Coach Page — Phase 3
// =========================================================================
export function AICoachPage() {
  return (
    <div className="page-container">
      <div className="coming-soon-page">
        <div className="coming-soon-tag">
          <Clock size={12} /> Coming in Phase 3
        </div>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          AI Coach
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', maxWidth: '500px', lineHeight: 'var(--leading-relaxed)' }}>
          Your placement coach will be available in Phase 3. You'll be able to ask questions,
          request roadmap adjustments, get topic explanations, and simulate interview scenarios.
        </p>
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {['Ask study questions', 'Adjust your roadmap', 'Interview simulation', 'Topic deep-dives'].map(f => (
            <span key={f} style={{ fontSize: 'var(--text-sm)', background: 'var(--color-gray-100)', color: 'var(--text-secondary)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)' }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// Resume Page — Phase 3
// =========================================================================
export function ResumePage() {
  return (
    <div className="page-container">
      <div className="coming-soon-page">
        <div className="coming-soon-tag">
          <Clock size={12} /> Coming in Phase 3
        </div>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Resume & ATS Analysis
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', maxWidth: '500px', lineHeight: 'var(--leading-relaxed)' }}>
          Upload your resume in Phase 3 to analyse ATS compatibility, get keyword suggestions,
          and receive role-specific improvement recommendations.
        </p>
      </div>
    </div>
  )
}

// =========================================================================
// 404 Not Found
// =========================================================================
export function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--color-gray-200)', lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginTop: 'var(--space-4)', color: 'var(--text-primary)' }}>Page not found</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>The page you're looking for doesn't exist.</p>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Link to="/dashboard"><Button>Back to Dashboard</Button></Link>
        </div>
      </div>
    </div>
  )
}
