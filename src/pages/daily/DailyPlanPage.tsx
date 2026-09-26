/**
 * Daily Plan Page (P2-12)
 * Today's checklist — loads existing plan or generates new one via AI gateway.
 * Task status changes are pure DB writes (no Gemini).
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingPage } from '../../components/ui/Loading'
import {
  loadTodayPlan,
  generateDailyPlan,
  updateTaskStatus,
  type DailyPlan,
  type Task,
} from '../../features/daily/dailyPlanService'
import { supabase } from '../../lib/supabase'
import { CalendarDays, CheckCircle, Circle, Clock, Zap, RefreshCw, ChevronRight, Target } from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = {
  high:   'var(--color-danger-600)',
  medium: 'var(--color-warning-600)',
  low:    'var(--color-success-600)',
}

const PRIORITY_BG: Record<string, string> = {
  high:   'var(--color-danger-50)',
  medium: 'var(--color-warning-50)',
  low:    'var(--color-success-50)',
}

export function DailyPlanPage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null)
  const [hasRoadmap, setHasRoadmap] = useState(false)

  const studentRoles = appUser?.studentRoles ?? []
  const primaryRole = studentRoles.find(r => r.is_primary) ?? studentRoles[0]

  useEffect(() => {
    if (!appUser) return
    loadAll()
  }, [appUser])

  async function loadAll() {
    setLoading(true)
    try {
      // Check for active roadmap
      const { data: roadmap } = await supabase
        .from('roadmaps')
        .select('id')
        .eq('student_id', appUser!.auth.id)
        .eq('status', 'active')
        .maybeSingle()

      if (roadmap) {
        setActiveRoadmapId(roadmap.id)
        setHasRoadmap(true)
      } else {
        const { data: anyRoadmap } = await supabase
          .from('roadmaps')
          .select('id')
          .eq('student_id', appUser!.auth.id)
          .limit(1)
          .maybeSingle()
        if (anyRoadmap) {
          setActiveRoadmapId(anyRoadmap.id)
          setHasRoadmap(true)
        }
      }

      // Load today's plan
      const existing = await loadTodayPlan(appUser!.auth.id)
      setPlan(existing)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!activeRoadmapId || !appUser || !primaryRole?.role) return
    setGenerating(true)
    try {
      const newPlan = await generateDailyPlan(
        appUser.auth.id,
        activeRoadmapId,
        primaryRole.role.name,
      )
      setPlan(newPlan)
      success('Daily plan ready!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to generate plan.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleTaskStatus(taskId: string, status: Task['status']) {
    await updateTaskStatus(taskId, status)
    // Optimistic update
    setPlan(prev => {
      if (!prev) return prev
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status } : t),
      }
    })
  }

  if (loading) return <LoadingPage />

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (!hasRoadmap) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-header__title">Today's Plan</h1>
          <p className="page-header__subtitle">{today}</p>
        </div>
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No roadmap yet"
          description="Generate a roadmap first so we can create focused daily tasks for you."
          action={<Link to="/roadmap"><Button>Go to Roadmap</Button></Link>}
        />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-header__title">Today's Plan</h1>
          <p className="page-header__subtitle">{today}</p>
        </div>
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No plan for today"
          description="Generate today's focused task list from your active roadmap. On future visits, the same plan is reused."
          action={
            <Button onClick={handleGenerate} loading={generating} id="generate-plan-btn">
              <Zap size={15} />
              Generate Today's Plan
            </Button>
          }
        />
      </div>
    )
  }

  const totalTasks = plan.tasks.length
  const completedTasks = plan.tasks.filter(t => t.status === 'completed').length
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const totalMinutes = plan.tasks.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0)

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-header__title">Today's Plan</h1>
          <p className="page-header__subtitle">{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="secondary" size="sm" onClick={handleGenerate} loading={generating} id="regenerate-plan-btn">
            <RefreshCw size={13} /> Regenerate
          </Button>
          <Link to="/roadmap">
            <Button variant="ghost" size="sm">View Roadmap <ChevronRight size={13} /></Button>
          </Link>
        </div>
      </div>

      {/* Progress banner */}
      <div className="daily-progress-banner">
        <div className="daily-progress-banner__info">
          <div className="daily-progress-banner__title">
            {completedTasks} of {totalTasks} tasks done
          </div>
          <div className="daily-progress-banner__meta">
            <Clock size={12} /> {totalMinutes} min total · {primaryRole?.role?.name ?? 'Preparation'}
          </div>
        </div>
        <div className="daily-progress-banner__ring">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="var(--color-gray-200)" strokeWidth="5" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke={completionPct === 100 ? 'var(--color-success-600)' : 'var(--color-accent-500)'}
              strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - completionPct / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
            />
          </svg>
          <span className="daily-progress-banner__pct">{completionPct}%</span>
        </div>
      </div>

      {/* Task groups by priority */}
      {(['high', 'medium', 'low'] as const).map(priority => {
        const tasks = plan.tasks.filter(t => t.priority === priority)
        if (!tasks.length) return null
        const label = priority === 'high' ? '🔴 High Priority'
          : priority === 'medium' ? '🟡 Medium Priority'
          : '🟢 Low Priority'

        return (
          <div key={priority} style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
              {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatus={handleTaskStatus}
                  priorityColor={PRIORITY_COLORS[priority]}
                  priorityBg={PRIORITY_BG[priority]}
                />
              ))}
            </div>
          </div>
        )
      })}

      {completionPct === 100 && (
        <div className="daily-complete-banner">
          <CheckCircle size={20} color="var(--color-success-600)" />
          <span>All tasks complete! Great work today. 🎉</span>
          <Link to="/progress">
            <Button size="sm" variant="secondary">View Progress <ChevronRight size={13} /></Button>
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onStatus,
  priorityColor,
  priorityBg,
}: {
  task: Task
  onStatus: (id: string, status: Task['status']) => void
  priorityColor: string
  priorityBg: string
}) {
  const isCompleted = task.status === 'completed'
  const isInProgress = task.status === 'in_progress'

  return (
    <div
      className="task-card"
      style={{
        borderLeft: `3px solid ${isCompleted ? 'var(--color-success-600)' : priorityColor}`,
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      <div className="task-card__main">
        {/* Check button */}
        <button
          className="task-card__check"
          onClick={() => onStatus(task.id, isCompleted ? 'pending' : 'completed')}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {isCompleted
            ? <CheckCircle size={20} color="var(--color-success-600)" />
            : <Circle size={20} color="var(--color-gray-300)" />
          }
        </button>

        <div className="task-card__content">
          <div className="task-card__title" style={{ textDecoration: isCompleted ? 'line-through' : 'none' }}>
            {task.title}
          </div>
          {task.description && (
            <div className="task-card__desc">{task.description}</div>
          )}
          <div className="task-card__meta">
            <span className="task-card__topic">
              <Target size={11} /> {task.topic}
            </span>
            {task.estimated_minutes && (
              <span className="task-card__time">
                <Clock size={11} /> {task.estimated_minutes}m
              </span>
            )}
          </div>
        </div>

        {/* Start / skip */}
        {!isCompleted && (
          <div className="task-card__actions">
            {!isInProgress ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onStatus(task.id, 'in_progress')}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                Start
              </Button>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--color-accent-600)', fontWeight: 600 }}>
                In progress
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
