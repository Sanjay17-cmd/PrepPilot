/**
 * Resume Page (P3-8)
 * Upload, analyze, view ATS-oriented results, history.
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingPage } from '../../components/ui/Loading'
import {
  uploadAndAnalyze, loadAnalyses,
  type ResumeAnalysis, type Recommendation,
} from '../../features/resume/resumeService'
import { FileText, Upload, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Minus } from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = {
  high:   'var(--color-danger-600)',
  medium: 'var(--color-warning-600)',
  low:    'var(--color-success-600)',
}
const PRIORITY_BG: Record<string, string> = {
  high:   '#fef2f2',
  medium: '#fffbeb',
  low:    '#f0fdf4',
}

export function ResumePage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()

  const [loading, setLoading] = useState(true)
  const [analyses, setAnalyses] = useState<ResumeAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<ResumeAnalysis | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedRoleName, setSelectedRoleName] = useState('')
  const [expandedRecs, setExpandedRecs] = useState<Record<number, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const roles = appUser?.studentRoles ?? []
  const roleNames = roles.map(r => r.role?.name ?? '').filter(Boolean)

  useEffect(() => {
    if (!appUser) return
    load()
    if (roleNames.length > 0) setSelectedRoleName(roleNames[0])
  }, [appUser])

  async function load() {
    setLoading(true)
    const data = await loadAnalyses(appUser!.auth.id)
    setAnalyses(data)
    if (data.length > 0) setActiveAnalysis(data[0])
    setLoading(false)
  }

  async function handleUpload() {
    if (!selectedFile || !appUser || !selectedRoleName) return
    setUploading(true)
    try {
      const primaryRole = roles.find(r => r.role?.name === selectedRoleName)
      const analysis = await uploadAndAnalyze(
        appUser.auth.id,
        selectedFile,
        primaryRole?.role_id ?? null,
        selectedRoleName,
      )
      setAnalyses(prev => [analysis, ...prev])
      setActiveAnalysis(analysis)
      setSelectedFile(null)
      success('Resume analyzed!')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <LoadingPage />

  const pct = activeAnalysis ? Math.round(activeAnalysis.overall_score) : 0

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-header__title">Resume & ATS Analysis</h1>
          <p className="page-header__subtitle">ATS-oriented analysis tailored to your target role.</p>
        </div>
      </div>

      {/* ── Upload card ── */}
      <div className="section" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="section__header"><span className="section__title">Analyze a Resume</span></div>
        <div className="section__body">
          <div className="resume-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              style={{ display: 'none' }}
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              id="resume-file-input"
            />
            <div
              className="resume-drop-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} color="var(--color-gray-400)" />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                {selectedFile ? selectedFile.name : 'Click to upload PDF, DOCX, or TXT'}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Max 5MB</span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)', display: 'block' }}>
                  Target Role
                </label>
                {roleNames.length > 0 ? (
                  <select
                    className="form-select"
                    value={selectedRoleName}
                    onChange={e => setSelectedRoleName(e.target.value)}
                  >
                    {roleNames.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    placeholder="e.g. Software Developer"
                    value={selectedRoleName}
                    onChange={e => setSelectedRoleName(e.target.value)}
                  />
                )}
              </div>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedRoleName}
                loading={uploading}
                id="analyze-resume-btn"
              >
                <Upload size={14} />
                {uploading ? 'Analyzing…' : 'Analyze'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── No results yet ── */}
      {analyses.length === 0 && (
        <EmptyState
          icon={<FileText size={40} />}
          title="No resume analyses yet"
          description="Upload your resume above to get an ATS-oriented analysis tailored to your target role."
        />
      )}

      {/* ── Active analysis ── */}
      {activeAnalysis && (
        <div className="resume-result-layout">
          {/* Left: score + breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Score card */}
            <div className="section">
              <div className="section__header">
                <span className="section__title">Overall Score</span>
                {activeAnalysis.role_name && (
                  <span style={{ fontSize: 'var(--text-xs)', background: 'var(--color-accent-50)', color: 'var(--color-accent-700)', border: '1px solid var(--color-accent-100)', borderRadius: 'var(--radius-full)', padding: '2px 10px' }}>
                    For: {activeAnalysis.role_name}
                  </span>
                )}
              </div>
              <div className="section__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                <div className="resume-score-ring">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-gray-100)" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={pct >= 70 ? 'var(--color-success-600)' : pct >= 50 ? 'var(--color-accent-500)' : 'var(--color-danger-600)'}
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="resume-score-ring__text">
                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{pct}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>/100</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                    {activeAnalysis.summary}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                    ⓘ This is an application-generated ATS-oriented assessment, not a vendor ATS score.
                  </p>
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="section">
              <div className="section__header"><span className="section__title">Score Breakdown</span></div>
              <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {Object.entries(activeAnalysis.score_breakdown).map(([key, val]) => {
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  const v = Math.round(Number(val))
                  return (
                    <div key={key} className="skill-bar-row">
                      <div className="skill-bar-row__label">{label}</div>
                      <div className="skill-bar-row__track">
                        <div className="skill-bar-row__fill" style={{ width: `${v}%`, background: v >= 70 ? 'var(--color-success-600)' : v >= 50 ? 'var(--color-accent-500)' : 'var(--color-danger-600)' }} />
                      </div>
                      <span className="skill-bar-row__pct">{v}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Keywords */}
            <div className="section">
              <div className="section__header"><span className="section__title">Keywords</span></div>
              <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {activeAnalysis.keywords_found.length > 0 && (
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-success-600)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> Found ({activeAnalysis.keywords_found.length})
                    </div>
                    <div className="result-chip-row">
                      {activeAnalysis.keywords_found.map(k => (
                        <span key={k} className="result-chip result-chip--strong">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {activeAnalysis.keywords_missing.length > 0 && (
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-danger-600)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Minus size={12} /> Missing ({activeAnalysis.keywords_missing.length})
                    </div>
                    <div className="result-chip-row">
                      {activeAnalysis.keywords_missing.map(k => (
                        <span key={k} className="result-chip result-chip--weak">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: recommendations + history */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Recommendations */}
            <div className="section">
              <div className="section__header"><span className="section__title">Recommendations</span></div>
              <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {activeAnalysis.recommendations.length === 0 && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>No recommendations generated.</p>
                )}
                {activeAnalysis.recommendations.map((rec, i) => (
                  <RecommendationCard
                    key={i}
                    rec={rec}
                    expanded={!!expandedRecs[i]}
                    onToggle={() => setExpandedRecs(prev => ({ ...prev, [i]: !prev[i] }))}
                  />
                ))}
              </div>
            </div>

            {/* History */}
            {analyses.length > 1 && (
              <div className="section">
                <div className="section__header"><span className="section__title">Analysis History</span></div>
                <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {analyses.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setActiveAnalysis(a)}
                      className={`resume-history-item ${a.id === activeAnalysis?.id ? 'active' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <FileText size={14} />
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                          {a.resume_file?.file_name ?? `Resume v${analyses.length - i}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        <span>{a.role_name}</span>
                        <span>{Math.round(a.overall_score)}/100</span>
                        <span>{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Recommendation Card ──────────────────────────────────────────────────────
function RecommendationCard({ rec, expanded, onToggle }: { rec: Recommendation; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rec-card" style={{ borderLeft: `3px solid ${PRIORITY_COLORS[rec.priority]}`, background: PRIORITY_BG[rec.priority] }}>
      <div className="rec-card__header" onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          <span className="rec-card__priority" style={{ color: PRIORITY_COLORS[rec.priority] }}>
            {rec.priority.toUpperCase()}
          </span>
          <span className="rec-card__section">{rec.section}</span>
          <span className="rec-card__issue">{rec.issue}</span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {expanded && (
        <div className="rec-card__body">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)', marginBottom: rec.current_text ? 'var(--space-3)' : 0 }}>
            {rec.suggestion}
          </p>
          {rec.current_text && (
            <div className="rec-diff">
              <div className="rec-diff__label rec-diff__label--before">Current</div>
              <div className="rec-diff__text rec-diff__text--before">{rec.current_text}</div>
              {rec.suggested_text && (
                <>
                  <div className="rec-diff__label rec-diff__label--after">Suggested</div>
                  <div className="rec-diff__text rec-diff__text--after">{rec.suggested_text}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
