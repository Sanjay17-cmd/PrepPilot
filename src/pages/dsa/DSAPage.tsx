/**
 * DSA Tracker Page (P3-10)
 */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingPage } from '../../components/ui/Loading'
import {
  addProblem, loadProblems, updateProblem, deleteProblem, getStats,
  type DSAProblem, type DSAStats,
} from '../../features/dsa/dsaService'
import { DSA_TOPICS, DSA_DIFFICULTY_COLORS } from '../../config/aiFeatures'
import { Code2, Plus, CheckCircle, Clock, AlertCircle, ExternalLink, Trash2, Filter, Copy, Check, ChevronDown, ChevronUp, FileCode, Edit3 } from 'lucide-react'

const STATUS_ICON: Record<string, React.ReactNode> = {
  solved:     <CheckCircle size={14} color="var(--color-success-600)" />,
  attempted:  <Clock size={14} color="var(--color-warning-600)" />,
  reviewing:  <AlertCircle size={14} color="var(--color-accent-500)" />,
}

export function DSAPage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DSAStats | null>(null)
  const [problems, setProblems] = useState<DSAProblem[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProblem, setEditingProblem] = useState<DSAProblem | null>(null)
  const [filterTopic, setFilterTopic] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [form, setForm] = useState<{
    title: string; url: string;
    difficulty: DSAProblem['difficulty'];
    topic: string;
    status: DSAProblem['status'];
    notes: string;
    code: string;
  }>({
    title: '', url: '', difficulty: 'medium',
    topic: DSA_TOPICS[0], status: 'solved', notes: '', code: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!appUser) return
    load()
  }, [appUser])

  async function load() {
    setLoading(true)
    const [s, p] = await Promise.all([
      getStats(appUser!.auth.id),
      loadProblems(appUser!.auth.id),
    ])
    setStats(s)
    setProblems(p)
    setLoading(false)
  }

  async function handleFilter() {
    const p = await loadProblems(appUser!.auth.id, { topic: filterTopic || undefined, difficulty: filterDiff || undefined })
    setProblems(p)
  }

  useEffect(() => { handleFilter() }, [filterTopic, filterDiff])

  function handleOpenAdd() {
    setEditingProblem(null)
    setForm({ title: '', url: '', difficulty: 'medium', topic: DSA_TOPICS[0], status: 'solved', notes: '', code: '' })
    setShowAddModal(true)
  }

  function handleOpenEdit(p: DSAProblem) {
    setEditingProblem(p)
    setForm({
      title: p.title,
      url: p.url || '',
      difficulty: p.difficulty,
      topic: p.topic,
      status: p.status,
      notes: p.notes || '',
      code: p.code || '',
    })
    setShowAddModal(true)
  }

  async function handleSubmit() {
    if (!form.title.trim() || !appUser) return
    setSubmitting(true)
    try {
      if (editingProblem) {
        await updateProblem(editingProblem.id, {
          title: form.title.trim(),
          url: form.url.trim() || undefined,
          difficulty: form.difficulty,
          topic: form.topic,
          status: form.status,
          notes: form.notes || undefined,
          code: form.code || undefined,
        })
        success(`"${form.title}" updated!`)
      } else {
        await addProblem(appUser.auth.id, form)
        success(`"${form.title}" added!`)
      }
      setShowAddModal(false)
      setEditingProblem(null)
      setForm({ title: '', url: '', difficulty: 'medium', topic: DSA_TOPICS[0], status: 'solved', notes: '', code: '' })
      await load()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save problem.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopyCode(code: string, id: string) {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    success('Code copied to clipboard!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleStatusChange(id: string, status: DSAProblem['status']) {
    await updateProblem(id, { status })
    setProblems(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    await getStats(appUser!.auth.id).then(setStats)
  }

  async function handleDelete(id: string) {
    await deleteProblem(id)
    setProblems(prev => prev.filter(p => p.id !== id))
    await getStats(appUser!.auth.id).then(setStats)
  }

  if (loading) return <LoadingPage />

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-header__title">DSA Tracker</h1>
          <p className="page-header__subtitle">Track your Data Structures & Algorithms practice with solutions and personal notes.</p>
        </div>
        <Button onClick={handleOpenAdd} id="add-problem-btn">
          <Plus size={15} /> Add Problem
        </Button>
      </div>

      {/* ── Stats header ── */}
      {stats && (
        <div className="dsa-stat-header">
          <div className="dsa-stat-card dsa-stat-card--total">
            <span className="dsa-stat-card__value">{stats.total}</span>
            <span className="dsa-stat-card__label">Solved</span>
          </div>
          <div className="dsa-stat-card dsa-stat-card--easy">
            <span className="dsa-stat-card__value" style={{ color: DSA_DIFFICULTY_COLORS.easy }}>{stats.easy}</span>
            <span className="dsa-stat-card__label">Easy</span>
          </div>
          <div className="dsa-stat-card dsa-stat-card--medium">
            <span className="dsa-stat-card__value" style={{ color: DSA_DIFFICULTY_COLORS.medium }}>{stats.medium}</span>
            <span className="dsa-stat-card__label">Medium</span>
          </div>
          <div className="dsa-stat-card dsa-stat-card--hard">
            <span className="dsa-stat-card__value" style={{ color: DSA_DIFFICULTY_COLORS.hard }}>{stats.hard}</span>
            <span className="dsa-stat-card__label">Hard</span>
          </div>
        </div>
      )}

      <div className="dsa-layout">
        {/* ── Topic progress ── */}
        <div className="section">
          <div className="section__header"><span className="section__title">Topic Progress</span></div>
          <div className="section__body skill-bar-list">
            {stats?.topicProgress.map(t => (
              <div key={t.topic} className="skill-bar-row">
                <div className="skill-bar-row__label" style={{ fontSize: 'var(--text-xs)' }}>
                  {t.topic}
                  {stats.weakTopics.includes(t.topic) && (
                    <span title="Weak topic" style={{ display: 'inline-flex' }}>
                      <AlertCircle size={10} color="var(--color-danger-600)" />
                    </span>
                  )}
                </div>
                <div className="skill-bar-row__track">
                  <div className="skill-bar-row__fill" style={{ width: `${t.pct}%`, background: t.pct >= 60 ? 'var(--color-success-600)' : t.pct >= 30 ? 'var(--color-accent-500)' : 'var(--color-danger-600)' }} />
                </div>
                <span className="skill-bar-row__pct">{t.solved}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Problems list ── */}
        <div>
          {/* Recently solved */}
          {stats && stats.recentlySolved.length > 0 && (
            <div className="section" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="section__header"><span className="section__title">Recently Solved</span></div>
              <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {stats.recentlySolved.map(p => (
                  <div key={p.id} className="dsa-problem-row">
                    <CheckCircle size={13} color="var(--color-success-600)" />
                    <span style={{ fontSize: 'var(--text-sm)', flex: 1 }}>{p.title}</span>
                    <span className="dsa-badge" style={{ color: DSA_DIFFICULTY_COLORS[p.difficulty] }}>{p.difficulty}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{p.topic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="dsa-filter-bar">
            <Filter size={14} color="var(--text-tertiary)" />
            <select className="dsa-filter-select" value={filterTopic} onChange={e => setFilterTopic(e.target.value)}>
              <option value="">All Topics</option>
              {DSA_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="dsa-filter-select" value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
              <option value="">All Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Problem table */}
          {problems.length === 0 ? (
            <EmptyState icon={<Code2 size={36} />} title="No problems yet" description='Click "Add Problem" to start tracking your DSA practice.' action={<Button onClick={() => setShowAddModal(true)}>Add Problem</Button>} />
          ) : (
            <div className="section">
              <div className="section__body" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="dsa-table">
                  <thead>
                    <tr>
                      <th>Problem</th>
                      <th>Topic</th>
                      <th>Difficulty</th>
                      <th>Code & Notes</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map(p => (
                      <React.Fragment key={p.id}>
                        <tr>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{p.title}</span>
                              {p.url && (
                                <a href={p.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent-500)' }} title="Open LeetCode">
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            {p.notes && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes}</div>}
                          </td>
                          <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{p.topic}</td>
                          <td>
                            <span className="dsa-badge" style={{ color: DSA_DIFFICULTY_COLORS[p.difficulty], textTransform: 'capitalize' }}>
                              {p.difficulty}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: 'var(--text-xs)',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-md)',
                                background: p.code ? 'var(--color-accent-50)' : 'var(--color-gray-100)',
                                color: p.code ? 'var(--color-accent-700)' : 'var(--text-secondary)',
                                border: '1px solid',
                                borderColor: p.code ? 'var(--color-accent-200)' : 'var(--border-subtle)',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              <FileCode size={12} />
                              {p.code ? 'View Code' : (p.notes ? 'View Notes' : '+ Add Code')}
                              {expandedId === p.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </td>
                          <td>
                            <select
                              className="dsa-status-select"
                              value={p.status}
                              onChange={e => handleStatusChange(p.id, e.target.value as DSAProblem['status'])}
                            >
                              <option value="solved">Solved</option>
                              <option value="attempted">Attempted</option>
                              <option value="reviewing">Reviewing</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button onClick={() => handleOpenEdit(p)} className="dsa-delete-btn" style={{ color: 'var(--color-accent-600)' }} title="Edit Problem & Solution">
                                <Edit3 size={13} />
                              </button>
                              <button onClick={() => handleDelete(p.id)} className="dsa-delete-btn" title="Remove">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Expandable Code & Notes Panel ── */}
                        {expandedId === p.id && (
                          <tr>
                            <td colSpan={6} style={{ padding: 'var(--space-4)', background: 'var(--color-gray-50)', borderBottom: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: p.code ? '1.2fr 1fr' : '1fr', gap: 'var(--space-4)' }}>
                                {p.code ? (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                                        Solution Code
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <button
                                          onClick={() => handleOpenEdit(p)}
                                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-accent-600)', cursor: 'pointer', fontWeight: 500 }}
                                        >
                                          <Edit3 size={12} /> Edit Solution
                                        </button>
                                        <button
                                          onClick={() => handleCopyCode(p.code!, p.id)}
                                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-accent-600)', cursor: 'pointer', fontWeight: 500 }}
                                        >
                                          {copiedId === p.id ? <Check size={12} color="var(--color-success-600)" /> : <Copy size={12} />}
                                          {copiedId === p.id ? 'Copied!' : 'Copy Code'}
                                        </button>
                                      </div>
                                    </div>
                                    <pre style={{
                                      background: '#0f172a',
                                      color: '#f8fafc',
                                      padding: 'var(--space-3)',
                                      borderRadius: 'var(--radius-md)',
                                      fontSize: '12px',
                                      fontFamily: 'var(--font-mono)',
                                      overflowX: 'auto',
                                      maxHeight: '240px',
                                      lineHeight: '1.5',
                                      margin: 0,
                                    }}>
                                      <code>{p.code}</code>
                                    </pre>
                                  </div>
                                ) : (
                                  <div style={{ padding: 'var(--space-4)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>No solution code pasted yet.</span>
                                    <button
                                      onClick={() => handleOpenEdit(p)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent-300)', color: 'var(--color-accent-700)', background: 'var(--color-accent-50)', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      <Plus size={11} /> Paste Solution Code
                                    </button>
                                  </div>
                                )}

                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                                      Notes & Approach
                                    </span>
                                    <button
                                      onClick={() => handleOpenEdit(p)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-accent-600)', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      <Edit3 size={12} /> Edit Notes
                                    </button>
                                  </div>
                                  <div style={{
                                    background: 'white',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-3)',
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--text-primary)',
                                    minHeight: '80px',
                                    maxHeight: '240px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.6',
                                  }}>
                                    {p.notes || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No notes added yet for this problem.</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Problem Modal ── */}
      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setEditingProblem(null) }} title={editingProblem ? 'Edit Problem & Solution' : 'Add Problem'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="form-label">Problem Title *</label>
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Two Sum" id="problem-title" />
          </div>
          <div>
            <label className="form-label">LeetCode URL</label>
            <input className="form-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://leetcode.com/problems/..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label className="form-label">Topic *</label>
              <select className="form-select" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}>
                {DSA_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Difficulty *</label>
              <select className="form-select" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as DSAProblem['difficulty'] }))}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DSAProblem['status'] }))}>
              <option value="solved">Solved</option>
              <option value="attempted">Attempted</option>
              <option value="reviewing">Reviewing</option>
            </select>
          </div>
          <div>
            <label className="form-label">Solution Code</label>
            <textarea
              className="form-input"
              rows={5}
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="Paste your clean code solution here (Python, Java, C++, JS)..."
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="form-label">Notes & Approach</label>
            <textarea
              className="form-input"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Key patterns, time & space complexity, edge cases, learnings…"
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingProblem(null) }}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!form.title.trim()} id="submit-problem-btn">
              {editingProblem ? 'Save Changes' : 'Add Problem'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
