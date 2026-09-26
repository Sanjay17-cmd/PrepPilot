import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { GraduationCap, Target, CheckCircle, Edit2 } from 'lucide-react'

interface ReviewStepProps {
  onBack: () => void
  stepIndex: number
}

export function ReviewStep({ onBack }: ReviewStepProps) {
  const { appUser, refreshUser } = useAuth()
  const { error: toastError } = useToast()
  const navigate = useNavigate()
  const [completing, setCompleting] = useState(false)

  const profile = appUser?.profile
  const education = appUser?.education
  const roles = appUser?.studentRoles ?? []

  const handleComplete = async () => {
    setCompleting(true)
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', appUser!.auth.id)

    if (error) {
      toastError('Something went wrong. Please try again.')
      setCompleting(false)
      return
    }

    await refreshUser()
    setCompleting(false)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="onboarding-content">
      <div className="onboarding-content__header">
        <div className="onboarding-content__step">Step 3 of 3</div>
        <h1 className="onboarding-content__title">Review your profile</h1>
        <p className="onboarding-content__subtitle">
          Everything looks good? Complete setup to enter your workspace.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Education summary */}
        <div className="section">
          <div className="section__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <GraduationCap size={16} color="var(--text-tertiary)" />
              <span className="section__title">Education</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <Edit2 size={13} />
              Edit
            </Button>
          </div>
          <div className="section__body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Name</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{profile?.full_name || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Institution</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{education?.institution || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Degree & Branch</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                  {[education?.degree, education?.branch].filter(Boolean).join(', ') || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Year / Semester</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                  {education?.current_year ? `Year ${education.current_year}` : '—'}
                  {education?.current_semester ? `, Sem ${education.current_semester}` : ''}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Academic Score</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                  {education?.score_value
                    ? `${education.score_value} ${education.score_type === 'cgpa' ? '/ 10 CGPA' : '%'}`
                    : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Coding</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                  {education?.preferred_programming_language || '—'}
                  {education?.coding_experience_level ? ` · ${education.coding_experience_level}` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Roles summary */}
        <div className="section">
          <div className="section__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Target size={16} color="var(--text-tertiary)" />
              <span className="section__title">Target Roles</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <Edit2 size={13} />
              Edit
            </Button>
          </div>
          <div className="section__body">
            {roles.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No roles selected</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {roles.map((sr) => (
                  <Badge key={sr.id} variant={sr.is_primary ? 'accent' : 'default'}>
                    {sr.role?.name ?? 'Unknown'}
                    {sr.is_primary && ' (Primary)'}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ready message */}
        <div style={{ background: 'var(--color-success-50)', border: '1px solid var(--color-success-100)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <CheckCircle size={18} color="var(--color-success-600)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-success-700)' }}>
              Your preparation workspace is ready
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success-700)', marginTop: '2px', opacity: 0.8 }}>
              Complete setup to access your dashboard, roadmap, and study tools.
            </p>
          </div>
        </div>
      </div>

      <div className="onboarding-actions">
        <Button variant="ghost" onClick={onBack} id="ob-review-back">← Back</Button>
        <Button onClick={handleComplete} loading={completing} size="lg" id="ob-complete">
          Complete setup
        </Button>
      </div>
    </div>
  )
}
