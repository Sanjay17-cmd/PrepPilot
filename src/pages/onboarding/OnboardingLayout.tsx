import React, { useState } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { BookOpen, CheckCircle } from 'lucide-react'
import { APP_CONFIG, ONBOARDING_STEPS } from '../../config/app'
import { cx } from '../../lib/utils'
import { EducationStep } from './EducationStep'
import { RoleSelectionStep } from './RoleSelectionStep'
import { ReviewStep } from './ReviewStep'

export function OnboardingLayout() {
  const [currentStep, setCurrentStep] = useState<string>('education')
  const navigate = useNavigate()

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep)

  const goNext = () => {
    const next = ONBOARDING_STEPS[stepIndex + 1]
    if (next) {
      setCurrentStep(next.id)
      navigate(`/onboarding/${next.id}`)
    }
  }

  const goBack = () => {
    const prev = ONBOARDING_STEPS[stepIndex - 1]
    if (prev) {
      setCurrentStep(prev.id)
      navigate(`/onboarding/${prev.id}`)
    }
  }

  return (
    <div className="onboarding-layout">
      {/* Sidebar */}
      <aside className="onboarding-sidebar">
        <div className="onboarding-sidebar__brand">
          <div className="sidebar-brand__icon">
            <BookOpen size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {APP_CONFIG.name}
          </span>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
            Setup Steps
          </p>
          <div className="onboarding-steps">
            {ONBOARDING_STEPS.map((step, i) => {
              const isActive = step.id === currentStep
              const isCompleted = i < stepIndex
              return (
                <div
                  key={step.id}
                  className={cx(
                    'onboarding-step',
                    isActive && 'active',
                    isCompleted && 'completed'
                  )}
                >
                  <div className="onboarding-step__number">
                    {isCompleted ? <CheckCircle size={14} color="var(--color-success-600)" /> : i + 1}
                  </div>
                  <div>
                    <div className="onboarding-step__label">{step.label}</div>
                    <div className="onboarding-step__description">{step.description}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: 'var(--space-4) 0 0', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 'var(--leading-relaxed)' }}>
            This information helps us personalise your preparation plan. You can change it later in Settings.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ overflowY: 'auto' }}>
        <Routes>
          <Route index element={<Navigate to="education" replace />} />
          <Route
            path="education"
            element={
              <EducationStep
                onNext={() => { setCurrentStep('roles'); goNext() }}
                stepIndex={0}
              />
            }
          />
          <Route
            path="roles"
            element={
              <RoleSelectionStep
                onNext={() => { setCurrentStep('review'); goNext() }}
                onBack={() => { setCurrentStep('education'); goBack() }}
                stepIndex={1}
              />
            }
          />
          <Route
            path="review"
            element={
              <ReviewStep
                onBack={() => { setCurrentStep('roles'); goBack() }}
                stepIndex={2}
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}
