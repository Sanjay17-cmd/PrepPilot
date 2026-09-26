/**
 * Mock Interview Launchpad / Lobby Page
 * - Configures interview role, category, difficulty, length, and AI voice
 * - Live microphone check & volume meter test before entering room
 * - Past interview scorecard history and placement readiness stats
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import {
  type InterviewCategory,
  type InterviewDifficulty,
  type MockInterviewSession,
  loadPastInterviewSessions,
} from '../../features/interview/interviewService'
import { useInterviewSpeech } from '../../features/interview/useInterviewSpeech'
import {
  Video,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Play,
  Clock,
  Award,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  Users,
  Compass,
  CheckCircle,
  AlertCircle,
  Maximize2,
  FileText,
} from 'lucide-react'

const CATEGORIES: Array<{
  id: InterviewCategory
  title: string
  desc: string
  icon: React.ElementType
  color: string
}> = [
  {
    id: 'technical',
    title: 'Technical DSA & Core CS',
    desc: 'Data structures, algorithms, runtime complexity, databases, and OS fundamentals.',
    icon: Cpu,
    color: 'var(--color-accent-600)',
  },
  {
    id: 'system_design',
    title: 'System Design & APIs',
    desc: 'Scalability, microservices, caching, rate limiting, and distributed architecture.',
    icon: Layers,
    color: '#0ea5e9',
  },
  {
    id: 'behavioral',
    title: 'Behavioral & HR (STAR)',
    desc: 'Culture fit, teamwork, handling pressure, past project conflicts, and leadership.',
    icon: Users,
    color: '#8b5cf6',
  },
  {
    id: 'mixed',
    title: 'Placement Simulation (Mixed)',
    desc: 'Complete placement mock combining initial technical grilling with behavioral fit.',
    icon: Compass,
    color: 'var(--color-success-600)',
  },
]

export function MockInterviewPage() {
  const { appUser } = useAuth()
  const { success } = useToast()
  const navigate = useNavigate()

  const studentRoles = appUser?.studentRoles ?? []
  const primaryRole = studentRoles.find(r => r.is_primary) ?? studentRoles[0]
  const defaultRoleName = primaryRole?.role?.name || 'Software Engineer'

  const [roleName, setRoleName] = useState(defaultRoleName)
  const [category, setCategory] = useState<InterviewCategory>('technical')
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>('entry_level')
  const [totalQuestions, setTotalQuestions] = useState<number>(5)
  const [pastSessions, setPastSessions] = useState<MockInterviewSession[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [selectedPastSession, setSelectedPastSession] = useState<MockInterviewSession | null>(null)

  // Mic test hook
  const {
    isListening,
    micVolume,
    micPermission,
    startMic,
    stopMic,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    speakText,
    isAiSpeaking,
  } = useInterviewSpeech()

  useEffect(() => {
    if (primaryRole?.role?.name) {
      setRoleName(primaryRole.role.name)
    }
  }, [primaryRole])

  useEffect(() => {
    if (!appUser) return
    loadPastInterviewSessions(appUser.auth.id)
      .then(sessions => setPastSessions(sessions))
      .finally(() => setLoadingHistory(false))
  }, [appUser])

  function handleStartInterview() {
    // Save current config to sessionStorage so the room page immediately reads it
    const config = {
      roleName: roleName.trim() || defaultRoleName,
      category,
      difficulty,
      totalQuestions,
      voiceName: selectedVoice,
      enableMic: micPermission !== 'denied',
    }
    sessionStorage.setItem('preppilot_active_interview_config', JSON.stringify(config))
    navigate('/interview/room')
  }

  function testVoice() {
    speakText("Hello! I am your AI placement interviewer. Your audio and voice output are configured and ready.")
  }

  // Stats calculation
  const completedSessions = pastSessions.filter(s => s.evaluation?.overall_score)
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((acc, s) => acc + (s.evaluation?.overall_score || 0), 0) / completedSessions.length)
    : 0

  return (
    <div className="page-container" style={{ maxWidth: 1120, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-accent-50)', color: 'var(--color-accent-700)', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            <Sparkles size={12} /> Live AI Voice Simulation
          </div>
          <h1 className="page-header__title">AI Mock Interview Studio</h1>
          <p className="page-header__subtitle">
            Simulate realistic placement interviews in immersive full-screen with AI voice questions, microphone capture, and immediate evaluation.
          </p>
        </div>
      </div>

      {/* Top Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--color-accent-50)', color: 'var(--color-accent-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Video size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{completedSessions.length}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Mocks Completed</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--color-success-50)', color: 'var(--color-success-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{avgScore ? `${avgScore}/100` : '—'}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Average Score</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-success-700)' }}>
                {pastSessions[0]?.evaluation?.verdict || 'Ready to Start'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Latest Placement Verdict</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Configuration Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {/* Left: Setup Card */}
        <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
              Interview Settings
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Tailor the AI interviewer to test specific technical domains or behavioral competence.
            </p>
          </div>

          {/* Role Name */}
          <div>
            <label className="form-label">Target Role</label>
            <input
              className="form-input"
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              placeholder="e.g. Full Stack Developer, SDE-1, Data Scientist"
            />
          </div>

          {/* Category Cards */}
          <div>
            <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Interview Category</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon
                const isSelected = category === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${isSelected ? 'var(--color-accent-500)' : 'var(--border-subtle)'}`,
                      background: isSelected ? 'var(--color-accent-50)' : 'var(--bg-surface)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Icon size={16} color={cat.color} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: isSelected ? 'var(--color-accent-800)' : 'var(--text-primary)' }}>
                        {cat.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                      {cat.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Difficulty & Length Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label className="form-label">Experience Level</label>
              <select
                className="form-select"
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as InterviewDifficulty)}
              >
                <option value="intern">Internship / Student</option>
                <option value="entry_level">Entry Level (0-2 YOE)</option>
                <option value="mid_level">Mid Level (2-4 YOE)</option>
              </select>
            </div>

            <div>
              <label className="form-label">Questions</label>
              <select
                className="form-select"
                value={totalQuestions}
                onChange={e => setTotalQuestions(Number(e.target.value))}
              >
                <option value={3}>Quick (3 Questions · ~5 min)</option>
                <option value={5}>Standard (5 Questions · ~10 min)</option>
                <option value={8}>Comprehensive (8 Questions · ~18 min)</option>
              </select>
            </div>
          </div>

          {/* CTA Button */}
          <div style={{ paddingTop: 'var(--space-2)' }}>
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartInterview}
              style={{
                width: '100%',
                padding: 'var(--space-4)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.4)',
              }}
            >
              <Maximize2 size={18} />
              Launch Full-Screen Mock Interview
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>

        {/* Right: Audio & Hardware Check Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Mic size={16} color="var(--color-accent-500)" />
              Microphone & Audio Check
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Test your mic and AI voice output so you are fully prepared for the live conversation.
            </p>

            {/* Mic Meter Widget */}
            <div style={{
              background: 'var(--color-gray-50)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Microphone Input Level
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isListening ? 'var(--color-success-600)' : 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {isListening ? <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success-600)' }} /> : null}
                  {isListening ? 'Listening Active' : 'Mic Idle'}
                </span>
              </div>

              {/* Volume bar */}
              <div style={{ height: 8, background: 'var(--color-gray-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${isListening ? Math.max(12, micVolume * 1.5) : 0}%`,
                    background: micVolume > 60 ? 'var(--color-warning-500)' : 'var(--color-accent-500)',
                    transition: 'width 0.08s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {!isListening ? (
                  <Button variant="secondary" size="sm" onClick={startMic}>
                    <Mic size={13} style={{ marginRight: 4 }} /> Test Microphone
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={stopMic} style={{ color: 'var(--color-danger-600)' }}>
                    <MicOff size={13} style={{ marginRight: 4 }} /> Stop Test
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={testVoice} disabled={isAiSpeaking}>
                  <Volume2 size={13} style={{ marginRight: 4 }} /> Test AI Voice
                </Button>
              </div>
            </div>

            {/* AI Voice Selector */}
            {availableVoices.length > 0 && (
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Interviewer Voice</label>
                <select
                  className="form-select"
                  style={{ fontSize: 'var(--text-xs)' }}
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                >
                  {availableVoices.slice(0, 8).map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Pro-Tips Card */}
          <div className="card" style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(14, 165, 233, 0.04) 100%)' }}>
            <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-700)', marginBottom: 'var(--space-2)' }}>
              Interview Room Features
            </h4>
            <ul style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '6px', margin: 0 }}>
              <li><strong>Live Speech to Text</strong>: Talk freely; words appear on screen in real time.</li>
              <li><strong>Spoken AI Response</strong>: The interviewer responds naturally with voice.</li>
              <li><strong>Interactive Scratchpad</strong>: Code or sketch architecture during technical questions.</li>
              <li><strong>Full Evaluation Card</strong>: Scoring on depth, clarity, and confidence.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Past Mock Interviews Section */}
      <div className="section">
        <div className="section__header">
          <span className="section__title">Past Mock Interview Sessions</span>
        </div>
        <div className="section__body" style={{ padding: 0 }}>
          {loadingHistory ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              Loading past interviews...
            </div>
          ) : pastSessions.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Video size={36} style={{ margin: '0 auto var(--space-3)', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>No mock interviews recorded yet</div>
              <div style={{ fontSize: 'var(--text-xs)', maxWidth: 400, margin: '0 auto' }}>
                Launch your first simulation above to practice with real-time speech and receive an in-depth scorecard.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pastSessions.map(session => {
                const evalData = session.evaluation
                const score = evalData?.overall_score
                return (
                  <div
                    key={session.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-4) var(--space-5)',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{session.roleName}</span>
                        <span className="badge badge--default" style={{ textTransform: 'capitalize', fontSize: '10px' }}>
                          {session.category.replace('_', ' ')}
                        </span>
                        {evalData?.verdict && (
                          <span className={`badge badge--${evalData.verdict.includes('Hire') ? 'success' : 'warning'}`} style={{ fontSize: '10px' }}>
                            {evalData.verdict}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {new Date(session.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {session.turns.filter(t => t.speaker === 'candidate').length} questions answered
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      {score ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: score >= 75 ? 'var(--color-success-600)' : 'var(--color-warning-600)' }}>
                            {score}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', display: 'block' }}>Score</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Incomplete</span>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedPastSession(session)}
                      >
                        <FileText size={12} style={{ marginRight: 4 }} /> View Scorecard
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* View Past Evaluation Modal */}
      {selectedPastSession && (
        <Modal
          open={!!selectedPastSession}
          onClose={() => setSelectedPastSession(null)}
          title={`Scorecard: ${selectedPastSession.roleName}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {selectedPastSession.evaluation ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-lg)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-accent-600)' }}>
                      {selectedPastSession.evaluation.overall_score}/100
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Overall Score</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge--success" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>
                      {selectedPastSession.evaluation.verdict}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {selectedPastSession.evaluation.summary}
                </p>

                {/* Key Strengths */}
                {selectedPastSession.evaluation.key_strengths?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-success-700)', marginBottom: 'var(--space-2)' }}>
                      Key Strengths
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {selectedPastSession.evaluation.key_strengths.map((s, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for improvement */}
                {selectedPastSession.evaluation.areas_for_improvement?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-warning-700)', marginBottom: 'var(--space-2)' }}>
                      Areas to Improve
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {selectedPastSession.evaluation.areas_for_improvement.map((a, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                This session was ended before evaluation completed.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
              <Button variant="secondary" onClick={() => setSelectedPastSession(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
