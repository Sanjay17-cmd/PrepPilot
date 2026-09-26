import React, { useState, useEffect } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import {
  DEGREE_OPTIONS, BRANCH_OPTIONS, PROGRAMMING_LANGUAGE_OPTIONS,
  EXPERIENCE_LEVELS, YEAR_OPTIONS, SEMESTER_OPTIONS,
} from '../../config/app'
import { getGraduationYears } from '../../lib/utils'
import { CheckCircle, Plus, Trash2, Send } from 'lucide-react'
import type { Role, StudentRole } from '../../types'

// -------------------------------------------------------------------------
// Settings Page — tabbed: Profile | Roles
// -------------------------------------------------------------------------

type Tab = 'profile' | 'roles'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Settings</h1>
        <p className="page-header__subtitle">Manage your profile, education, and preparation roles.</p>
      </div>

      <div className="tabs" style={{ marginBottom: 0 }}>
        <button className={`tabs__tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
        <button className={`tabs__tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>My Roles</button>
      </div>

      <div style={{ paddingTop: 'var(--space-6)' }}>
        {tab === 'profile' ? <ProfileTab /> : <RolesTab />}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Profile Tab
// -------------------------------------------------------------------------

function ProfileTab() {
  const { appUser, refreshUser } = useAuth()
  const { success, error: toastError } = useToast()
  const profile = appUser?.profile
  const education = appUser?.education

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    institution: education?.institution ?? '',
    degree: education?.degree ?? '',
    branch: education?.branch ?? '',
    current_year: education?.current_year?.toString() ?? '',
    current_semester: education?.current_semester?.toString() ?? '',
    graduation_year: education?.graduation_year?.toString() ?? '',
    score_type: education?.score_type ?? 'cgpa',
    score_value: education?.score_value?.toString() ?? '',
    preferred_programming_language: education?.preferred_programming_language ?? '',
    coding_experience_level: education?.coding_experience_level ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Sync when auth data loads
  useEffect(() => {
    setForm({
      full_name: profile?.full_name ?? '',
      institution: education?.institution ?? '',
      degree: education?.degree ?? '',
      branch: education?.branch ?? '',
      current_year: education?.current_year?.toString() ?? '',
      current_semester: education?.current_semester?.toString() ?? '',
      graduation_year: education?.graduation_year?.toString() ?? '',
      score_type: (education?.score_type as 'cgpa' | 'percentage') ?? 'cgpa',
      score_value: education?.score_value?.toString() ?? '',
      preferred_programming_language: education?.preferred_programming_language ?? '',
      coding_experience_level: education?.coding_experience_level ?? '',
    })
  }, [appUser])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const userId = appUser!.auth.id

    const [profileRes, eduRes] = await Promise.all([
      supabase.from('profiles').update({ full_name: form.full_name.trim() }).eq('id', userId),
      supabase.from('student_education').upsert({
        student_id: userId,
        institution: form.institution.trim() || null,
        degree: form.degree || null,
        branch: form.branch || null,
        current_year: form.current_year ? Number(form.current_year) : null,
        current_semester: form.current_semester ? Number(form.current_semester) : null,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
        score_type: form.score_type || null,
        score_value: form.score_value ? Number(form.score_value) : null,
        preferred_programming_language: form.preferred_programming_language || null,
        coding_experience_level: form.coding_experience_level || null,
      }, { onConflict: 'student_id' }),
    ])

    setSaving(false)
    if (profileRes.error || eduRes.error) {
      toastError('Failed to save. Please try again.')
    } else {
      await refreshUser()
      success('Profile saved successfully.')
    }
  }

  const gradYears = getGraduationYears()

  return (
    <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Personal */}
      <div className="section">
        <div className="section__header"><span className="section__title">Personal</span></div>
        <div className="section__body">
          <Input label="Full name" id="st-name" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
        </div>
      </div>

      {/* Institution */}
      <div className="section">
        <div className="section__header"><span className="section__title">Institution</span></div>
        <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="College / Institution" id="st-inst" value={form.institution} onChange={e => set('institution', e.target.value)} />
          <div className="form-row">
            <Select label="Degree" id="st-degree" value={form.degree} onChange={e => set('degree', e.target.value)}
              options={DEGREE_OPTIONS.map(d => ({ value: d, label: d }))} placeholder="Select degree" />
            <Select label="Branch" id="st-branch" value={form.branch} onChange={e => set('branch', e.target.value)}
              options={BRANCH_OPTIONS.map(b => ({ value: b, label: b }))} placeholder="Select branch" />
          </div>
          <div className="form-row form-row--3">
            <Select label="Year" id="st-year" value={form.current_year} onChange={e => set('current_year', e.target.value)}
              options={YEAR_OPTIONS.map(y => ({ value: y, label: `Year ${y}` }))} placeholder="Year" />
            <Select label="Semester" id="st-sem" value={form.current_semester} onChange={e => set('current_semester', e.target.value)}
              options={SEMESTER_OPTIONS.map(s => ({ value: s, label: `Sem ${s}` }))} placeholder="Sem" />
            <Select label="Grad. year" id="st-grad" value={form.graduation_year} onChange={e => set('graduation_year', e.target.value)}
              options={gradYears.map(y => ({ value: y, label: String(y) }))} placeholder="Year" />
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="section">
        <div className="section__header"><span className="section__title">Academic Score</span></div>
        <div className="section__body">
          <div className="form-row">
            <Select label="Score type" id="st-score-type" value={form.score_type}
              onChange={e => set('score_type', e.target.value)}
              options={[{ value: 'cgpa', label: 'CGPA' }, { value: 'percentage', label: 'Percentage' }]} />
            <Input label={form.score_type === 'cgpa' ? 'CGPA' : 'Percentage'} id="st-score"
              type="number" step="0.01" value={form.score_value} onChange={e => set('score_value', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Coding */}
      <div className="section">
        <div className="section__header"><span className="section__title">Coding Background</span></div>
        <div className="section__body">
          <div className="form-row">
            <Select label="Preferred language" id="st-lang" value={form.preferred_programming_language}
              onChange={e => set('preferred_programming_language', e.target.value)}
              options={PROGRAMMING_LANGUAGE_OPTIONS.map(l => ({ value: l, label: l }))} placeholder="Select" />
            <Select label="Experience level" id="st-exp" value={form.coding_experience_level}
              onChange={e => set('coding_experience_level', e.target.value)}
              options={EXPERIENCE_LEVELS.map(l => ({ value: l.value, label: l.label }))} placeholder="Select" />
          </div>
        </div>
      </div>

      <div>
        <Button onClick={handleSave} loading={saving} id="settings-save">Save Changes</Button>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Roles Tab
// -------------------------------------------------------------------------

function RolesTab() {
  const { appUser, refreshUser } = useAuth()
  const { success, error: toastError } = useToast()
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [currentRoles, setCurrentRoles] = useState<StudentRole[]>(appUser?.studentRoles ?? [])
  const [addModal, setAddModal] = useState(false)
  const [requestModal, setRequestModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [requestForm, setRequestForm] = useState({ name: '', description: '', reason: '', skills: '' })
  const [submitting, setSubmitting] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    setCurrentRoles(appUser?.studentRoles ?? [])
    supabase.from('roles').select('*').eq('is_active', true).order('name').then(({ data }) => setAllRoles(data ?? []))
  }, [appUser])

  const availableRoles = allRoles.filter(r => !currentRoles.some(cr => cr.role_id === r.id))

  const handleRemove = async (studentRoleId: string) => {
    setSaving(true)
    const { error } = await supabase.from('student_roles').delete().eq('id', studentRoleId)
    setSaving(false)
    if (error) { toastError('Could not remove role.'); return }
    await refreshUser()
    success('Role removed.')
  }

  const handleAdd = async (roleId: string) => {
    const isPrimary = currentRoles.length === 0
    const { error } = await supabase.from('student_roles').insert({
      student_id: appUser!.auth.id,
      role_id: roleId,
      is_primary: isPrimary,
    })
    if (error) { toastError('Could not add role.'); return }
    await refreshUser()
    setAddModal(false)
    success('Role added.')
  }

  const handleRequestSubmit = async () => {
    if (!requestForm.name.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('role_requests').insert({
      requester_user_id: appUser!.auth.id,
      requested_role_name: requestForm.name.trim(),
      description: requestForm.description.trim() || null,
      reason: requestForm.reason.trim() || null,
      optional_skills: requestForm.skills.trim() || null,
    })
    setSubmitting(false)
    if (error) { toastError('Could not submit request.'); return }
    setRequestSent(true)
    success('Request submitted successfully.')
    setTimeout(() => { setRequestModal(false); setRequestSent(false); setRequestForm({ name: '', description: '', reason: '', skills: '' }) }, 1500)
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <div className="section">
        <div className="section__header">
          <div>
            <div className="section__title">My Roles</div>
            <div className="section__subtitle">Roles you are currently preparing for</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setAddModal(true)} id="add-role-btn">
            <Plus size={14} /> Add role
          </Button>
        </div>

        <div className="section__body" style={{ padding: 0 }}>
          {currentRoles.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              No roles selected. Add a role to begin.
            </div>
          ) : (
            currentRoles.map((sr) => (
              <div key={sr.id} style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-color)', gap: 'var(--space-3)' }}>
                <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{sr.role?.name ?? 'Unknown'}</span>
                {sr.is_primary && <Badge variant="accent">Primary</Badge>}
                <Button variant="ghost" size="sm" onClick={() => handleRemove(sr.id)} disabled={saving} aria-label={`Remove ${sr.role?.name}`}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="section__footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Can't find your role?</span>
          <Button variant="ghost" size="sm" onClick={() => setRequestModal(true)} id="request-role-settings-btn">
            <Plus size={13} /> Request a role
          </Button>
        </div>
      </div>

      {/* Add role modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add a role">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '320px', overflowY: 'auto' }}>
          {availableRoles.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>
              You've already selected all available roles.
            </p>
          ) : (
            availableRoles.map(role => (
              <button
                key={role.id}
                onClick={() => handleAdd(role.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-gray-50)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{role.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>{role.category}</div>
                </div>
                <Plus size={14} color="var(--text-tertiary)" />
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Request role modal */}
      <Modal
        open={requestModal}
        onClose={() => setRequestModal(false)}
        title="Request a new role"
        footer={requestSent ? undefined : (
          <>
            <Button variant="ghost" onClick={() => setRequestModal(false)}>Cancel</Button>
            <Button onClick={handleRequestSubmit} loading={submitting} disabled={!requestForm.name.trim()} id="req-submit">
              <Send size={14} /> Submit
            </Button>
          </>
        )}
      >
        {requestSent ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <CheckCircle size={32} color="var(--color-success-600)" style={{ margin: '0 auto var(--space-3)' }} />
            <p style={{ fontWeight: 500 }}>Request submitted successfully!</p>
          </div>
        ) : (
          <>
            <Input label="Role name" id="req-name-s" value={requestForm.name} onChange={e => setRequestForm(f => ({ ...f, name: e.target.value }))} required />
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={requestForm.description} onChange={e => setRequestForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this role involve?" />
            </div>
            <div className="form-group">
              <label className="form-label">Why do you need this?</label>
              <textarea className="form-textarea" value={requestForm.reason} onChange={e => setRequestForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <Input label="Expected skills (optional)" id="req-skills-s" value={requestForm.skills} onChange={e => setRequestForm(f => ({ ...f, skills: e.target.value }))} placeholder="e.g. C, RTOS, ARM" />
          </>
        )}
      </Modal>
    </div>
  )
}
