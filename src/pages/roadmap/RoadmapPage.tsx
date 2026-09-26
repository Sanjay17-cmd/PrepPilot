/**
 * Roadmap Page (P2-10)
 * Full phase progression view with AI generation, multi-roadmap support.
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingPage } from '../../components/ui/Loading'
import {
  loadRoadmaps,
  generateRoadmapViaAI,
  saveRoadmap,
  setActiveRoadmap,
  updatePhaseStatus,
  type RoadmapWithPhases,
  type RoadmapPhase,
} from '../../features/roadmap/roadmapService'
import { loadLatestSkills } from '../../features/assessment/skillService'
import { Map, Plus, CheckCircle, Circle, ChevronDown, ChevronUp, Clock, Zap, Star, Loader2, AlertCircle, ChevronRight } from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = {
  high:   'var(--color-danger-600)',
  medium: 'var(--color-warning-600)',
  low:    'var(--color-success-600)',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  not_started: <Circle size={16} color="var(--color-gray-400)" />,
  in_progress: <Loader2 size={16} color="var(--color-accent-500)" style={{ animation: 'spin 1s linear infinite' }} />,
  completed:   <CheckCircle size={16} color="var(--color-success-600)" />,
  paused:      <AlertCircle size={16} color="var(--color-warning-600)" />,
}

export function RoadmapPage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [roadmaps, setRoadmaps] = useState<RoadmapWithPhases[]>([])
  const [activeRoadmap, setActiveRoadmapState] = useState<RoadmapWithPhases | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})
  const [generating, setGenerating] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [dailyMinutes, setDailyMinutes] = useState(60)

  const studentRoles = appUser?.studentRoles ?? []
  const primaryRole = studentRoles.find(r => r.is_primary) ?? studentRoles[0]

  useEffect(() => {
    if (!appUser) return
    load()
  }, [appUser])

  async function load() {
    setLoading(true)
    const data = await loadRoadmaps(appUser!.auth.id)
    setRoadmaps(data)
    const active = data.find(r => r.status === 'active') ?? data[0] ?? null
    setActiveRoadmapState(active)
    if (active) {
      const expanded: Record<string, boolean> = {}
      active.phases.forEach((p, i) => { if (i < 2) expanded[p.id ?? i] = true })
      setExpandedPhases(expanded)
    }
    setLoading(false)
  }

  async function handleGenerate() {
    if (!appUser || !primaryRole?.role) return

    // Check existing active roadmap — confirm replacement
    if (activeRoadmap) {
      setShowConfirmModal(true)
      return
    }
    await doGenerate()
  }

  async function doGenerate() {
    setShowConfirmModal(false)
    setGenerating(true)
    try {
      const skills = await loadLatestSkills(appUser!.auth.id, primaryRole!.role_id)
      const { phases, aiRunId } = await generateRoadmapViaAI(
        appUser!.auth.id,
        primaryRole!.role!.name,
        primaryRole!.role!.slug,
        skills,
        dailyMinutes,
      )
      const roadmapId = await saveRoadmap(
        appUser!.auth.id,
        primaryRole!.role_id,
        `${primaryRole!.role!.name} Preparation`,
        phases,
        aiRunId,
      )
      await setActiveRoadmap(appUser!.auth.id, roadmapId)
      success('Roadmap generated!')
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Roadmap generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSetActive(roadmapId: string) {
    await setActiveRoadmap(appUser!.auth.id, roadmapId)
    await load()
  }

  async function handlePhaseStatus(phaseId: string, status: RoadmapPhase['status']) {
    await updatePhaseStatus(phaseId, status)
    await load()
  }

  function togglePhase(key: string) {
    setExpandedPhases(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) return <LoadingPage />

  if (!roadmaps.length) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-header__title">My Roadmap</h1>
          <p className="page-header__subtitle">Your personalised preparation path based on your assessment results.</p>
        </div>
        <EmptyState
          icon={<Map size={40} />}
          title="No roadmap yet"
          description={
            primaryRole?.role
              ? `Generate a preparation roadmap for ${primaryRole.role.name} using your skill profile and assessment results.`
              : 'Complete your onboarding and take an assessment before generating a roadmap.'
          }
          action={
            primaryRole?.role ? (
              <Button onClick={handleGenerate} loading={generating} id="generate-roadmap-btn">
                <Zap size={15} />
                Generate Roadmap
              </Button>
            ) : (
              <Link to="/assessment"><Button>Take Assessment First</Button></Link>
            )
          }
        />
      </div>
    )
  }

  const roadmap = activeRoadmap!
  const totalTopics = roadmap.phases.reduce((s, p) => s + p.topics.length, 0)
  const completedTopics = roadmap.phases.reduce(
    (s, p) => s + p.topics.filter(t => t.status === 'completed').length, 0
  )
  const completionPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-header__title">My Roadmap</h1>
          <p className="page-header__subtitle">{roadmap.role?.name ?? primaryRole?.role?.name ?? 'Placement Preparation'}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={handleGenerate} loading={generating} id="regenerate-roadmap-btn">
            <Plus size={14} />
            New Roadmap
          </Button>
          <Link to="/daily">
            <Button size="sm">
              View Daily Plan <ChevronRight size={14} />
            </Button>
          </Link>
        </div>
      </div>

      {/* Roadmap selector (if multiple) */}
      {roadmaps.length > 1 && (
        <div className="section" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="section__header"><span className="section__title">Your Roadmaps</span></div>
          <div className="section__body">
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {roadmaps.map(rm => (
                <button
                  key={rm.id}
                  onClick={() => { setActiveRoadmapState(rm); handleSetActive(rm.id) }}
                  className={`roadmap-tab ${rm.id === roadmap.id ? 'active' : ''}`}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: rm.id === roadmap.id ? 'var(--color-accent-500)' : 'var(--color-gray-200)',
                    background: rm.id === roadmap.id ? 'var(--color-accent-50)' : 'transparent',
                    color: rm.id === roadmap.id ? 'var(--color-accent-700)' : 'var(--text-secondary)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: rm.id === roadmap.id ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {rm.name}
                  {rm.status === 'active' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--color-success-600)' }}>●</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress overview */}
      <div className="section" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="section__body">
          <div className="roadmap-overview">
            <div className="roadmap-overview__stats">
              <div className="roadmap-stat">
                <span className="roadmap-stat__value">{roadmap.phases.length}</span>
                <span className="roadmap-stat__label">Phases</span>
              </div>
              <div className="roadmap-stat">
                <span className="roadmap-stat__value">{totalTopics}</span>
                <span className="roadmap-stat__label">Topics</span>
              </div>
              <div className="roadmap-stat">
                <span className="roadmap-stat__value">{completedTopics}</span>
                <span className="roadmap-stat__label">Completed</span>
              </div>
              <div className="roadmap-stat">
                <span className="roadmap-stat__value">{completionPct}%</span>
                <span className="roadmap-stat__label">Done</span>
              </div>
            </div>
            <div className="roadmap-overall-bar-wrap">
              <div className="roadmap-overall-bar" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Phase list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {roadmap.phases.map((phase, phaseIdx) => {
          const key = phase.id ?? String(phaseIdx)
          const expanded = !!expandedPhases[key]
          const phaseCompletedTopics = phase.topics.filter(t => t.status === 'completed').length
          const phasePct = phase.topics.length > 0
            ? Math.round((phaseCompletedTopics / phase.topics.length) * 100)
            : 0

          return (
            <div key={key} className={`roadmap-phase-card ${phase.status === 'completed' ? 'completed' : ''}`}>
              {/* Phase header */}
              <div className="roadmap-phase-header" onClick={() => togglePhase(key)}>
                <div className="roadmap-phase-header__left">
                  <div className="roadmap-phase-number">{phaseIdx + 1}</div>
                  <div>
                    <div className="roadmap-phase-title">{phase.title}</div>
                    {phase.duration_days && (
                      <div className="roadmap-phase-meta">
                        <Clock size={12} /> {phase.duration_days} days
                        {phase.description && <span style={{ margin: '0 6px' }}>·</span>}
                        {phase.description && <span>{phase.description}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="roadmap-phase-header__right">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {STATUS_ICON[phase.status] ?? STATUS_ICON['not_started']}
                    <span style={{
                      fontSize: 'var(--text-xs)', fontWeight: 600,
                      color: phase.status === 'completed' ? 'var(--color-success-600)' : 'var(--text-tertiary)',
                    }}>
                      {phasePct}%
                    </span>
                    {/* Status toggle */}
                    <select
                      value={phase.status}
                      onChange={e => phase.id && handlePhaseStatus(phase.id, e.target.value as RoadmapPhase['status'])}
                      onClick={e => e.stopPropagation()}
                      className="roadmap-phase-status-select"
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="paused">Paused</option>
                    </select>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* Topics */}
              {expanded && (
                <div className="roadmap-topics-list">
                  {phase.topics.map((topic, tIdx) => (
                    <div key={topic.id ?? tIdx} className="roadmap-topic-row">
                      <div className="roadmap-topic-row__left">
                        <div
                          className="roadmap-topic-priority-dot"
                          style={{ background: PRIORITY_COLORS[topic.priority] ?? 'var(--color-gray-400)' }}
                          title={`${topic.priority} priority`}
                        />
                        <span className="roadmap-topic-name"
                          style={{ textDecoration: topic.status === 'completed' ? 'line-through' : 'none', opacity: topic.status === 'completed' ? 0.5 : 1 }}>
                          {topic.topic}
                        </span>
                        {topic.priority === 'high' && (
                          <Star size={11} color="var(--color-warning-600)" fill="var(--color-warning-600)" />
                        )}
                      </div>
                      <div className="roadmap-topic-row__right">
                        {topic.estimated_minutes && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            ~{topic.estimated_minutes}m
                          </span>
                        )}
                        <span className={`badge badge--${
                          topic.status === 'completed' ? 'success'
                          : topic.status === 'in_progress' ? 'info'
                          : 'default'
                        }`} style={{ textTransform: 'capitalize', fontSize: '10px', padding: '2px 8px' }}>
                          {topic.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirm regenerate modal */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Regenerate Roadmap?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
            Your current roadmap will be archived and a new one will be generated based on your latest skill profile.
          </p>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)', display: 'block' }}>
              Daily study time (minutes)
            </label>
            <select
              value={dailyMinutes}
              onChange={e => setDailyMinutes(Number(e.target.value))}
              className="form-select"
            >
              {[30, 60, 90, 120].map(m => (
                <option key={m} value={m}>{m} minutes / day</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
            <Button onClick={doGenerate} loading={generating}>Regenerate</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
