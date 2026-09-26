/**
 * Tasks / Daily Plan Page (P2-12)
 * Full task management hub: loads today's plan, generates AI roadmap tasks,
 * supports adding custom tasks, filtering, completion tracking, and deletion.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingPage } from '../../components/ui/Loading'
import {
  loadTodayPlan,
  generateDailyPlan,
  updateTaskStatus,
  addCustomTask,
  deleteTask,
  ensureTodayPlan,
  type DailyPlan,
  type Task,
} from '../../features/daily/dailyPlanService'
import { supabase } from '../../lib/supabase'
import {
  CalendarDays,
  CheckCircle,
  Circle,
  Clock,
  Zap,
  RefreshCw,
  ChevronRight,
  Target,
  Plus,
  Trash2,
  ListTodo,
} from 'lucide-react'

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
  const [submittingTask, setSubmittingTask] = useState(false)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null)
  const [hasRoadmap, setHasRoadmap] = useState(false)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')

  const [taskForm, setTaskForm] = useState<{
    title: string
    topic: string
    description: string
    estimated_minutes: number
    priority: 'high' | 'medium' | 'low'
  }>({
    title: '',
    topic: 'DSA & Core',
    description: '',
    estimated_minutes: 30,
    priority: 'medium',
  })

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
    if (!appUser) return
    const roadmapId = activeRoadmapId
    if (!roadmapId) {
      toastError('Please create an active preparation roadmap first.')
      return
    }
    const roleName = primaryRole?.role?.name || 'Software Engineer'
    setGenerating(true)
    try {
      const newPlan = await generateDailyPlan(
        appUser.auth.id,
        roadmapId,
        roleName,
      )
      setPlan(newPlan)
      success("Today's tasks are ready!")
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

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId)
      setPlan(prev => {
        if (!prev) return prev
        return {
          ...prev,
          tasks: prev.tasks.filter(t => t.id !== taskId),
        }
      })
      success('Task removed.')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete task.')
    }
  }

  async function handleCreateCustomTask() {
    if (!taskForm.title.trim() || !appUser) return
    setSubmittingTask(true)
    try {
      const currentPlan = await ensureTodayPlan(appUser.auth.id, activeRoadmapId || undefined)
      const newTask = await addCustomTask(currentPlan.id, appUser.auth.id, {
        title: taskForm.title.trim(),
        topic: taskForm.topic.trim(),
        description: taskForm.description.trim(),
        estimated_minutes: Number(taskForm.estimated_minutes) || 30,
        priority: taskForm.priority,
      })

      setPlan(prev => {
        if (!prev) return { ...currentPlan, tasks: [newTask] }
        return {
          ...prev,
          tasks: [...prev.tasks, newTask],
        }
      })

      setShowAddTaskModal(false)
      setTaskForm({
        title: '',
        topic: 'DSA & Core',
        description: '',
        estimated_minutes: 30,
        priority: 'medium',
      })
      success('Task added!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to add task.')
    } finally {
      setSubmittingTask(false)
    }
  }

  if (loading) return <LoadingPage />

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (!hasRoadmap && (!plan || plan.tasks.length === 0)) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Tasks</h1>
            <p className="page-header__subtitle">{today}</p>
          </div>
          <Button onClick={() => setShowAddTaskModal(true)} id="add-custom-task-btn">
            <Plus size={15} /> Add Task
          </Button>
        </div>
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No roadmap or tasks yet"
          description="Generate a roadmap first to automatically create structured tasks, or start organizing your tasks manually."
          action={
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/roadmap"><Button>Go to Roadmap</Button></Link>
              <Button variant="secondary" onClick={() => setShowAddTaskModal(true)}>
                <Plus size={15} /> Add Custom Task
              </Button>
            </div>
          }
        />

        {renderAddTaskModal()}
      </div>
    )
  }

  if (!plan || plan.tasks.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Tasks</h1>
            <p className="page-header__subtitle">{today}</p>
          </div>
          <Button onClick={() => setShowAddTaskModal(true)} id="add-custom-task-btn">
            <Plus size={15} /> Add Task
          </Button>
        </div>
        <EmptyState
          icon={<ListTodo size={40} />}
          title="No tasks scheduled for today"
          description="Generate today's task checklist based on your active roadmap, or add custom tasks."
          action={
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button onClick={handleGenerate} loading={generating} id="generate-plan-btn">
                <Zap size={15} />
                Generate Tasks with AI
              </Button>
              <Button variant="secondary" onClick={() => setShowAddTaskModal(true)}>
                <Plus size={15} /> Add Custom Task
              </Button>
            </div>
          }
        />

        {renderAddTaskModal()}
      </div>
    )
  }

  const allTasks = plan.tasks
  const filteredTasks = filterStatus === 'all'
    ? allTasks
    : allTasks.filter(t => t.status === filterStatus)

  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(t => t.status === 'completed').length
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const totalMinutes = allTasks.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0)

  function renderAddTaskModal() {
    return (
      <Modal open={showAddTaskModal} onClose={() => setShowAddTaskModal(false)} title="Add Custom Task">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Task Title *</label>
            <input
              className="form-input"
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Solve 2 Graph questions or Revise React hooks"
              id="new-task-title"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label className="form-label">Category / Topic</label>
              <input
                className="form-input"
                value={taskForm.topic}
                onChange={e => setTaskForm(f => ({ ...f, topic: e.target.value }))}
                placeholder="e.g. DSA, DBMS, System Design"
              />
            </div>
            <div>
              <label className="form-label">Estimated Minutes</label>
              <input
                type="number"
                className="form-input"
                value={taskForm.estimated_minutes}
                onChange={e => setTaskForm(f => ({ ...f, estimated_minutes: Number(e.target.value) || 15 }))}
                min={5}
                max={240}
                step={5}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={taskForm.priority}
              onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' }))}
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          <div>
            <label className="form-label">Description / Objectives (Optional)</label>
            <textarea
              className="form-input"
              rows={3}
              value={taskForm.description}
              onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Key notes, links, or what success looks like..."
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAddTaskModal(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomTask} loading={submittingTask} disabled={!taskForm.title.trim()}>
              Add Task
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-header__title">Daily Tasks</h1>
          <p className="page-header__subtitle">{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="primary" size="sm" onClick={() => setShowAddTaskModal(true)}>
            <Plus size={13} /> Add Task
          </Button>
          <Button variant="secondary" size="sm" onClick={handleGenerate} loading={generating} id="regenerate-plan-btn">
            <RefreshCw size={13} /> Regenerate with AI
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
            {completedTasks} of {totalTasks} tasks completed
          </div>
          <div className="daily-progress-banner__meta">
            <Clock size={12} /> {totalMinutes} min scheduled · {primaryRole?.role?.name ?? 'Preparation'}
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

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
        {(['all', 'pending', 'in_progress', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            style={{
              padding: '6px 14px',
              fontSize: 'var(--text-xs)',
              fontWeight: filterStatus === f ? 600 : 400,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: filterStatus === f ? 'var(--color-accent-100)' : 'transparent',
              color: filterStatus === f ? 'var(--color-accent-700)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f.replace('_', ' ')}
            <span style={{ marginLeft: '6px', opacity: 0.7, fontSize: '11px' }}>
              ({f === 'all' ? allTasks.length : allTasks.filter(t => t.status === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* Task groups by priority */}
      {filteredTasks.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          No {filterStatus.replace('_', ' ')} tasks right now.
        </div>
      ) : (
        (['high', 'medium', 'low'] as const).map(priority => {
          const tasks = filteredTasks.filter(t => t.priority === priority)
          if (!tasks.length) return null
          const label = priority === 'high' ? '🔴 High Priority'
            : priority === 'medium' ? '🟡 Medium Priority'
            : '🟢 Low Priority'

          return (
            <div key={priority} style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
                {label} ({tasks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatus={handleTaskStatus}
                    onDelete={handleDeleteTask}
                    priorityColor={PRIORITY_COLORS[priority]}
                    priorityBg={PRIORITY_BG[priority]}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {completionPct === 100 && totalTasks > 0 && (
        <div className="daily-complete-banner">
          <CheckCircle size={20} color="var(--color-success-600)" />
          <span>All tasks complete! Great work today. 🎉</span>
          <Link to="/progress">
            <Button size="sm" variant="secondary">View Progress <ChevronRight size={13} /></Button>
          </Link>
        </div>
      )}

      {renderAddTaskModal()}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onStatus,
  onDelete,
  priorityColor,
  priorityBg: _priorityBg,
}: {
  task: Task
  onStatus: (id: string, status: Task['status']) => void
  onDelete: (id: string) => void
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
            <span className={`badge badge--${task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : 'default'}`} style={{ textTransform: 'capitalize', fontSize: '10px', padding: '1px 6px' }}>
              {task.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Start / delete actions */}
        <div className="task-card__actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {!isCompleted && !isInProgress && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onStatus(task.id, 'in_progress')}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              Start
            </Button>
          )}
          {isInProgress && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onStatus(task.id, 'completed')}
              style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--color-success-600)' }}
            >
              Complete
            </Button>
          )}
          <button
            onClick={() => onDelete(task.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Delete task"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
