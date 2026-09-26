import React, { useState, useEffect } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { CheckCircle, Plus, Send } from 'lucide-react'
import type { Role } from '../../types'

interface RoleSelectionStepProps {
  onNext: () => void
  onBack: () => void
  stepIndex: number
}

export function RoleSelectionStep({ onNext, onBack }: RoleSelectionStepProps) {
  const { appUser, refreshUser } = useAuth()
  const { error: toastError, success } = useToast()

  const [roles, setRoles] = useState<Role[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [saving, setSaving] = useState(false)

  // Role request modal
  const [requestModal, setRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({ name: '', description: '', reason: '', skills: '' })
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name')
      setRoles(data ?? [])
      setLoadingRoles(false)
    }
    load()

    // Pre-select existing roles
    if (appUser?.studentRoles?.length) {
      const existing = new Set(appUser.studentRoles.map((sr) => sr.role_id))
      setSelectedIds(existing)
      const primary = appUser.studentRoles.find((sr) => sr.is_primary)
      if (primary) setPrimaryId(primary.role_id)
    }
  }, []) // eslint-disable-line

  const toggleRole = (roleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
        if (primaryId === roleId) setPrimaryId(null)
      } else {
        next.add(roleId)
        if (next.size === 1) setPrimaryId(roleId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      toastError('Select at least one role to continue.')
      return
    }
    setSaving(true)
    const userId = appUser!.auth.id

    // Delete existing student roles
    await supabase.from('student_roles').delete().eq('student_id', userId)

    // Insert selected roles
    const inserts = Array.from(selectedIds).map((roleId) => ({
      student_id: userId,
      role_id: roleId,
      is_primary: roleId === (primaryId ?? Array.from(selectedIds)[0]),
    }))

    const { error } = await supabase.from('student_roles').insert(inserts)

    if (error) {
      toastError('Could not save roles. Please try again.')
      setSaving(false)
      return
    }

    await refreshUser()
    setSaving(false)
    onNext()
  }

  const handleRequestSubmit = async () => {
    if (!requestForm.name.trim()) return
    setSubmittingRequest(true)
    const { error } = await supabase.from('role_requests').insert({
      requester_user_id: appUser!.auth.id,
      requested_role_name: requestForm.name.trim(),
      description: requestForm.description.trim() || null,
      reason: requestForm.reason.trim() || null,
      optional_skills: requestForm.skills.trim() || null,
    })
    setSubmittingRequest(false)
    if (error) {
      toastError('Could not submit request. Please try again.')
    } else {
      setRequestSent(true)
      success('Role request submitted! An admin will review it.')
      setTimeout(() => { setRequestModal(false); setRequestSent(false); setRequestForm({ name: '', description: '', reason: '', skills: '' }) }, 1500)
    }
  }

  // Group roles by category
  const grouped = roles.reduce<Record<string, Role[]>>((acc, role) => {
    const key = role.category
    if (!acc[key]) acc[key] = []
    acc[key].push(role)
    return acc
  }, {})

  const categoryLabels: Record<string, string> = {
    software: 'Software Engineering',
    data: 'Data & AI',
    security: 'Security',
    cloud: 'Cloud & DevOps',
    qa: 'Quality Assurance',
    design: 'Design',
    business: 'Business',
    core: 'Core Engineering',
    other: 'Other',
  }

  return (
    <div className="onboarding-content" style={{ maxWidth: '800px' }}>
      <div className="onboarding-content__header">
        <div className="onboarding-content__step">Step 2 of 3</div>
        <h1 className="onboarding-content__title">What roles are you preparing for?</h1>
        <p className="onboarding-content__subtitle">
          Select all roles that interest you. Your preparation will be tailored accordingly.
          You can change this later in Settings.
        </p>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-accent-700)' }}>
          <strong>{selectedIds.size}</strong> role{selectedIds.size > 1 ? 's' : ''} selected
          {primaryId && ` · Primary: ${roles.find(r => r.id === primaryId)?.name}`}
        </div>
      )}

      {loadingRoles ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading roles…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {Object.entries(grouped).map(([category, categoryRoles]) => (
            <div key={category}>
              <h2 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
                {categoryLabels[category] ?? category}
              </h2>
              <div className="role-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {categoryRoles.map((role) => {
                  const isSelected = selectedIds.has(role.id)
                  const isPrimary = primaryId === role.id
                  return (
                    <div
                      key={role.id}
                      className={`role-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleRole(role.id)}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? toggleRole(role.id) : null}
                    >
                      <div className="role-card__check">
                        {isSelected && <CheckCircle size={12} color="white" />}
                      </div>
                      <div>
                        <div className="role-card__name">{role.name}</div>
                        {isPrimary && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-600)', fontWeight: 500, marginTop: '2px' }}>Primary</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request role */}
      <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>Can't find your role?</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>Submit a request and an admin will review it.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setRequestModal(true)} id="request-role-btn">
          <Plus size={14} />
          Request a role
        </Button>
      </div>

      <div className="onboarding-actions">
        <Button variant="ghost" onClick={onBack} id="ob-roles-back">← Back</Button>
        <Button onClick={handleSave} loading={saving} disabled={selectedIds.size === 0} size="lg" id="ob-roles-next">
          Continue
        </Button>
      </div>

      {/* Role request modal */}
      <Modal
        open={requestModal}
        onClose={() => setRequestModal(false)}
        title="Request a new role"
        footer={
          requestSent ? null : (
            <>
              <Button variant="ghost" onClick={() => setRequestModal(false)}>Cancel</Button>
              <Button
                onClick={handleRequestSubmit}
                loading={submittingRequest}
                disabled={!requestForm.name.trim()}
                id="role-request-submit"
              >
                <Send size={14} />
                Submit request
              </Button>
            </>
          )
        }
      >
        {requestSent ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <CheckCircle size={32} color="var(--color-success-600)" style={{ margin: '0 auto var(--space-3)' }} />
            <p style={{ fontWeight: 500 }}>Request submitted!</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
              An admin will review and approve your role.
            </p>
          </div>
        ) : (
          <>
            <Input
              label="Role name"
              id="req-name"
              placeholder="e.g. Embedded Systems Engineer"
              value={requestForm.name}
              onChange={(e) => setRequestForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <div className="form-group">
              <label className="form-label">Brief description</label>
              <textarea
                className="form-textarea"
                id="req-desc"
                placeholder="What does this role typically involve?"
                value={requestForm.description}
                onChange={(e) => setRequestForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Why do you need this?</label>
              <textarea
                className="form-textarea"
                id="req-reason"
                placeholder="How does this role fit your career goals?"
                value={requestForm.reason}
                onChange={(e) => setRequestForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <Input
              label="Expected skills (optional)"
              id="req-skills"
              placeholder="e.g. C, ARM, RTOS, Embedded Linux"
              value={requestForm.skills}
              onChange={(e) => setRequestForm((f) => ({ ...f, skills: e.target.value }))}
              hint="Comma-separated list of skills"
            />
          </>
        )}
      </Modal>
    </div>
  )
}
