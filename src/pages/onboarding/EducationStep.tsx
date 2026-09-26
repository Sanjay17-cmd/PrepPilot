import React, { useState, useEffect } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import {
  DEGREE_OPTIONS,
  BRANCH_OPTIONS,
  PROGRAMMING_LANGUAGE_OPTIONS,
  EXPERIENCE_LEVELS,
  YEAR_OPTIONS,
  SEMESTER_OPTIONS,
} from '../../config/app'
import { getGraduationYears } from '../../lib/utils'
import type { EducationProfile } from '../../types'

interface EducationStepProps {
  onNext: () => void
  stepIndex: number
}

type FormData = {
  full_name: string
  institution: string
  degree: string
  branch: string
  current_year: string
  current_semester: string
  graduation_year: string
  score_type: 'cgpa' | 'percentage'
  score_value: string
  preferred_programming_language: string
  coding_experience_level: 'beginner' | 'intermediate' | 'advanced' | ''
}

const initialForm: FormData = {
  full_name: '',
  institution: '',
  degree: '',
  branch: '',
  current_year: '',
  current_semester: '',
  graduation_year: '',
  score_type: 'cgpa',
  score_value: '',
  preferred_programming_language: '',
  coding_experience_level: '',
}

export function EducationStep({ onNext }: EducationStepProps) {
  const { appUser, refreshUser } = useAuth()
  const { error: toastError } = useToast()
  const [form, setForm] = useState<FormData>(initialForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  // Pre-fill from existing data
  useEffect(() => {
    if (appUser?.profile?.full_name) {
      setForm((f) => ({ ...f, full_name: appUser.profile!.full_name ?? '' }))
    }
    if (appUser?.education) {
      const ed = appUser.education
      setForm((f) => ({
        ...f,
        institution: ed.institution ?? '',
        degree: ed.degree ?? '',
        branch: ed.branch ?? '',
        current_year: ed.current_year?.toString() ?? '',
        current_semester: ed.current_semester?.toString() ?? '',
        graduation_year: ed.graduation_year?.toString() ?? '',
        score_type: ed.score_type ?? 'cgpa',
        score_value: ed.score_value?.toString() ?? '',
        preferred_programming_language: ed.preferred_programming_language ?? '',
        coding_experience_level: ed.coding_experience_level ?? '',
      }))
    }
  }, [appUser])

  const set = (key: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.full_name.trim()) errs.full_name = 'Required'
    if (!form.institution.trim()) errs.institution = 'Required'
    if (!form.degree) errs.degree = 'Select your degree'
    if (!form.current_year) errs.current_year = 'Required'
    if (!form.coding_experience_level) errs.coding_experience_level = 'Required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)

    const userId = appUser!.auth.id

    // Update profile name
    const profileUpdate = supabase
      .from('profiles')
      .update({ full_name: form.full_name.trim() })
      .eq('id', userId)

    // Upsert education
    const educationUpsert = supabase
      .from('student_education')
      .upsert({
        student_id: userId,
        institution: form.institution.trim() || null,
        degree: form.degree || null,
        branch: form.branch || null,
        current_year: form.current_year ? Number(form.current_year) : null,
        current_semester: form.current_semester ? Number(form.current_semester) : null,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
        score_type: form.score_type,
        score_value: form.score_value ? Number(form.score_value) : null,
        preferred_programming_language: form.preferred_programming_language || null,
        coding_experience_level: form.coding_experience_level || null,
      }, { onConflict: 'student_id' })

    const [profileRes, eduRes] = await Promise.all([profileUpdate, educationUpsert])

    if (profileRes.error || eduRes.error) {
      console.error('[EducationStep] profileRes.error:', profileRes.error)
      console.error('[EducationStep] eduRes.error:', eduRes.error)
      toastError(
        eduRes.error?.message || profileRes.error?.message || 'Could not save your information. Please try again.'
      )
      setSaving(false)
      return
    }

    await refreshUser()
    setSaving(false)
    onNext()
  }

  const gradYears = getGraduationYears()

  return (
    <div className="onboarding-content">
      <div className="onboarding-content__header">
        <div className="onboarding-content__step">Step 1 of 3</div>
        <h1 className="onboarding-content__title">Tell us about your education</h1>
        <p className="onboarding-content__subtitle">
          This helps us personalise your preparation plan. All fields can be updated later in Settings.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* Personal */}
        <div>
          <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
            Personal
          </h2>
          <Input
            label="Full name"
            id="ob-name"
            placeholder="Sanjay Kumar"
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            error={errors.full_name}
            required
          />
        </div>

        {/* Institution */}
        <div>
          <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
            Institution
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              label="College / Institution"
              id="ob-institution"
              placeholder="Anna University"
              value={form.institution}
              onChange={(e) => set('institution', e.target.value)}
              error={errors.institution}
              required
            />
            <div className="form-row">
              <Select
                label="Degree"
                id="ob-degree"
                value={form.degree}
                onChange={(e) => set('degree', e.target.value)}
                options={DEGREE_OPTIONS.map((d) => ({ value: d, label: d }))}
                placeholder="Select degree"
                error={errors.degree}
                required
              />
              <Select
                label="Branch / Department"
                id="ob-branch"
                value={form.branch}
                onChange={(e) => set('branch', e.target.value)}
                options={BRANCH_OPTIONS.map((b) => ({ value: b, label: b }))}
                placeholder="Select branch"
              />
            </div>
            <div className="form-row form-row--3">
              <Select
                label="Current year"
                id="ob-year"
                value={form.current_year}
                onChange={(e) => set('current_year', e.target.value)}
                options={YEAR_OPTIONS.map((y) => ({ value: y, label: `Year ${y}` }))}
                placeholder="Year"
                error={errors.current_year}
                required
              />
              <Select
                label="Semester"
                id="ob-semester"
                value={form.current_semester}
                onChange={(e) => set('current_semester', e.target.value)}
                options={SEMESTER_OPTIONS.map((s) => ({ value: s, label: `Semester ${s}` }))}
                placeholder="Sem"
              />
              <Select
                label="Graduation year"
                id="ob-grad-year"
                value={form.graduation_year}
                onChange={(e) => set('graduation_year', e.target.value)}
                options={gradYears.map((y) => ({ value: y, label: String(y) }))}
                placeholder="Year"
              />
            </div>
          </div>
        </div>

        {/* Score */}
        <div>
          <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
            Academic Score
          </h2>
          <div className="form-row">
            <Select
              label="Score type"
              id="ob-score-type"
              value={form.score_type}
              onChange={(e) => set('score_type', e.target.value as 'cgpa' | 'percentage')}
              options={[
                { value: 'cgpa', label: 'CGPA (out of 10)' },
                { value: 'percentage', label: 'Percentage (%)' },
              ]}
            />
            <Input
              label={form.score_type === 'cgpa' ? 'CGPA' : 'Percentage'}
              id="ob-score-value"
              type="number"
              step="0.01"
              min={0}
              max={form.score_type === 'cgpa' ? 10 : 100}
              placeholder={form.score_type === 'cgpa' ? '8.5' : '85'}
              value={form.score_value}
              onChange={(e) => set('score_value', e.target.value)}
            />
          </div>
        </div>

        {/* Coding */}
        <div>
          <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
            Coding Background
          </h2>
          <div className="form-row">
            <Select
              label="Preferred language"
              id="ob-lang"
              value={form.preferred_programming_language}
              onChange={(e) => set('preferred_programming_language', e.target.value)}
              options={PROGRAMMING_LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))}
              placeholder="Select language"
            />
            <Select
              label="Current experience level"
              id="ob-exp"
              value={form.coding_experience_level}
              onChange={(e) => set('coding_experience_level', e.target.value as 'beginner' | 'intermediate' | 'advanced')}
              options={EXPERIENCE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              placeholder="Select level"
              error={errors.coding_experience_level}
              required
            />
          </div>
        </div>
      </div>

      <div className="onboarding-actions">
        <div /> {/* spacer — no back on step 1 */}
        <Button onClick={handleSave} loading={saving} size="lg" id="ob-education-next">
          Continue
        </Button>
      </div>
    </div>
  )
}
